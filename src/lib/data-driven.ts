/**
 * 地物のプロパティの値で色や大きさを変える、データ駆動スタイルの式を組み立てます。
 * {@link SimpleStyle} の `choropleth`、`heatmap`、`circle`、`extrusion` オプションから使います。
 */

import type { ExpressionSpecification } from "maplibre-gl";
import type {
  ChoroplethOptions,
  CircleOptions,
  ColorMap,
  ExtrusionColorOptions,
  ExtrusionHeightOptions,
  ExtrusionOptions,
  HeatmapOptions,
} from "../types";

type Expression = ExpressionSpecification | string | number;

/** 数値を色分けするときの既定の配色です（薄い黄から濃い赤）。 */
export const SEQUENTIAL_COLORS = ["#FFF2CC", "#FFAB40", "#EA5C0D", "#B3261E"];

/** ヒートマップの既定の配色です。密度 0 は透明にし、その上にこの色を並べます。 */
export const HEATMAP_COLORS = ["#FABF3D", "#FFAB40", "#EA5C0D", "#B3261E"];

/** カテゴリを色分けするときの既定の配色です。カテゴリが多いときは繰り返します。 */
export const CATEGORICAL_COLORS = [
  "#EA5C0D",
  "#2B6CB0",
  "#FABF3D",
  "#5B8C2A",
  "#9A5B1E",
  "#7A4FA0",
  "#E8402F",
  "#6B7280",
];

/** `extrusion` の `maxHeight` の既定値（メートル）です。 */
export const DEFAULT_EXTRUSION_MAX_HEIGHT = 3000;

/** `circle.size` を指定したときの円の半径の範囲（ピクセル）です。 */
const CIRCLE_RADIUS_RANGE: [number, number] = [3, 11];

/** `colors` が配列でなければ、または空なら `defaults` を返します。 */
function colorsOr(
  colors: string[] | ColorMap | undefined,
  defaults: string[],
): string[] {
  return Array.isArray(colors) && colors.length ? colors : defaults;
}

/** `colors` が値と色の対応表（配列でないオブジェクト）かどうかです。 */
function isColorMap(
  colors: string[] | ColorMap | undefined,
): colors is ColorMap {
  return (
    typeof colors === "object" && colors !== null && !Array.isArray(colors)
  );
}

/**
 * 値と色の割り当てです。地図の式はこの割り当てから組み立てます。
 *
 * - `sequential`: 数値の値を `range` の中で `colors` に線形に補間します。
 * - `categorical`: 値を文字列にして `entries` の値と照合し、一致した色にします。
 */
type ColorScale =
  | {
      type: "sequential";
      property: string;
      range: [number, number];
      colors: string[];
    }
  | { type: "categorical"; property: string; entries: [string, string][] };

/** 割り当てから地図の式を組み立てます。割り当てが無いときや、割り当てに一致しない地物は `fallback` にします。 */
function colorExpression(
  scale: ColorScale | undefined,
  fallback: Expression,
): Expression {
  if (!scale) return fallback;
  if (scale.type === "sequential") {
    return whenNumber(
      scale.property,
      interpolate(scale.property, scale.range, scale.colors),
      fallback,
    );
  }
  return [
    "match",
    ["to-string", ["get", scale.property]],
    ...scale.entries.flat(),
    fallback,
  ] as ExpressionSpecification;
}

/** 数値の値を連続した色に割り当てます。数値が 1 つもないときは割り当てを作りません。 */
function sequentialScale(
  property: string,
  features: GeoJSON.Feature[],
  colors: string[],
  range?: [number, number],
): ColorScale | undefined {
  const r = range ?? numericRange(features, property);
  return r && { type: "sequential", property, range: r, colors };
}

/**
 * 値と色の対応表から割り当てを作ります。キーは値を文字列にしたものと照合します。
 * 色が文字列でない項目は、型のない呼び出し元から渡されても地図の初期化を止めないよう無視します。
 * 有効な項目が 1 つもないときは割り当てを作りません。
 */
function colorMapScale(
  property: string,
  colors: ColorMap,
): ColorScale | undefined {
  const entries = Object.entries(colors).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1] !== "",
  );
  return entries.length
    ? { type: "categorical", property, entries }
    : undefined;
}

/** `choropleth` オプションを {@link ChoroplethOptions} にそろえます。 */
export function normalizeChoropleth(
  option: string | ChoroplethOptions | undefined,
): ChoroplethOptions | undefined {
  if (!option) return undefined;
  return typeof option === "string" ? { property: option } : option;
}

/** `heatmap` オプションを {@link HeatmapOptions} にそろえます。 */
export function normalizeHeatmap(
  option: boolean | string | HeatmapOptions | undefined,
): HeatmapOptions | undefined {
  if (!option) return undefined;
  if (option === true) return {};
  return typeof option === "string" ? { weight: option } : option;
}

/** `extrusion` オプションを、高さと色それぞれの詳細な指定にそろえます。 */
export function normalizeExtrusion(
  option: string | ExtrusionOptions | undefined,
):
  | { height: ExtrusionHeightOptions; color: ExtrusionColorOptions }
  | undefined {
  if (!option) return undefined;
  if (typeof option === "string") {
    return { height: { property: option }, color: { property: option } };
  }
  // 型のない呼び出し元から height なしで渡されても、地図の初期化を止めない
  if (!option.height) return undefined;
  const height =
    typeof option.height === "string"
      ? { property: option.height }
      : option.height;
  const color =
    typeof option.color === "string"
      ? { property: option.color }
      : (option.color ?? { property: height.property });
  return { height, color };
}

/** `property` の値のうち数値だけを見て、最小値と最大値を返します。 */
export function numericRange(
  features: GeoJSON.Feature[],
  property: string,
): [number, number] | undefined {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const f of features) {
    const v = f.properties?.[property];
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max ? [min, max] : undefined;
}

/**
 * `property` の値を `range` の中で線形に補間し、`outputs` の値に対応させます。
 * `outputs` は範囲の両端の間に等間隔で並べます。範囲の幅が 0 のときは、補間できないので最後の値を返します。
 */
function interpolate<T extends string | number>(
  property: string,
  range: [number, number],
  outputs: T[],
): ExpressionSpecification | T {
  const [min, max] = range;
  if (!(min < max) || outputs.length < 2) return outputs[outputs.length - 1];
  const stops = outputs.flatMap((out, i) => [
    min + ((max - min) * i) / (outputs.length - 1),
    out,
  ]);
  return [
    "interpolate",
    ["linear"],
    ["get", property],
    ...stops,
  ] as ExpressionSpecification;
}

/** 値が数値の地物にだけ `expr` を使い、それ以外は `fallback` にします。 */
function whenNumber(
  property: string,
  expr: Expression,
  fallback: Expression,
): Expression {
  return [
    "case",
    ["==", ["typeof", ["get", property]], "number"],
    expr,
    fallback,
  ] as ExpressionSpecification;
}

/**
 * コロプレスの塗りの色の式です。`colors` が値と色の対応表なら値ごとの色に、
 * そうでなければ数値の値を連続した色にします。
 */
export function choroplethColor(
  option: ChoroplethOptions,
  features: GeoJSON.Feature[],
  fallback: Expression,
): Expression {
  const scale = isColorMap(option.colors)
    ? colorMapScale(option.property, option.colors)
    : sequentialScale(
        option.property,
        features,
        colorsOr(option.colors, SEQUENTIAL_COLORS),
        option.range,
      );
  return colorExpression(scale, fallback);
}

/** ヒートマップの重みの式です。重みはデータの範囲を 0 から 1 に対応させます。 */
export function heatmapWeight(
  option: HeatmapOptions,
  features: GeoJSON.Feature[],
): Expression {
  if (!option.weight) return 1;
  const range = numericRange(features, option.weight);
  if (!range || !(range[0] < range[1])) return 1;
  return whenNumber(
    option.weight,
    interpolate(option.weight, range, [0, 1]),
    0,
  );
}

/** ヒートマップの密度に対する色の式です。 */
export function heatmapColor(option: HeatmapOptions): ExpressionSpecification {
  const colors = colorsOr(option.colors, HEATMAP_COLORS);
  const stops = colors.flatMap((c, i) => [(i + 1) / colors.length, c]);
  return [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "rgba(0, 0, 0, 0)",
    ...stops,
  ] as ExpressionSpecification;
}

/** 円の半径の式です。`size` を指定しないときは `fallback` を返します。 */
export function circleRadius(
  option: CircleOptions,
  features: GeoJSON.Feature[],
  fallback: Expression,
): Expression {
  if (!option.size) return fallback;
  const range = numericRange(features, option.size);
  if (!range) return fallback;
  return whenNumber(
    option.size,
    interpolate(option.size, range, CIRCLE_RADIUS_RANGE),
    fallback,
  );
}

/**
 * `property` の値で色分けする割り当てです。`colors` が値と色の対応表ならその対応に、
 * そうでなければ、値がすべて数値なら連続した色に、それ以外は値ごとのカテゴリの色にします。
 */
function propertyColorScale(
  property: string,
  features: GeoJSON.Feature[],
  colors: string[] | ColorMap | undefined,
  range?: [number, number],
): ColorScale | undefined {
  if (isColorMap(colors)) return colorMapScale(property, colors);

  const values = features
    .map((f) => f.properties?.[property])
    // オブジェクトや配列は MapLibre の to-string と JS の String() で文字列が変わるので、カテゴリにしない
    .filter((v) => ["string", "number", "boolean"].includes(typeof v));
  if (values.length === 0) return undefined;

  if (values.every((v) => typeof v === "number")) {
    return sequentialScale(
      property,
      features,
      colorsOr(colors, SEQUENTIAL_COLORS),
      range,
    );
  }

  const palette = colorsOr(colors, CATEGORICAL_COLORS);
  const categories = [...new Set(values.map(String))];
  return {
    type: "categorical",
    property,
    entries: categories.map((c, i) => [c, palette[i % palette.length]]),
  };
}

/**
 * 円の色の式です。`color` の値がすべて数値なら連続した色に、
 * そうでなければ値ごとのカテゴリの色にします。
 */
export function circleColor(
  option: CircleOptions,
  features: GeoJSON.Feature[],
  fallback: Expression,
): Expression {
  if (!option.color) return fallback;
  return colorExpression(
    propertyColorScale(option.color, features, option.colors),
    fallback,
  );
}

/**
 * 立体の高さ（メートル）の式です。`heightScale` があれば「値 × `heightScale`」に、
 * なければ値の範囲を 0 から `maxHeight` に割り当てます。値が数値でない地物は 0 にします。
 * `fill-extrusion-height` は負の値を取れないので、負になる高さは 0 にします。
 * `range` の最小が最大以上のときは、指定がないものとしてデータから範囲を求めます。
 */
export function extrusionHeight(
  option: ExtrusionHeightOptions,
  features: GeoJSON.Feature[],
): Expression {
  const { property } = option;
  if (option.heightScale !== undefined) {
    return whenNumber(
      property,
      [
        "max",
        0,
        ["*", ["get", property], option.heightScale],
      ] as ExpressionSpecification,
      0,
    );
  }
  let range = option.range;
  if (!range || !(range[0] < range[1])) {
    const data = numericRange(features, property);
    // 柱の高さが値に比例するよう、値が 0 以上なら 0 から数える
    range = data && [Math.min(0, data[0]), data[1]];
  }
  if (!range || !(range[0] < range[1])) return 0;
  return whenNumber(
    property,
    interpolate(property, range, [
      0,
      option.maxHeight ?? DEFAULT_EXTRUSION_MAX_HEIGHT,
    ]),
    0,
  );
}

/** 立体の色の式です。{@link circleColor} と同じく、数値なら連続した色、それ以外はカテゴリの色にします。 */
export function extrusionColor(
  option: ExtrusionColorOptions,
  features: GeoJSON.Feature[],
  fallback: Expression,
): Expression {
  return colorExpression(
    propertyColorScale(option.property, features, option.colors, option.range),
    fallback,
  );
}
