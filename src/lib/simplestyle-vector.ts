import turfCenter from "@turf/center";
import maplibregl, {
  type MapLayerMouseEvent,
  type Map as MaplibreMap,
  type MapSourceDataEvent,
} from "maplibre-gl";
import { sanitizeDescription } from "./util";

const textColor = "#000000";
const textHaloColor = "#FFFFFF";
const backgroundColor = "rgba(255, 0, 0, 0.4)";
const strokeColor = "#FFFFFF";

/**
 * ベクトルタイル（tiles.json / TileJSON）を simplestyle の規約に沿って地図に表示するヘルパーです。
 *
 * GeoJSON を対象とする SimpleStyle のベクトルタイル版に相当します。TileJSON の URL を渡すと、
 * `g-simplestyle-v1` という source-layer に含まれるポリゴン、ライン、ポイントの各ジオメトリを、
 * フィーチャーが持つ simplestyle プロパティ（`fill`、`stroke`、`marker-color`、`marker-size`、`title` など）
 * に従って描画します。フィーチャーが該当プロパティを持たない場合は、既定の色やサイズが適用されます。
 * 各フィーチャーのクリックでは、`description` プロパティを HTML としてポップアップ表示します。
 *
 * @example
 * ```typescript
 * new SimpleStyleVector(url).addTo(map);
 * ```
 */
class SimpleStyleVector {
  private sourceName: string;

  /**
   * @param url 表示するベクトルタイルソースの TileJSON（tiles.json）URL です。
   */
  constructor(private url: string) {
    this.sourceName = "vt-geolonia-simple-style";
  }

  /**
   * 地図にベクトルタイルソースと各レイヤーを追加し、simplestyle の規約に沿って表示します。
   *
   * ソースを追加したうえで、ポリゴン（塗り潰しとラベル）、ライン（線とラベル）、
   * ポイント（円、アイコン、ラベル）の各レイヤーを設定し、あわせてクリック時のポップアップも登録します。
   *
   * 地図コンテナの `data-lng` および `data-lat` 属性がいずれも指定されていない場合は、
   * ソースの読み込み完了を待って、そのソースの `bounds` に一度だけ地図の表示範囲を合わせます
   * （`padding` は 30、アニメーションなし）。
   *
   * @param map レイヤーを追加する対象の地図インスタンスです。
   *
   * @example
   * ```typescript
   * new SimpleStyleVector(url).addTo(map);
   * ```
   */
  addTo(map: MaplibreMap) {
    const container = map.getContainer();

    if (
      !container.dataset ||
      (!container.dataset.lng && !container.dataset.lat)
    ) {
      let initialZoomDone = false;
      map.on("sourcedata", (event: MapSourceDataEvent) => {
        // skip events for sources that don't concern us
        if (event.sourceId !== this.sourceName) {
          return;
        }

        const source = map.getSource(event.sourceId);
        // query the map to see if the source is actually loaded or not. We can't trust `isSourceLoaded` in the event
        // because it's unreliable and often incorrect.
        const isLoaded = source?.loaded();

        if (isLoaded !== true) {
          return;
        }

        // Only zoom once.
        if (initialZoomDone) {
          return;
        }
        initialZoomDone = true;

        map.fitBounds(
          (source as unknown as { bounds: [number, number, number, number] })
            .bounds,
          {
            duration: 0,
            padding: 30,
          },
        );
      });
    }

    map.addSource(this.sourceName, {
      type: "vector",
      url: this.url,
    });

    this.setPolygonGeometries(map);
    this.setLineGeometries(map);

    map.addLayer({
      id: "vt-geolonia-simple-style-polygon-symbol",
      type: "symbol",
      source: this.sourceName,
      "source-layer": "g-simplestyle-v1",
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

    map.addLayer({
      id: "vt-geolonia-simple-style-linestring-symbol",
      type: "symbol",
      source: this.sourceName,
      "source-layer": "g-simplestyle-v1",
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

    this.setPointGeometries(map);
  }

  /**
   * ポリゴンジオメトリ用のレイヤーを設定します。
   *
   * `$type` が `Polygon` のフィーチャーに対して塗り潰しレイヤー（`fill` タイプ）を追加します。
   * 塗り色はフィーチャーの `fill` プロパティ、不透明度は `fill-opacity`、
   * 外周線の色は `stroke` プロパティを用い、いずれも未指定の場合は既定値を適用します。
   * あわせて、このポリゴンレイヤーにクリック時のポップアップを登録します。
   *
   * @param map レイヤーを追加する対象の地図インスタンスです。
   */
  setPolygonGeometries(map: MaplibreMap) {
    map.addLayer({
      id: "vt-geolonia-simple-style-polygon",
      type: "fill",
      source: this.sourceName,
      "source-layer": "g-simplestyle-v1",
      filter: ["==", "$type", "Polygon"],
      paint: {
        "fill-color": ["string", ["get", "fill"], backgroundColor],
        "fill-opacity": ["number", ["get", "fill-opacity"], 1.0],
        "fill-outline-color": ["string", ["get", "stroke"], strokeColor],
      },
    });

    this.setPopup(map, "vt-geolonia-simple-style-polygon");
  }

  /**
   * ラインジオメトリ用のレイヤーを設定します。
   *
   * `$type` が `LineString` のフィーチャーに対して線レイヤー（`line` タイプ）を追加します。
   * 線幅はフィーチャーの `stroke-width` プロパティ、線色は `stroke`、
   * 不透明度は `stroke-opacity` を用い、いずれも未指定の場合は既定値を適用します。
   * 線の端点と結合部はいずれも丸め（`round`）で描画します。
   * あわせて、このラインレイヤーにクリック時のポップアップを登録します。
   *
   * @param map レイヤーを追加する対象の地図インスタンスです。
   */
  setLineGeometries(map: MaplibreMap) {
    map.addLayer({
      id: "vt-geolonia-simple-style-linestring",
      type: "line",
      source: this.sourceName,
      "source-layer": "g-simplestyle-v1",
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

    this.setPopup(map, "vt-geolonia-simple-style-linestring");
  }

  /**
   * ポイントジオメトリ用のレイヤーを設定します。
   *
   * 2 つのレイヤーを追加します。1 つは `marker-symbol` を持たないポイント向けの円レイヤー
   * （`circle` タイプ）で、半径はフィーチャーの `marker-size`（`small` は 7、`large` は 13、
   * それ以外は 9）に応じて変化し、色は `marker-color`、外周線は `stroke` 系プロパティを用います。
   * もう 1 つはすべてのポイント向けのシンボルレイヤー（`symbol` タイプ）で、`marker-symbol` を
   * アイコン画像として、`title` をラベルとして表示します。ラベルの位置は `marker-size` に応じて調整します。
   * あわせて、円レイヤーとシンボルレイヤーの両方にクリック時のポップアップを登録します。
   *
   * @param map レイヤーを追加する対象の地図インスタンスです。
   */
  setPointGeometries(map: MaplibreMap) {
    map.addLayer({
      id: "vt-circle-simple-style-points",
      type: "circle",
      source: this.sourceName,
      "source-layer": "g-simplestyle-v1",
      filter: ["all", ["==", "$type", "Point"], ["!has", "marker-symbol"]],
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

    map.addLayer({
      id: "vt-geolonia-simple-style-points",
      type: "symbol",
      source: this.sourceName,
      "source-layer": "g-simplestyle-v1",
      filter: ["==", "$type", "Point"],
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
        "text-anchor": "top",
        "text-max-width": 12,
        "text-offset": [
          "case",
          ["==", "small", ["get", "marker-size"]],
          ["literal", [0, 1]],
          ["==", "large", ["get", "marker-size"]],
          ["literal", [0, 1.6]],
          ["literal", [0, 1.2]],
        ],
        "text-allow-overlap": false,
      },
    });

    this.setPopup(map, "vt-circle-simple-style-points");
    this.setPopup(map, "vt-geolonia-simple-style-points");
  }

  /**
   * 指定したレイヤーにクリック時のポップアップ表示を設定します。
   *
   * 対象レイヤーのフィーチャーがクリックされると、そのフィーチャーの中心座標
   * （`@turf/center` で算出）にポップアップを表示します。ポップアップの内容は、
   * フィーチャーの `description` プロパティをサニタイズした HTML です。`description` を
   * 持たないフィーチャーではポップアップを表示しません。あわせて、`description` を持つ
   * フィーチャーにマウスが乗ったときはカーソルをポインターに変更し、離れたときに元へ戻します。
   *
   * @param map イベントを登録する対象の地図インスタンスです。
   * @param source ポップアップを設定する対象のレイヤー ID です。
   * @returns イベントリスナーの登録が完了すると解決する Promise です。
   */
  async setPopup(map: MaplibreMap, source: string) {
    map.on("click", source, async (e: MapLayerMouseEvent) => {
      if (!e.features?.[0]) return;
      const center: [number, number] = turfCenter(e.features[0]).geometry
        .coordinates as [number, number];
      const description = e.features[0].properties?.description;

      if (description) {
        const sanitizedDescription = await sanitizeDescription(description);
        new maplibregl.Popup()
          .setLngLat(center)
          .setHTML(sanitizedDescription)
          .addTo(map);
      }
    });

    map.on("mouseenter", source, (e: MapLayerMouseEvent) => {
      if (e.features?.[0]?.properties?.description) {
        map.getCanvas().style.cursor = "pointer";
      }
    });

    map.on("mouseleave", source, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

export default SimpleStyleVector;
