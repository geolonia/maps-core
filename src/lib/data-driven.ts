/**
 * 地物のプロパティの値で色や大きさを変える、データ駆動スタイルの式を組み立てます。
 * {@link SimpleStyle} の `choropleth`、`heatmap`、`circle` オプションから使います。
 */

import type { ExpressionSpecification } from "maplibre-gl";
import type {
  ChoroplethOptions,
  CircleOptions,
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

/** `circle.size` を指定したときの円の半径の範囲（ピクセル）です。 */
const CIRCLE_RADIUS_RANGE: [number, number] = [3, 11];

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

/** 数値のプロパティを連続した色に対応させます。数値が 1 つもないときは `fallback` を返します。 */
function sequentialColor(
  property: string,
  features: GeoJSON.Feature[],
  colors: string[],
  fallback: Expression,
  range?: [number, number],
): Expression {
  const r = range ?? numericRange(features, property);
  if (!r) return fallback;
  return whenNumber(property, interpolate(property, r, colors), fallback);
}

/** コロプレスの塗りの色の式です。 */
export function choroplethColor(
  option: ChoroplethOptions,
  features: GeoJSON.Feature[],
  fallback: Expression,
): Expression {
  return sequentialColor(
    option.property,
    features,
    option.colors ?? SEQUENTIAL_COLORS,
    fallback,
    option.range,
  );
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
  const colors = option.colors ?? HEATMAP_COLORS;
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
 * 円の色の式です。`color` の値がすべて数値なら連続した色に、
 * そうでなければ値ごとのカテゴリの色にします。
 */
export function circleColor(
  option: CircleOptions,
  features: GeoJSON.Feature[],
  fallback: Expression,
): Expression {
  const property = option.color;
  if (!property) return fallback;

  const values = features
    .map((f) => f.properties?.[property])
    .filter((v) => v !== undefined && v !== null);
  if (values.length === 0) return fallback;

  if (values.every((v) => typeof v === "number")) {
    return sequentialColor(
      property,
      features,
      option.colors ?? SEQUENTIAL_COLORS,
      fallback,
    );
  }

  const colors = option.colors ?? CATEGORICAL_COLORS;
  const categories = [...new Set(values.map(String))];
  return [
    "match",
    ["to-string", ["get", property]],
    ...categories.flatMap((c, i) => [c, colors[i % colors.length]]),
    fallback,
  ] as ExpressionSpecification;
}
