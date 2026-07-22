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

/**
 * {@link SimpleStyle} の挙動を制御するオプションです。
 */
interface SimpleStyleOptions {
  /** ソースおよびレイヤーの ID の接頭辞です。既定値は `"geolonia-simple-style"` です。 */
  id: string;
  /** ポイントをクラスタリングするかどうかです。既定値は `true` です。 */
  cluster: boolean;
  /** ヒートマップ表示を行うかどうかです。現時点では未実装で、既定値は `false` です。 */
  heatmap: boolean;
  /** クラスターの円の色です。CSS カラー文字列で指定します。既定値は `"#ff0000"` です。 */
  clusterColor: string;
  /** 上記以外の任意のオプションです。 */
  [key: string]: unknown;
}

/**
 * simplestyle 仕様の GeoJSON を地図に表示するヘルパークラスです。
 *
 * ポリゴン、ライン、ポイントの各ジオメトリをそれぞれに適したレイヤーで描画し、
 * `fill`、`stroke`、`marker-color`、`marker-size`、`title`、`description` などの
 * simplestyle プロパティを解釈してスタイルへ反映します。ポイントについてはクラスタリング表示に対応し、
 * `description` プロパティを持つフィーチャーはクリックでポップアップを表示します。
 *
 * GeoJSON は {@link FeatureCollection} を直接渡すほか、GeoJSON を返す URL 文字列を渡して非同期に取得させることもできます。
 * 各設定用メソッドは `this` を返すため、メソッドチェーンで記述できます。
 *
 * @example
 * ```typescript
 * import { SimpleStyle } from "@geolonia/maps-core";
 *
 * new SimpleStyle(geojson).addTo(map);
 * ```
 */
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

  /**
   * SimpleStyle を作成します。
   *
   * `geojson` に URL 文字列を渡した場合は、その URL から GeoJSON を非同期に取得します。
   * 取得の完了は `_loadingPromise` で待つことができます。
   *
   * @param geojson 表示する GeoJSON です。{@link FeatureCollection} または GeoJSON を返す URL 文字列を指定します。
   * @param options 表示オプションです。指定した項目のみが既定値を上書きします。既定値は
   *   `id: "geolonia-simple-style"`、`cluster: true`、`heatmap: false`、`clusterColor: "#ff0000"` です。
   */
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

  /**
   * 表示中のデータを新しい GeoJSON で差し替えます。
   *
   * フィーチャーをポイントとそれ以外（ポリゴン、ライン）に振り分け、
   * それぞれ対応するソースの内容を更新します。レイヤー自体の追加は行わないため、
   * あらかじめ {@link SimpleStyle.addTo | addTo} で地図に追加されている必要があります。
   *
   * @param geojson 差し替える {@link FeatureCollection} です。
   * @returns メソッドチェーンのための `this` を返します。
   */
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

  /**
   * 地図にソースとレイヤーを追加して GeoJSON を表示します。
   *
   * ポリゴンとラインのソース、ポイント用のソース（クラスタリング設定付き）を追加し、
   * ポリゴンとラインのラベル用シンボルレイヤーを配置したうえで、
   * {@link SimpleStyle.setPolygonGeometries | setPolygonGeometries}、
   * {@link SimpleStyle.setLineGeometries | setLineGeometries}、
   * {@link SimpleStyle.setPointGeometries | setPointGeometries}、
   * {@link SimpleStyle.setCluster | setCluster} を呼び出して各ジオメトリのレイヤーを設定します。
   *
   * @param map 表示先の地図です。
   * @returns メソッドチェーンのための `this` を返します。
   *
   * @example
   * ```typescript
   * import { SimpleStyle } from "@geolonia/maps-core";
   *
   * new SimpleStyle(geojson).addTo(map);
   * ```
   */
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

  /**
   * データ全体の範囲に地図をフィットさせます。
   *
   * 現在の GeoJSON のフィーチャーからバウンディングボックスを算出し、そこへ地図を移動します。
   * フィーチャーが存在しない場合は何もしません。データを URL から取得中に呼び出した場合は、
   * フィット要求を保持しておき、取得完了後に自動でフィットします。
   *
   * @param options `map.fitBounds` に渡すオプションです。既定値は `duration: 3000`、`padding: 30` で、
   *   指定した項目のみがこれらを上書きします。
   * @returns メソッドチェーンのための `this` を返します。
   */
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
   * ポリゴンの塗りレイヤーを設定します。
   *
   * `$type` が `Polygon` のフィーチャーを対象に塗りレイヤーを追加し、
   * `fill`、`fill-opacity`、`stroke`（輪郭色）の各 simplestyle プロパティを反映します。
   * あわせて {@link SimpleStyle.setPopup | setPopup} でこのレイヤーにポップアップを設定します。
   * 通常は {@link SimpleStyle.addTo | addTo} から呼び出されます。
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
   * ラインのレイヤーを設定します。
   *
   * `$type` が `LineString` のフィーチャーを対象にラインレイヤーを追加し、
   * `stroke-width`（線幅）、`stroke`（線色）、`stroke-opacity`（不透明度）の各 simplestyle プロパティを反映します。
   * 線端と結合は丸めて描画します。あわせて {@link SimpleStyle.setPopup | setPopup} でこのレイヤーにポップアップを設定します。
   * 通常は {@link SimpleStyle.addTo | addTo} から呼び出されます。
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
   * ポイントのレイヤーを設定します。
   *
   * クラスターに属さないポイントを対象に、2 種類のレイヤーを追加します。
   * `marker-symbol` を持たないポイントには円レイヤーを、
   * `marker-symbol` を持つポイントにはアイコンとラベルのシンボルレイヤーを使います。
   * `marker-size`（`small`、`large`、その他）に応じて円の半径やラベルのオフセットを変え、
   * `marker-color`、`stroke`、`title`、`text-color` などの simplestyle プロパティを反映します。
   * あわせて円レイヤーとシンボルレイヤーの双方に {@link SimpleStyle.setPopup | setPopup} でポップアップを設定します。
   * 通常は {@link SimpleStyle.addTo | addTo} から呼び出されます。
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

  /**
   * 指定したレイヤーにクリックでポップアップを表示するイベントハンドラーを設定します。
   *
   * クリックされたフィーチャーが `description` プロパティを持つ場合、その中心座標に
   * サニタイズ済みの HTML を表示するポップアップを追加します。あわせてホバー時に
   * カーソルを変えるハンドラーも設定します。登録したハンドラーは `_eventHandlers` に記録され、
   * {@link SimpleStyle.remove | remove} でまとめて解除されます。
   *
   * @param map ポップアップを表示する地図です。
   * @param source ハンドラーを設定する対象のレイヤー ID です。
   */
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
   * クラスタリング用のレイヤーを設定します。
   *
   * `point_count` を持つクラスターを対象に、クラスターを表す円レイヤーと、
   * 件数（`point_count_abbreviated`）を表示するラベルのシンボルレイヤーを追加します。
   * 円の色は `clusterColor` オプションを使います。クラスターをクリックすると、
   * そのクラスターが展開するズームレベルまで地図を移動します。あわせてホバー時に
   * カーソルを変えるハンドラーも設定します。登録したハンドラーは `_eventHandlers` に記録され、
   * {@link SimpleStyle.remove | remove} でまとめて解除されます。通常は
   * {@link SimpleStyle.addTo | addTo} から呼び出されます。
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
      if (clusterId === undefined) return;
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

  /**
   * 追加したソース、レイヤー、イベントハンドラーを地図から除去します。
   *
   * {@link SimpleStyle.setPopup | setPopup} や {@link SimpleStyle.setCluster | setCluster}
   * で登録したイベントハンドラーをすべて解除し、ポリゴン、ライン、ポイント、クラスターの各レイヤーと、
   * それらのソースを削除します。カーソルのスタイルも元に戻します。まだ地図に追加されていない場合は何もしません。
   *
   * @returns メソッドチェーンのための `this` を返します。
   */
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

  /**
   * 内部で保持する GeoJSON を設定します。
   *
   * `geojson` が URL 文字列の場合は、いったん空のデータを設定したうえで、その URL から GeoJSON を
   * 非同期に取得します。取得中の Promise は `_loadingPromise` に保持され、取得完了後に
   * {@link SimpleStyle.updateData | updateData} で表示を更新します。フィット要求が保留されていれば
   * あわせてフィットします。取得に失敗した場合はエラーをコンソールに出力します。
   * `geojson` が {@link FeatureCollection} の場合は、そのまま内部データとして設定します。
   *
   * @param geojson 設定する {@link FeatureCollection} または GeoJSON を返す URL 文字列です。
   */
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
