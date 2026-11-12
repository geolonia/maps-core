import {
  Color,
  latest,
  expression as styleExpression,
} from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import {
  CATEGORICAL_COLORS,
  choroplethColor,
  circleColor,
  circleRadius,
  DEFAULT_EXTRUSION_MAX_HEIGHT,
  extrusionColor,
  extrusionHeight,
  heatmapColor,
  heatmapWeight,
  normalizeChoropleth,
  normalizeExtrusion,
  normalizeHeatmap,
  numericRange,
  SEQUENTIAL_COLORS,
} from "../src/lib/data-driven";

const feature = (properties: Record<string, unknown>): GeoJSON.Feature => ({
  type: "Feature",
  properties,
  geometry: { type: "Point", coordinates: [139.77, 35.68] },
});

describe("normalizeChoropleth", () => {
  it("treats a string as the property name", () => {
    expect(normalizeChoropleth("value")).toEqual({ property: "value" });
  });

  it("passes an object through", () => {
    const opt = { property: "value", colors: ["#fff", "#000"] };
    expect(normalizeChoropleth(opt)).toEqual(opt);
  });

  it("returns undefined when not specified", () => {
    expect(normalizeChoropleth(undefined)).toBeUndefined();
    expect(normalizeChoropleth("")).toBeUndefined();
  });
});

describe("normalizeHeatmap", () => {
  it("treats true as an unweighted heatmap", () => {
    expect(normalizeHeatmap(true)).toEqual({});
  });

  it("treats a string as the weight property", () => {
    expect(normalizeHeatmap("weight")).toEqual({ weight: "weight" });
  });

  it("returns undefined for false or nothing", () => {
    expect(normalizeHeatmap(false)).toBeUndefined();
    expect(normalizeHeatmap(undefined)).toBeUndefined();
  });
});

describe("numericRange", () => {
  it("returns min and max of numeric values, ignoring others", () => {
    const features = [
      feature({ v: 10 }),
      feature({ v: -2 }),
      feature({ v: "100" }),
      feature({}),
      feature({ v: 7 }),
    ];
    expect(numericRange(features, "v")).toEqual([-2, 10]);
  });

  it("returns undefined when no value is numeric", () => {
    expect(numericRange([feature({ v: "a" })], "v")).toBeUndefined();
    expect(numericRange([], "v")).toBeUndefined();
  });
});

describe("choroplethColor", () => {
  it("interpolates the colors over the data range", () => {
    const features = [feature({ v: 0 }), feature({ v: 90 })];
    const expr = choroplethColor(
      { property: "v", colors: ["#aaa", "#bbb", "#ccc", "#ddd"] },
      features,
      "red",
    );
    expect(expr).toEqual([
      "case",
      ["==", ["typeof", ["get", "v"]], "number"],
      [
        "interpolate",
        ["linear"],
        ["get", "v"],
        0,
        "#aaa",
        30,
        "#bbb",
        60,
        "#ccc",
        90,
        "#ddd",
      ],
      "red",
    ]);
  });

  it("prefers an explicit range over the data range", () => {
    const expr = choroplethColor(
      { property: "v", colors: ["#aaa", "#ddd"], range: [0, 100] },
      [feature({ v: 50 })],
      "red",
    );
    expect(expr[2]).toEqual([
      "interpolate",
      ["linear"],
      ["get", "v"],
      0,
      "#aaa",
      100,
      "#ddd",
    ]);
  });

  it("uses the default sequential colors", () => {
    const expr = choroplethColor(
      { property: "v" },
      [feature({ v: 0 }), feature({ v: 1 })],
      "red",
    );
    const stops = (expr[2] as unknown[]).slice(3);
    expect(stops.filter((_, i) => i % 2 === 1)).toEqual(SEQUENTIAL_COLORS);
  });

  it("paints every value with the last color when the range is empty", () => {
    const expr = choroplethColor(
      { property: "v", colors: ["#aaa", "#ddd"] },
      [feature({ v: 5 }), feature({ v: 5 })],
      "red",
    );
    expect(expr[2]).toBe("#ddd");
  });

  it("falls back when there is no numeric value", () => {
    expect(choroplethColor({ property: "v" }, [], "red")).toBe("red");
  });
});

describe("heatmapWeight", () => {
  it("weights every point equally without a property", () => {
    expect(heatmapWeight({}, [])).toBe(1);
  });

  it("scales the property to 0..1 over the data range", () => {
    const expr = heatmapWeight({ weight: "w" }, [
      feature({ w: 2 }),
      feature({ w: 8 }),
    ]);
    expect(expr).toEqual([
      "case",
      ["==", ["typeof", ["get", "w"]], "number"],
      ["interpolate", ["linear"], ["get", "w"], 2, 0, 8, 1],
      0,
    ]);
  });

  it("weights every point equally when the range is empty", () => {
    expect(heatmapWeight({ weight: "w" }, [feature({ w: 3 })])).toBe(1);
  });
});

describe("heatmapColor", () => {
  it("starts transparent and spreads the colors over the density", () => {
    expect(heatmapColor({ colors: ["#aaa", "#bbb"] })).toEqual([
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0,
      "rgba(0, 0, 0, 0)",
      0.5,
      "#aaa",
      1,
      "#bbb",
    ]);
  });
});

describe("circleRadius", () => {
  it("returns the fallback without a size property", () => {
    expect(circleRadius({}, [], 9)).toBe(9);
  });

  it("scales the size property over the data range", () => {
    const expr = circleRadius(
      { size: "w" },
      [feature({ w: 0 }), feature({ w: 6 })],
      9,
    );
    expect(expr).toEqual([
      "case",
      ["==", ["typeof", ["get", "w"]], "number"],
      ["interpolate", ["linear"], ["get", "w"], 0, 3, 6, 11],
      9,
    ]);
  });
});

describe("circleColor", () => {
  it("returns the fallback without a color property", () => {
    expect(circleColor({}, [], "red")).toBe("red");
  });

  it("maps string values to categorical colors in order of appearance", () => {
    const features = [
      feature({ c: "カフェ" }),
      feature({ c: "書店" }),
      feature({ c: "カフェ" }),
      feature({}),
    ];
    expect(circleColor({ color: "c" }, features, "red")).toEqual([
      "match",
      ["to-string", ["get", "c"]],
      "カフェ",
      CATEGORICAL_COLORS[0],
      "書店",
      CATEGORICAL_COLORS[1],
      "red",
    ]);
  });

  it("cycles the palette when there are more categories than colors", () => {
    const features = ["a", "b", "c"].map((c) => feature({ c }));
    const expr = circleColor(
      { color: "c", colors: ["#111", "#222"] },
      features,
      "red",
    );
    expect(expr).toEqual([
      "match",
      ["to-string", ["get", "c"]],
      "a",
      "#111",
      "b",
      "#222",
      "c",
      "#111",
      "red",
    ]);
  });

  it("interpolates numeric values with sequential colors", () => {
    const expr = circleColor(
      { color: "v", colors: ["#aaa", "#ddd"] },
      [feature({ v: 1 }), feature({ v: 3 })],
      "red",
    );
    expect(expr).toEqual([
      "case",
      ["==", ["typeof", ["get", "v"]], "number"],
      ["interpolate", ["linear"], ["get", "v"], 1, "#aaa", 3, "#ddd"],
      "red",
    ]);
  });
});

describe("empty colors", () => {
  it("falls back to the default colors", () => {
    const features = [feature({ v: 0 }), feature({ v: 1 })];
    expect(
      choroplethColor({ property: "v", colors: [] }, features, "red"),
    ).toEqual(choroplethColor({ property: "v" }, features, "red"));
    expect(heatmapColor({ colors: [] })).toEqual(heatmapColor({}));
    const cats = [feature({ c: "a" })];
    expect(circleColor({ color: "c", colors: [] }, cats, "red")).toEqual(
      circleColor({ color: "c" }, cats, "red"),
    );
  });
});

describe("circleColor with non-primitive values", () => {
  it("ignores objects and arrays as categories", () => {
    const features = [
      feature({ c: "a" }),
      feature({ c: { x: 1 } }),
      feature({ c: [1] }),
      feature({ c: true }),
    ];
    expect(circleColor({ color: "c" }, features, "red")).toEqual([
      "match",
      ["to-string", ["get", "c"]],
      "a",
      CATEGORICAL_COLORS[0],
      "true",
      CATEGORICAL_COLORS[1],
      "red",
    ]);
  });
});

describe("normalizeExtrusion", () => {
  it("uses a string for both the height and the color", () => {
    expect(normalizeExtrusion("population")).toEqual({
      height: { property: "population" },
      color: { property: "population" },
    });
  });

  it("colors by the height property when color is omitted", () => {
    expect(
      normalizeExtrusion({
        height: { property: "population", maxHeight: 500 },
      }),
    ).toEqual({
      height: { property: "population", maxHeight: 500 },
      color: { property: "population" },
    });
  });

  it("accepts property names for height and color", () => {
    expect(
      normalizeExtrusion({ height: "population", color: "aged_ratio" }),
    ).toEqual({
      height: { property: "population" },
      color: { property: "aged_ratio" },
    });
  });

  it("returns undefined when not specified", () => {
    expect(normalizeExtrusion(undefined)).toBeUndefined();
    expect(normalizeExtrusion("")).toBeUndefined();
    // 型のない呼び出し元から height なしで渡されたとき
    expect(
      normalizeExtrusion({ color: "x" } as unknown as { height: string }),
    ).toBeUndefined();
  });
});

describe("extrusionHeight", () => {
  it("scales from 0 to the data maximum up to the default max height", () => {
    expect(
      extrusionHeight({ property: "v" }, [
        feature({ v: 10 }),
        feature({ v: 40 }),
      ]),
    ).toEqual([
      "case",
      ["==", ["typeof", ["get", "v"]], "number"],
      [
        "interpolate",
        ["linear"],
        ["get", "v"],
        0,
        0,
        40,
        DEFAULT_EXTRUSION_MAX_HEIGHT,
      ],
      0,
    ]);
  });

  it("starts from the data minimum when it is negative", () => {
    const expr = extrusionHeight({ property: "v", maxHeight: 100 }, [
      feature({ v: -10 }),
      feature({ v: 30 }),
    ]) as unknown[];
    expect(expr[2]).toEqual([
      "interpolate",
      ["linear"],
      ["get", "v"],
      -10,
      0,
      30,
      100,
    ]);
  });

  it("prefers an explicit range", () => {
    const expr = extrusionHeight(
      { property: "v", maxHeight: 100, range: [5, 50] },
      [feature({ v: 10 })],
    ) as unknown[];
    expect(expr[2]).toEqual([
      "interpolate",
      ["linear"],
      ["get", "v"],
      5,
      0,
      50,
      100,
    ]);
  });

  it("multiplies the value by heightScale, ignoring maxHeight", () => {
    expect(
      extrusionHeight({ property: "v", heightScale: 0.5, maxHeight: 100 }, [
        feature({ v: 10 }),
      ]),
    ).toEqual([
      "case",
      ["==", ["typeof", ["get", "v"]], "number"],
      ["max", 0, ["*", ["get", "v"], 0.5]],
      0,
    ]);
  });

  it("draws negative scaled heights flat", () => {
    const expr = extrusionHeight({ property: "v", heightScale: -1 }, [
      feature({ v: 10 }),
    ]) as unknown[];
    expect(expr[2]).toEqual(["max", 0, ["*", ["get", "v"], -1]]);
  });

  it("ignores an explicit range whose minimum is not below the maximum", () => {
    const features = [feature({ v: 10 }), feature({ v: 40 })];
    for (const range of [
      [10, 10],
      [40, 0],
    ] as [number, number][]) {
      const expr = extrusionHeight(
        { property: "v", maxHeight: 100, range },
        features,
      ) as unknown[];
      expect(expr[2]).toEqual([
        "interpolate",
        ["linear"],
        ["get", "v"],
        0,
        0,
        40,
        100,
      ]);
    }
  });

  it("is flat when there is no numeric value or the range is empty", () => {
    expect(extrusionHeight({ property: "v" }, [feature({ v: "x" })])).toBe(0);
    expect(extrusionHeight({ property: "v" }, [feature({ v: 0 })])).toBe(0);
  });
});

describe("extrusionColor", () => {
  it("interpolates numeric values over the explicit range", () => {
    const expr = extrusionColor(
      { property: "r", colors: ["#fff", "#000"], range: [0, 0.4] },
      [feature({ r: 0.1 })],
      "#f00",
    ) as unknown[];
    expect(expr[2]).toEqual([
      "interpolate",
      ["linear"],
      ["get", "r"],
      0,
      "#fff",
      0.4,
      "#000",
    ]);
    expect(expr[3]).toBe("#f00");
  });

  it("maps string values to categorical colors", () => {
    const expr = extrusionColor(
      { property: "kind" },
      [feature({ kind: "住宅" }), feature({ kind: "商業" })],
      "#f00",
    ) as unknown[];
    expect(expr).toEqual([
      "match",
      ["to-string", ["get", "kind"]],
      "住宅",
      CATEGORICAL_COLORS[0],
      "商業",
      CATEGORICAL_COLORS[1],
      "#f00",
    ]);
  });
});

describe("colors as a color map", () => {
  const status = { normal: "#3b82f6", warning: "#eab308", danger: "#ef4444" };
  const matchStatus = (property: string, fallback: string) => [
    "match",
    ["to-string", ["get", property]],
    "normal",
    "#3b82f6",
    "warning",
    "#eab308",
    "danger",
    "#ef4444",
    fallback,
  ];

  it("maps circle colors by value, independent of the order in the data", () => {
    const features = [feature({ s: "danger" }), feature({ s: "normal" })];
    expect(
      circleColor({ color: "s", colors: status }, features, "red"),
    ).toEqual(matchStatus("s", "red"));
    expect(
      circleColor(
        { color: "s", colors: status },
        [...features].reverse(),
        "red",
      ),
    ).toEqual(matchStatus("s", "red"));
  });

  it("builds the same match when the data is empty or numeric", () => {
    expect(circleColor({ color: "s", colors: status }, [], "red")).toEqual(
      matchStatus("s", "red"),
    );
    expect(
      circleColor(
        { color: "v", colors: { 1: "#111", 2: "#222" } },
        [feature({ v: 1 }), feature({ v: 2 })],
        "red",
      ),
    ).toEqual([
      "match",
      ["to-string", ["get", "v"]],
      "1",
      "#111",
      "2",
      "#222",
      "red",
    ]);
  });

  it("paints choropleth polygons by category and ignores range", () => {
    expect(
      choroplethColor(
        { property: "s", colors: status, range: [0, 1] },
        [feature({ s: "normal" })],
        "red",
      ),
    ).toEqual(matchStatus("s", "red"));
  });

  it("maps extrusion colors by value", () => {
    expect(
      extrusionColor(
        { property: "s", colors: status, range: [0, 1] },
        [feature({ s: "warning" })],
        "#f00",
      ),
    ).toEqual(matchStatus("s", "#f00"));
  });

  it("ignores entries whose color is not a non-empty string", () => {
    const colors = { a: "#111", b: "", c: 3 } as unknown as Record<
      string,
      string
    >;
    expect(circleColor({ color: "k", colors }, [], "red")).toEqual([
      "match",
      ["to-string", ["get", "k"]],
      "a",
      "#111",
      "red",
    ]);
  });

  it("falls back when the map has no valid entry", () => {
    expect(circleColor({ color: "k", colors: {} }, [], "red")).toBe("red");
    expect(choroplethColor({ property: "k", colors: {} }, [], "red")).toBe(
      "red",
    );
  });
});

describe("color map keys that a plain match cannot take", () => {
  /**
   * MapLibre が色の式として受け付けるかを確かめ、地物を評価した色を返します。
   * devDependencies の @maplibre/maplibre-gl-style-spec は、maplibre-gl が依存するのと同じ版にそろえてあります。
   */
  const evaluate = (expr: unknown, properties: Record<string, unknown>) => {
    const parsed = styleExpression.createExpression(
      expr,
      "paint.circle-color",
      latest.paint_circle["circle-color"],
    );
    if (parsed.result !== "success") {
      throw new Error(JSON.stringify(parsed.value));
    }
    return String(parsed.value.evaluate({ zoom: 0 }, { type: 1, properties }));
  };
  /** 式を評価した色と比べるため、色の文字列を MapLibre の Color の文字列（`rgba(...)`）にします。 */
  const css = (color: string) => String(Color.parse(color));

  it("rejects a color that MapLibre cannot parse", () => {
    const expr = circleColor(
      { color: "k", colors: { a: "notacolor" } },
      [],
      "#000000",
    );
    expect(() => evaluate(expr, { k: "a" })).toThrow();
  });

  it("accepts Object.prototype names as values", () => {
    const expr = circleColor(
      {
        color: "k",
        colors: {
          constructor: "#ff0000",
          toString: "#00ff00",
          a: "#ffffff",
        } as unknown as Record<string, string>,
      },
      [],
      "#000000",
    );
    expect(evaluate(expr, { k: "constructor" })).toBe(css("#ff0000"));
    expect(evaluate(expr, { k: "toString" })).toBe(css("#00ff00"));
    expect(evaluate(expr, { k: "a" })).toBe(css("#ffffff"));
    expect(evaluate(expr, { k: "b" })).toBe(css("#000000"));
  });

  it("accepts __proto__ as an own key of the color map", () => {
    // オブジェクトリテラルの __proto__ は自身のプロパティにならないので、JSON から作る
    const colors = JSON.parse('{"__proto__":"#0000ff","a":"#ffffff"}');
    const expr = circleColor({ color: "k", colors }, [], "#000000");
    expect(evaluate(expr, { k: "__proto__" })).toBe(css("#0000ff"));
    expect(evaluate(expr, { k: "a" })).toBe(css("#ffffff"));
  });

  it("accepts Object.prototype names that appear as categories in the data", () => {
    const expr = circleColor(
      { color: "k", colors: ["#ff0000", "#00ff00"] },
      [feature({ k: "valueOf" }), feature({ k: "x" })],
      "#000000",
    );
    expect(evaluate(expr, { k: "valueOf" })).toBe(css("#ff0000"));
    expect(evaluate(expr, { k: "x" })).toBe(css("#00ff00"));
  });

  it("matches an empty-string key only for features whose value is empty", () => {
    const expr = circleColor(
      { color: "k", colors: { "": "#ff0000", a: "#00ff00" } },
      [],
      "#000000",
    );
    expect(evaluate(expr, { k: "" })).toBe(css("#ff0000"));
    expect(evaluate(expr, {})).toBe(css("#000000"));
    expect(evaluate(expr, { k: null })).toBe(css("#000000"));
    expect(evaluate(expr, { k: "a" })).toBe(css("#00ff00"));
  });

  it("does not color features without the property by an empty category in the data", () => {
    const expr = circleColor(
      { color: "k", colors: ["#ff0000", "#00ff00"] },
      [feature({ k: "" }), feature({ k: "a" })],
      "#000000",
    );
    expect(evaluate(expr, { k: "" })).toBe(css("#ff0000"));
    expect(evaluate(expr, {})).toBe(css("#000000"));
    expect(evaluate(expr, { k: null })).toBe(css("#000000"));
    expect(evaluate(expr, { k: "a" })).toBe(css("#00ff00"));
  });
});
