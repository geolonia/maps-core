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
   * コンパスは地図の傾きも表し、クリックすると向きと傾きの両方を戻す。
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
   * 地図の投影。`'globe'` で地球儀、`'mercator'` で平面の地図にする。
   *
   * 投影は MapLibre ではスタイルの設定なので、スタイルを適用するたびにこの値を指定し直す。
   * スタイルを適用するのは、`setStyle`（差分の適用か作り直しかによらない）と、WebGL のコンテキストの復元と
   * Worker の再起動（MapLibre 6.16 以降）で MapLibre がスタイルを作り直すときである。
   *
   * できるときは、適用する前にスタイルの `projection` に書き込むので、途中でスタイルの投影に切り替わらない。
   * 書き込むのは、スタイルのオブジェクト（復元で作り直すスタイルを含む）、利用者が渡した `transformStyle` が返したスタイル、
   * 今のスタイルの読み込みが終わった後に `setStyle` に渡した URL のスタイルである。地図を作るときに渡した
   * `transformStyle` は、MapLibre 6.16 以降でだけ使われる。
   * それ以外（最初のスタイル、前のスタイルの読み込み中に渡した URL のスタイルなど）は、読み込んだ後に `setProjection` で
   * 指定し直す。このときは、スタイルの投影が違えば、いったんそれに切り替わる。
   *
   * この値を指定し直すときは、スタイル自身の `projection` と、`transformStyle` が返したスタイルの `projection` より優先する。
   * 地図を作った後に `setProjection` で変えた投影は、次にスタイルを適用したときにこの値へ戻る。
   * MapLibre がスタイルを適用しなかったとき（差分の適用で、カメラの値のほかに違いが無いとき）は、投影はそのまま。
   * 未指定のときは、スタイルの `projection`（無ければ mercator）のまま。JavaScript から `null` を渡したときも未指定として扱う。
   * それ以外の値は `console.error` に出して無視する。
   */
  projection?: "mercator" | "globe";
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
   * 数値の値は連続した色で、`colors` に {@link ColorMap} を渡したときは値ごとの色で塗る。
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
  /**
   * `geojson` のポリゴンを、プロパティの値に応じた高さで立体的に描く。
   * プロパティ名の文字列を渡すと、そのプロパティで高さと色の両方を決める。
   * 高さと色を別のプロパティにするときは {@link ExtrusionOptions} を指定する。
   * 地物の simplestyle の `fill` と `choropleth` より優先する。立体に見せるには `pitch` も指定する。
   */
  extrusion?: string | ExtrusionOptions;
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
 * 値と色の対応表。キーを値、値を色（CSS カラー文字列）とする。
 * 地物の値は文字列にしてキーと照合する。`{ 1: "#..." }` のような数値のキーは、値 `1` にも `"1"` にも一致する。
 * 対応表に無い値の地物は、地物の simplestyle の色（`circle` は `marker-color`、`choropleth` と `extrusion` は `fill`）、
 * それも無ければ既定の色で塗る。有効な項目が 1 つも無いときは、すべての地物をこの色で塗る（空の配列が既定の配色になるのとは違う）。
 * 空文字のキーは、値が空文字の地物にだけ一致し、プロパティを持たない地物と値が null の地物には一致しない。
 * 色が空文字の項目と、色が文字列でない項目は無視する。
 * 色の文字列が CSS カラーとして正しいかは検査しない。残った項目の色はすべて式に入るので、解釈できない色が 1 つでもあると、MapLibre が式全体を受け付けない。
 *
 * @example
 * ```typescript
 * { normal: "#3b82f6", warning: "#eab308", danger: "#ef4444" }
 * ```
 */
export type ColorMap = Record<string, string>;

/**
 * {@link GeoloniaMapOptions.choropleth} の詳細な指定。
 */
export type ChoroplethOptions = {
  /**
   * 塗り分けに使うプロパティ名。`colors` が配列か省略なら値が数値の地物だけを塗り分け、
   * {@link ColorMap} なら対応表にある値の地物を塗り分ける。
   */
  property: string;
  /**
   * 配列なら、値の小さい側から大きい側へ並べた色。値の範囲に等間隔で割り当て、間は補間する。
   * {@link ColorMap} なら、値ごとの色。
   * @defaultValue `['#FFF2CC', '#FFAB40', '#EA5C0D', '#B3261E']`
   */
  colors?: string[] | ColorMap;
  /** 色を割り当てる値の範囲 `[最小, 最大]`。省略するとデータの最小値と最大値を使う。`colors` が {@link ColorMap} のときは使わない。 */
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
   * オブジェクトや配列の値は色分けしない。`colors` に {@link ColorMap} を渡したときは、値の種類によらず対応表のとおりに塗る（照合の規則は {@link ColorMap} を参照）。
   */
  color?: string;
  /**
   * `color` に使う色。配列なら、数値は小さい側から大きい側へ、カテゴリは出現順に割り当てる。
   * {@link ColorMap} なら、値の種類によらず対応表のとおりに割り当てる（照合の規則は {@link ColorMap} を参照）。
   */
  colors?: string[] | ColorMap;
};

/**
 * {@link GeoloniaMapOptions.extrusion} の詳細な指定。
 */
export type ExtrusionOptions = {
  /** 高さに使うプロパティ名、または {@link ExtrusionHeightOptions}。 */
  height: string | ExtrusionHeightOptions;
  /** 色に使うプロパティ名、または {@link ExtrusionColorOptions}。省略すると `height` と同じプロパティで色分けする。 */
  color?: string | ExtrusionColorOptions;
};

/**
 * {@link ExtrusionOptions.height} の詳細な指定。
 * 高さは `heightScale` を指定すれば「値 × `heightScale`」、指定しなければ `range` を 0 から `maxHeight` に比例して割り当てる。
 * 値が数値でない地物の高さは 0 にする。
 */
export type ExtrusionHeightOptions = {
  /** 高さに使うプロパティ名。 */
  property: string;
  /**
   * `range` の最大値に割り当てる高さ（メートル）。`heightScale` を指定したときは使わない。
   * @defaultValue `3000`
   */
  maxHeight?: number;
  /**
   * 値 1 あたりの高さ（メートル）。データの範囲によらず高さが決まるので、複数の地図で同じ値を同じ高さにして比べられる。
   * 「値 × `heightScale`」が負になる地物の高さは 0 にする。
   */
  heightScale?: number;
  /**
   * 高さ 0 から `maxHeight` に割り当てる値の範囲 `[最小, 最大]`。
   * 省略したとき、または最小が最大以上のときは、データの最小値が 0 以上なら `[0, 最大値]`、負なら `[最小値, 最大値]` を使う。
   */
  range?: [number, number];
};

/**
 * {@link ExtrusionOptions.color} の詳細な指定。
 * 値がすべて数値なら連続した色に、そうでなければ値ごとのカテゴリの色にする（{@link CircleOptions.color} と同じ）。
 * `colors` に {@link ColorMap} を渡したときは、値の種類によらず対応表のとおりにする（照合の規則は {@link ColorMap} を参照）。
 */
export type ExtrusionColorOptions = {
  /** 色に使うプロパティ名。 */
  property: string;
  /**
   * 色。配列なら、数値は小さい側から大きい側へ並べて値の範囲に等間隔で割り当て、カテゴリは出現順に割り当てる。
   * {@link ColorMap} なら、値の種類によらず対応表のとおりに割り当てる（照合の規則は {@link ColorMap} を参照）。
   * @defaultValue 数値は `['#FFF2CC', '#FFAB40', '#EA5C0D', '#B3261E']`
   */
  colors?: string[] | ColorMap;
  /** 数値の色を割り当てる値の範囲 `[最小, 最大]`。省略するとデータの最小値と最大値を使う。`colors` が {@link ColorMap} のときは使わない。 */
  range?: [number, number];
};
