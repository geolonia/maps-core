import type {
  ControlPosition,
  MapOptions,
  RequestTransformFunction,
} from "maplibre-gl";

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
   * 省略時は共有キーリングの現在のステージを使う。別の地図が `stage` を指定してキーリングを変更済みの場合は、その値になる。
   * @defaultValue `'v1'`（キーリングの初期値）
   */
  stage?: string;
  /**
   * 地図スタイル。Geolonia のスタイル論理名（`'geolonia/basic-v2'`）、
   * style.json の完全な URL、または相対パスのいずれか。
   * @defaultValue `'geolonia/basic-v2'`
   */
  style?: string;
  /**
   * リクエストを送る直前に URL やヘッダーを書き換える関数。MapLibre の `transformRequest` と同じ形。
   *
   * Geolonia のソース（`api.geolonia.com` と Geolonia のタイルホスト）とスプライトのリクエストでは、
   * maps-core が `key` や `sessionId` を付けた後の URL が渡される。
   * `undefined` を返すと maps-core の変換結果がそのまま使われる。
   * Promise を返してもよい。解決値が `undefined` のときも maps-core の変換結果が使われる。
   *
   * `map.setTransformRequest()` で差し替えると maps-core の変換も外れる。後から変えるときは、
   * maps-core が付ける `key` や `sessionId` を自分で付ける必要がある。
   */
  transformRequest?: RequestTransformFunction | null;
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
  /**
   * `geojson` のポリゴンを、プロパティの値で塗り分ける（コロプレス）。
   * プロパティ名の文字列、または {@link ChoroplethOptions} を指定する。
   * 地物の simplestyle の `fill` より優先する。地物に `fill-opacity` がないときの不透明度は、
   * 背景の地図が透けるよう 1 ではなく 0.7 にする。
   */
  choropleth?: string | ChoroplethOptions;
  /**
   * `geojson` のポイントをヒートマップで描く。`true` で重みなし、
   * プロパティ名の文字列でその値を重みにする。{@link HeatmapOptions} も指定できる。
   * 指定するとクラスタリングとポイントのマーカーは表示しない。
   */
  heatmap?: boolean | string | HeatmapOptions;
  /**
   * `geojson` のポイントの円の大きさと色を、プロパティの値で変える。
   * 指定するとクラスタリングは行わず、`marker-symbol` を持つポイントも円で描く（アイコンとタイトルは表示しない）。
   * 地物の simplestyle の `marker-color` より優先する。
   */
  circle?: CircleOptions;
  /** SimpleStyle Vector で表示するベクトルタイルの URL または論理名。 */
  simpleVector?: string;
  /**
   * 3D モード（対応スタイルの建物などの 3D 表示）を有効にするかどうか。
   * @defaultValue `false`
   */
  "3d"?: boolean;
  /**
   * 地図の初期化に失敗したときに表示する文言。
   * 文字列を指定するとその文言に差し替える（HTML としては解釈しない）。
   * `false` または `'off'` を指定するとエラー表示自体を行わない。
   * 未指定のときは、原因と利用者が試せる復旧手順を示す既定の案内を表示する。
   */
  errorMessage?: string | false;
};

/**
 * {@link GeoloniaMapOptions.choropleth} の詳細な指定。
 */
export type ChoroplethOptions = {
  /** 塗り分けに使うプロパティ名。値が数値の地物だけを塗り分ける。 */
  property: string;
  /**
   * 値の小さい側から大きい側へ並べた色。値の範囲に等間隔で割り当て、間は補間する。
   * @defaultValue `['#FFF2CC', '#FFAB40', '#EA5C0D', '#B3261E']`
   */
  colors?: string[];
  /** 色を割り当てる値の範囲 `[最小, 最大]`。省略するとデータの最小値と最大値を使う。 */
  range?: [number, number];
};

/**
 * {@link GeoloniaMapOptions.heatmap} の詳細な指定。
 */
export type HeatmapOptions = {
  /** 重みに使うプロパティ名。データの最小値を 0、最大値を 1 として扱う。省略するとすべて同じ重み。 */
  weight?: string;
  /**
   * 密度の低い側から高い側へ並べた色。密度 0 は透明になる。
   * @defaultValue `['#FABF3D', '#FFAB40', '#EA5C0D', '#B3261E']`
   */
  colors?: string[];
};

/**
 * {@link GeoloniaMapOptions.circle} の指定。
 */
export type CircleOptions = {
  /** 円の大きさに使うプロパティ名。データの範囲を半径 3 から 11 ピクセルに対応させる。 */
  size?: string;
  /**
   * 円の色に使うプロパティ名。値がすべて数値なら連続した色に、
   * そうでなければ値ごとに別の色にする。`"12"` のような数字の文字列もカテゴリとして扱う。
   * オブジェクトや配列の値は色分けしない。
   */
  color?: string;
  /** `color` に使う色。数値なら小さい側から大きい側へ、カテゴリなら出現順に割り当てる。 */
  colors?: string[];
};
