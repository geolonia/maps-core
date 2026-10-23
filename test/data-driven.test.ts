import { describe, expect, it } from "vitest";
import {
  CATEGORICAL_COLORS,
  choroplethColor,
  circleColor,
  circleRadius,
  heatmapColor,
  heatmapWeight,
  normalizeChoropleth,
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
