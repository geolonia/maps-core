import type { ControlPosition, MapOptions } from "maplibre-gl";

/**
 * {@link GeoloniaMap} のコンストラクタに渡すオプション。
 *
 * MapLibre GL JS の `MapOptions` を拡張し、Geolonia 固有の設定
 * （API キー、スタイル、マーカー、各種コントロール、GeoJSON 表示など）を
 * 追加したものである。`container` や `center`、`zoom` などの基本オプションは
 * MapLibre の `MapOptions` から継承する。
 *
 * @example
 * ```typescript
 * import { GeoloniaMap } from "@geolonia/maps-core";
 *
 * const map = new GeoloniaMap({
 *   container: "#map",
 *   apiKey: "YOUR-API-KEY",
 *   style: "geolonia/basic-v2",
 *   center: [139.7671, 35.6812],
 *   zoom: 14,
 *   lang: "ja",
 * });
 * ```
 */
export type GeoloniaMapOptions = MapOptions & {
  /**
   * Geolonia の API キー。Geolonia がホストするスタイルやタイルを使う場合に必要。
   * 指定するとキーリングにも設定される。
   */
  apiKey?: string;
  /**
   * API のステージ（`'dev'` / `'v1'` など）。API エンドポイントの選択に使う。
   * @defaultValue `'dev'`
   */
  stage?: string;
  /**
   * 地図スタイル。Geolonia のスタイル論理名（`'geolonia/basic-v2'`）、
   * style.json の完全な URL、または相対パスのいずれか。
   * @defaultValue `'geolonia/basic-v2'`
   */
  style?: string;
  /**
   * ラベルの言語。`'ja'` / `'en'` / `'auto'`（ブラウザ言語に従う）。
   * `'auto'` または未指定のときは `getLang()` の結果（`'ja'` または `'en'`）になる。
   * @defaultValue `'auto'`
   */
  lang?: "ja" | "en" | "auto";
  /**
   * 中心にデフォルトマーカーを表示するかどうか。`center` が指定されている場合にのみ
   * 実際に表示される。
   */
  marker?: boolean;
  /** マーカーの色（CSS カラー文字列）。 */
  markerColor?: string;
  /** 読み込み時にマーカーのポップアップを自動的に開くかどうか。 */
  openPopup?: boolean;
  /** マーカーとして使うカスタム要素の CSS セレクタ。 */
  customMarker?: string;
  /** カスタムマーカーのオフセット。`[x, y]` のピクセル値。 */
  customMarkerOffset?: [number, number];
  /**
   * 地図の読み込み中にローディングアニメーションを表示するかどうか。
   * @defaultValue `true`
   */
  loader?: boolean;
  /**
   * スクロール可能なページでジェスチャ操作（2本指での地図操作の要求など）を
   * 有効にするかどうか。
   * @defaultValue `true`
   */
  gestureHandling?: boolean;
  /**
   * ズームと回転のコントロール。`true` / `false`、または表示位置
   * （`'top-right'`、`'bottom-left'` など）を指定する。
   * @defaultValue `true`
   */
  navigationControl?: boolean | ControlPosition;
  /**
   * 現在地コントロール。`true` / `false`、または表示位置を指定する。
   * @defaultValue `false`
   */
  geolocateControl?: boolean | ControlPosition;
  /**
   * 全画面コントロール。`true` / `false`、または表示位置を指定する。
   * @defaultValue `false`
   */
  fullscreenControl?: boolean | ControlPosition;
  /**
   * スケールコントロール。`true` / `false`、または表示位置を指定する。
   * @defaultValue `false`
   */
  scaleControl?: boolean | ControlPosition;
  /**
   * Geolonia のロゴコントロール。`true` / `false`、または表示位置を指定する。
   * @defaultValue `true`
   */
  geoloniaControl?: boolean | ControlPosition;
  /**
   * SimpleStyle で表示する GeoJSON。URL、または GeoJSON オブジェクトを指定する。
   * `center` が未指定のときは、この GeoJSON の範囲に自動的にフィットする。
   */
  geojson?: string | GeoJSON.FeatureCollection;
  /**
   * `geojson` のポイント地物をクラスタリングするかどうか。
   * @defaultValue `true`
   */
  cluster?: boolean;
  /**
   * クラスタマーカーの色。
   * @defaultValue `'#ff0000'`
   */
  clusterColor?: string;
  /** SimpleStyle Vector で表示するベクトルタイルの URL または論理名。 */
  simpleVector?: string;
  /**
   * 3D モード（対応スタイルの建物などの 3D 表示）を有効にするかどうか。
   * @defaultValue `false`
   */
  "3d"?: boolean;
};
