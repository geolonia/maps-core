import bbox from "@turf/bbox";
import turfCenter from "@turf/center";
import maplibregl, {
  type GeoJSONSource,
  type MapLayerEventType,
  type MapLayerMouseEvent,
  type Map as MaplibreMap,
} from "maplibre-gl";
import { isURL, sanitizeDescription } from "./util";

type FeatureCollection = GeoJSON.FeatureCollection;

const textColor = "#000000";
const textHaloColor = "#FFFFFF";
const backgroundColor = "rgba(255, 0, 0, 0.4)";
const strokeColor = "#FFFFFF";

const template: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

interface SimpleStyleOptions {
  id: string;
  cluster: boolean;
  heatmap: boolean;
  clusterColor: string;
  [key: string]: unknown;
}

export class SimpleStyle {
  public _loadingPromise: Promise<unknown> | undefined;
  private callFitBounds = false;
  private geojson!: FeatureCollection;
  private map!: MaplibreMap;
  private options: SimpleStyleOptions;
  private _eventHandlers: {
    event: keyof MapLayerEventType;
    layer: string;
    // biome-ignore lint/suspicious/noExplicitAny: handlers have varying signatures
    handler: (...args: any[]) => void;
  }[] = [];

  constructor(
    geojson: string | FeatureCollection,
    options?: Record<string, unknown>,
  ) {
    this.setGeoJSON(geojson);

    this.options = {
      id: "geolonia-simple-style",
      cluster: true,
      heatmap: false, // TODO: It should support heatmap.
      clusterColor: "#ff0000",
      ...options,
    };
  }

  updateData(geojson: FeatureCollection) {
    this.setGeoJSON(geojson);

    const features = this.geojson.features;
    const polygonAndLines = features.filter(
      (feature: GeoJSON.Feature) =>
        feature.geometry.type.toLowerCase() !== "point",
    );
    const points = features.filter(
      (feature: GeoJSON.Feature) =>
        feature.geometry.type.toLowerCase() === "point",
    );

    (this.map.getSource(this.options.id) as GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: polygonAndLines,
    });

    (this.map.getSource(`${this.options.id}-points`) as GeoJSONSource)?.setData(
      {
        type: "FeatureCollection",
        features: points,
      },
    );

    return this;
  }

  addTo(map: MaplibreMap) {
    this.map = map;

    const features = this.geojson.features;
    const polygonAndLines = features.filter(
      (feature: GeoJSON.Feature) =>
        feature.geometry.type.toLowerCase() !== "point",
    );
    const points = features.filter(
      (feature: GeoJSON.Feature) =>
        feature.geometry.type.toLowerCase() === "point",
    );

    this.map.addSource(this.options.id, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: polygonAndLines,
      },
    });

    this.setPolygonGeometries();
    this.setLineGeometries();

    this.map.addSource(`${this.options.id}-points`, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: points,
      },
      cluster: this.options.cluster,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    this.map.addLayer({
      id: `${this.options.id}-polygon-symbol`,
      type: "symbol",
      source: this.options.id,
      filter: ["==", "$type", "Polygon"],
      paint: {
        "text-color": ["string", ["get", "text-color"], textColor],
        "text-halo-color": [
          "string",
          ["get", "text-halo-color"],
          textHaloColor,
        ],
        "text-halo-width": 1,
      },
      layout: {
        "text-field": ["get", "title"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-max-width": 12,
        "text-allow-overlap": false,
      },
    });

    this.map.addLayer({
      id: `${this.options.id}-linestring-symbol`,
      type: "symbol",
      source: this.options.id,
      filter: ["==", "$type", "LineString"],
      paint: {
        "text-color": ["string", ["get", "text-color"], textColor],
        "text-halo-color": [
          "string",
          ["get", "text-halo-color"],
          textHaloColor,
        ],
        "text-halo-width": 1,
      },
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "title"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-max-width": 12,
        "text-allow-overlap": false,
      },
    });

    this.setPointGeometries();
    this.setCluster();

    return this;
  }

  fitBounds(options = {}) {
    this.callFitBounds = true;

    const _options = {
      duration: 3000,
      padding: 30,
      ...options,
    };

    const bounds =
      this.geojson.features.length > 0
        ? (bbox(this.geojson) as [number, number, number, number])
        : undefined;
    if (bounds) {
      window.requestAnimationFrame(() => {
        this.map.fitBounds(bounds, _options);
      });
    }

    return this;
  }

  /**
   * Set polygon geometries.
   */
  setPolygonGeometries() {
    this.map.addLayer({
      id: `${this.options.id}-polygon`,
      type: "fill",
      source: this.options.id,
      filter: ["==", "$type", "Polygon"],
      paint: {
        "fill-color": ["string", ["get", "fill"], backgroundColor],
        "fill-opacity": ["number", ["get", "fill-opacity"], 1.0],
        "fill-outline-color": ["string", ["get", "stroke"], strokeColor],
      },
    });

    this.setPopup(this.map, `${this.options.id}-polygon`);
  }

  /**
   * Set line geometries.
   */
  setLineGeometries() {
    this.map.addLayer({
      id: `${this.options.id}-linestring`,
      type: "line",
      source: this.options.id,
      filter: ["==", "$type", "LineString"],
      paint: {
        "line-width": ["number", ["get", "stroke-width"], 2],
        "line-color": ["string", ["get", "stroke"], backgroundColor],
        "line-opacity": ["number", ["get", "stroke-opacity"], 1.0],
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });

    this.setPopup(this.map, `${this.options.id}-linestring`);
  }

  /**
   * Setup point geometries.
   */
  setPointGeometries() {
    this.map.addLayer({
      id: `${this.options.id}-circle-points`,
      type: "circle",
      source: `${this.options.id}-points`,
      filter: ["all", ["!has", "point_count"], ["!has", "marker-symbol"]],
      paint: {
        "circle-radius": [
          "case",
          ["==", "small", ["get", "marker-size"]],
          7,
          ["==", "large", ["get", "marker-size"]],
          13,
          9,
        ],
        "circle-color": ["string", ["get", "marker-color"], backgroundColor],
        "circle-opacity": ["number", ["get", "fill-opacity"], 1.0],
        "circle-stroke-width": ["number", ["get", "stroke-width"], 1],
        "circle-stroke-color": ["string", ["get", "stroke"], strokeColor],
        "circle-stroke-opacity": ["number", ["get", "stroke-opacity"], 1.0],
      },
    });

    this.map.addLayer({
      id: `${this.options.id}-symbol-points`,
      type: "symbol",
      source: `${this.options.id}-points`,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "text-color": ["string", ["get", "text-color"], textColor],
        "text-halo-color": [
          "string",
          ["get", "text-halo-color"],
          textHaloColor,
        ],
        "text-halo-width": 1,
      },
      layout: {
        "icon-image": ["get", "marker-symbol"],
        "text-field": ["get", "title"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-max-width": 12,
        "text-allow-overlap": true,
        "icon-allow-overlap": true,
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": [
          "case",
          ["==", "small", ["get", "marker-size"]],
          1,
          ["==", "large", ["get", "marker-size"]],
          1.6,
          1.2,
        ],
      },
    });

    this.setPopup(this.map, `${this.options.id}-circle-points`);
    this.setPopup(this.map, `${this.options.id}-symbol-points`);
  }

  async setPopup(map: MaplibreMap, source: string) {
    const clickHandler = async (e: MapLayerMouseEvent) => {
      if (!e.features?.[0]) return;
      const center = turfCenter(e.features[0]).geometry.coordinates as [
        number,
        number,
      ];
      const description = e.features[0].properties?.description;

      if (description) {
        const sanitizedDescription = await sanitizeDescription(description);
        new maplibregl.Popup()
          .setLngLat(center)
          .setHTML(sanitizedDescription)
          .addTo(map);
      }
    };

    const mouseEnterHandler = (e: MapLayerMouseEvent) => {
      if (e.features?.[0]?.properties?.description) {
        map.getCanvas().style.cursor = "pointer";
      }
    };

    const mouseLeaveHandler = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", source, clickHandler);
    map.on("mouseenter", source, mouseEnterHandler);
    map.on("mouseleave", source, mouseLeaveHandler);

    this._eventHandlers.push(
      { event: "click", layer: source, handler: clickHandler },
      { event: "mouseenter", layer: source, handler: mouseEnterHandler },
      { event: "mouseleave", layer: source, handler: mouseLeaveHandler },
    );
  }

  /**
   * Setup cluster markers
   */
  setCluster() {
    this.map.addLayer({
      id: `${this.options.id}-clusters`,
      type: "circle",
      source: `${this.options.id}-points`,
      filter: ["has", "point_count"],
      paint: {
        "circle-radius": 20,
        "circle-color": this.options.clusterColor,
        "circle-opacity": 1.0,
      },
    });

    this.map.addLayer({
      id: `${this.options.id}-cluster-count`,
      type: "symbol",
      source: `${this.options.id}-points`,
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-size": 14,
        "text-font": ["Noto Sans Regular"],
      },
    });

    const clusterLayer = `${this.options.id}-clusters`;

    const clusterClickHandler = async (e: MapLayerMouseEvent) => {
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: [clusterLayer],
      });
      if (!features[0]) return;
      const clusterId = features[0].properties?.cluster_id;
      const source = this.map.getSource(
        `${this.options.id}-points`,
      ) as GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(clusterId);

      this.map.easeTo({
        center: (features[0].geometry as GeoJSON.Point).coordinates as [
          number,
          number,
        ],
        zoom,
      });
    };

    const clusterEnterHandler = () => {
      this.map.getCanvas().style.cursor = "pointer";
    };

    const clusterLeaveHandler = () => {
      this.map.getCanvas().style.cursor = "";
    };

    this.map.on("click", clusterLayer, clusterClickHandler);
    this.map.on("mouseenter", clusterLayer, clusterEnterHandler);
    this.map.on("mouseleave", clusterLayer, clusterLeaveHandler);

    this._eventHandlers.push(
      { event: "click", layer: clusterLayer, handler: clusterClickHandler },
      {
        event: "mouseenter",
        layer: clusterLayer,
        handler: clusterEnterHandler,
      },
      {
        event: "mouseleave",
        layer: clusterLayer,
        handler: clusterLeaveHandler,
      },
    );
  }

  remove() {
    if (!this.map) return this;
    const id = this.options.id;

    for (const { event, layer, handler } of this._eventHandlers) {
      this.map.off(event, layer, handler);
    }
    this._eventHandlers = [];

    const layerIds = [
      `${id}-polygon-symbol`,
      `${id}-linestring-symbol`,
      `${id}-circle-points`,
      `${id}-symbol-points`,
      `${id}-polygon`,
      `${id}-linestring`,
      `${id}-clusters`,
      `${id}-cluster-count`,
    ];
    for (const layerId of layerIds) {
      if (this.map.getLayer(layerId)) {
        this.map.removeLayer(layerId);
      }
    }
    for (const sourceId of [id, `${id}-points`]) {
      if (this.map.getSource(sourceId)) {
        this.map.removeSource(sourceId);
      }
    }

    this.map.getCanvas().style.cursor = "";

    return this;
  }

  setGeoJSON(geojson: string | FeatureCollection) {
    if (typeof geojson === "string" && isURL(geojson)) {
      this.geojson = template;

      const fetchGeoJSON = async () => {
        try {
          const response = await window.fetch(geojson);
          const data = response.ok ? await response.json() : template;
          this.geojson = data;
          this.updateData(data);

          if (this.callFitBounds) {
            this.fitBounds();
            this.callFitBounds = false;
          }
        } catch (error) {
          console.error("[Geolonia] Failed to load GeoJSON:", error); // eslint-disable-line no-console
        }
      };

      this._loadingPromise = fetchGeoJSON();
    } else if (typeof geojson !== "string") {
      this.geojson = geojson;
    }
  }
}
