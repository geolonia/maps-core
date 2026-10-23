/**
 * @vitest-environment jsdom
 */

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MockMap } from "./helpers/mock-map";

const originalCreateObjectURL = window.URL.createObjectURL;

beforeAll(() => {
  // maplibre-gl tries URL.createObjectURL on import
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => "blob:mock";
  }
});

afterAll(() => {
  window.URL.createObjectURL = originalCreateObjectURL;
});

const geojson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
        coordinates: [139.77, 35.685],
      },
    },
  ],
};

const emptyGeojson = {
  type: "FeatureCollection",
  features: [],
};

describe("SimpleStyle", () => {
  it("should create sources and layers as expected", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(geojson).addTo(map);

    expect(Object.keys(map.sources)).toEqual([
      "geolonia-simple-style",
      "geolonia-simple-style-points",
    ]);
    expect(map.layers.length).toBe(8);
  });

  it("should support custom ID", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(geojson, { id: "custom-id" }).addTo(map);

    expect(Object.keys(map.sources)).toEqual(["custom-id", "custom-id-points"]);
    expect(map.layers.length).toBe(8);
  });

  it("should call map.fitBounds with correct bbox", async () => {
    const multiFeatureGeojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [139.0, 35.0],
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [140.0, 36.0],
          },
        },
      ],
    };

    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    const fitBoundsSpy = vi.spyOn(map, "fitBounds");

    // fitBounds uses requestAnimationFrame, so we need to mock it
    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };

    new SimpleStyle(multiFeatureGeojson).addTo(map).fitBounds();

    expect(fitBoundsSpy).toHaveBeenCalledTimes(1);
    const [bounds] = fitBoundsSpy.mock.calls[0];
    // bbox should be [west, south, east, north] = [minLng, minLat, maxLng, maxLat]
    expect(bounds).toEqual([139.0, 35.0, 140.0, 36.0]);

    window.requestAnimationFrame = origRAF;
  });

  it("should handle empty GeoJSON", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(emptyGeojson).addTo(map).fitBounds();

    expect(Object.keys(map.sources)).toEqual([
      "geolonia-simple-style",
      "geolonia-simple-style-points",
    ]);
    expect(map.layers.length).toBe(8);
    // fitBounds should not fire on empty geojson (no extent)
    expect(map.bounds).toBe(false);
  });

  it("should update GeoJSON data", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    const ss = new SimpleStyle(emptyGeojson).addTo(map);

    expect(
      (
        map.sources["geolonia-simple-style-points"] as {
          data: { features: unknown[] };
        }
      ).data.features.length,
    ).toBe(0);

    ss.updateData(geojson);

    expect(
      (
        map.sources["geolonia-simple-style-points"] as {
          data: { features: unknown[] };
        }
      ).data.features.length,
    ).toBe(1);
  });

  it("should load GeoJSON from URL", async () => {
    const mockGeojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [139.687, 35.734],
              [139.769, 35.734],
            ],
          },
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockGeojson),
        }),
      ),
    );

    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    const ss = new SimpleStyle("https://example.com/data.geojson");
    ss.addTo(map).fitBounds();

    await ss._loadingPromise;

    const source = map.sources["geolonia-simple-style"] as {
      data: { features: { geometry: { type: string } }[] };
    };
    expect(source.data.features[0].geometry.type).toBe("LineString");

    vi.unstubAllGlobals();
  });

  it("should handle fetch failure gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        }),
      ),
    );

    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    const ss = new SimpleStyle("https://example.com/404.geojson");
    ss.addTo(map).fitBounds();

    await ss._loadingPromise;

    expect(Object.keys(map.sources)).toEqual([
      "geolonia-simple-style",
      "geolonia-simple-style-points",
    ]);
    expect(map.bounds).toBe(false);

    vi.unstubAllGlobals();
  });

  it("should have icon-allow-overlap and text-allow-overlap on symbol-points layer", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(geojson).addTo(map);

    const symbolLayer = map.layers.find(
      (l) => l.id === "geolonia-simple-style-symbol-points",
    ) as { layout: Record<string, boolean> };
    expect(symbolLayer).toBeDefined();
    expect(symbolLayer.layout["icon-allow-overlap"]).toBe(true);
    expect(symbolLayer.layout["text-allow-overlap"]).toBe(true);
  });

  it("should remove all layers and sources on remove()", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    const ss = new SimpleStyle(geojson).addTo(map);

    expect(map.layers.length).toBe(8);
    expect(Object.keys(map.sources).length).toBe(2);

    ss.remove();

    expect(map.layers.length).toBe(0);
    expect(Object.keys(map.sources).length).toBe(0);
  });

  it("should unregister all events on remove()", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    const onSpy = vi.spyOn(map, "on");
    const offSpy = vi.spyOn(map, "off");
    const ss = new SimpleStyle(geojson).addTo(map);

    ss.remove();

    expect(offSpy.mock.calls.length).toBe(onSpy.mock.calls.length);
  });

  it("should be safe to call remove() twice", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    const ss = new SimpleStyle(geojson).addTo(map);

    ss.remove();
    expect(() => ss.remove()).not.toThrow();
  });

  it("should create cluster layers", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(geojson).addTo(map);

    const clusterLayer = map.layers.find(
      (l) => l.id === "geolonia-simple-style-clusters",
    );
    const clusterCountLayer = map.layers.find(
      (l) => l.id === "geolonia-simple-style-cluster-count",
    );
    expect(clusterLayer).toBeDefined();
    expect(clusterCountLayer).toBeDefined();
  });

  it("should apply cluster color", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(geojson, { clusterColor: "#00ff00" }).addTo(map);

    const clusterLayer = map.layers.find(
      (l) => l.id === "geolonia-simple-style-clusters",
    ) as { paint: Record<string, unknown> };
    expect(clusterLayer).toBeDefined();
    expect(clusterLayer.paint["circle-color"]).toBe("#00ff00");
  });

  it("should register click events for popup and cluster layers", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    const onSpy = vi.spyOn(map, "on");
    new SimpleStyle(geojson).addTo(map);

    const clickCalls = onSpy.mock.calls.filter(
      (call) => call[0] === "click" && typeof call[2] === "function",
    );
    const layers = clickCalls.map(([, layer]) => layer).sort();
    expect(layers).toEqual(
      [
        "geolonia-simple-style-polygon",
        "geolonia-simple-style-linestring",
        "geolonia-simple-style-circle-points",
        "geolonia-simple-style-symbol-points",
        "geolonia-simple-style-clusters",
      ].sort(),
    );
  });

  it("should separate Point features from Polygon/LineString into different sources", async () => {
    const mixedGeojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [139.77, 35.68] },
        },
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [139.0, 35.0],
                [140.0, 35.0],
                [140.0, 36.0],
                [139.0, 36.0],
                [139.0, 35.0],
              ],
            ],
          },
        },
      ],
    };

    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(mixedGeojson).addTo(map);

    const mainSource = map.sources["geolonia-simple-style"] as {
      data: { features: { geometry: { type: string } }[] };
    };
    const pointsSource = map.sources["geolonia-simple-style-points"] as {
      data: { features: { geometry: { type: string } }[] };
    };

    // Main source should have only Polygon (non-Point features)
    expect(mainSource.data.features.length).toBe(1);
    expect(mainSource.data.features[0].geometry.type).toBe("Polygon");

    // Points source should have only Point features
    expect(pointsSource.data.features.length).toBe(1);
    expect(pointsSource.data.features[0].geometry.type).toBe("Point");
  });
});

describe("SimpleStyle data-driven options", () => {
  const square = (value: unknown) => ({
    type: "Feature",
    properties: { value, fill: "#000000" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [139.0, 35.0],
          [140.0, 35.0],
          [140.0, 36.0],
          [139.0, 35.0],
        ],
      ],
    },
  });
  const spot = (properties: Record<string, unknown>) => ({
    type: "Feature",
    properties,
    geometry: { type: "Point", coordinates: [139.77, 35.68] },
  });
  const paintOf = (map: MockMap, id: string) =>
    (
      map.getLayer(`geolonia-simple-style-${id}`) as {
        paint: Record<string, unknown>;
      }
    ).paint;

  it("should color polygons by the choropleth property instead of fill", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(
      { type: "FeatureCollection", features: [square(0), square(100)] },
      { choropleth: "value" },
    ).addTo(map);

    const fill = paintOf(map, "polygon")["fill-color"] as unknown[];
    // 値が数値の地物は value で塗り、地物の fill は値がない地物の代わりにだけ使う
    expect(fill[0]).toBe("case");
    expect((fill[2] as unknown[])[0]).toBe("interpolate");
    expect(JSON.stringify(fill[2])).toContain('["get","value"]');
  });

  it("should recompute the choropleth range when the data is updated", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    const ss = new SimpleStyle(
      { type: "FeatureCollection", features: [] },
      { choropleth: { property: "value", colors: ["#aaa", "#ddd"] } },
    ).addTo(map);

    ss.updateData({
      type: "FeatureCollection",
      features: [square(10), square(20)] as GeoJSON.Feature[],
    });

    const fill = paintOf(map, "polygon")["fill-color"] as unknown[];
    expect(fill[2]).toEqual([
      "interpolate",
      ["linear"],
      ["get", "value"],
      10,
      "#aaa",
      20,
      "#ddd",
    ]);
  });

  it("should draw points as a heatmap without clusters or markers", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(
      {
        type: "FeatureCollection",
        features: [spot({ weight: 1 }), spot({ weight: 5 })],
      },
      { heatmap: "weight" },
    ).addTo(map);

    expect(
      (map.sources["geolonia-simple-style-points"] as { cluster: boolean })
        .cluster,
    ).toBe(false);
    const heatmap = map.getLayer("geolonia-simple-style-heatmap") as {
      type: string;
      paint: Record<string, unknown>;
    };
    expect(heatmap.type).toBe("heatmap");
    expect(JSON.stringify(heatmap.paint["heatmap-weight"])).toContain(
      '["get","weight"]',
    );
    expect(map.getLayer("geolonia-simple-style-circle-points")).toBeUndefined();
    expect(map.getLayer("geolonia-simple-style-clusters")).toBeUndefined();
  });

  it("should size and color circles by properties without clustering", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(
      {
        type: "FeatureCollection",
        features: [
          spot({ weight: 0, category: "カフェ", "marker-color": "#000" }),
          spot({ weight: 6, category: "書店" }),
        ],
      },
      { circle: { size: "weight", color: "category" } },
    ).addTo(map);

    expect(
      (map.sources["geolonia-simple-style-points"] as { cluster: boolean })
        .cluster,
    ).toBe(false);
    const paint = paintOf(map, "circle-points");
    expect(JSON.stringify(paint["circle-radius"])).toContain(
      '["get","weight"]',
    );
    expect((paint["circle-color"] as unknown[])[0]).toBe("match");
  });

  it("should remove the heatmap layer on remove()", async () => {
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(geojson, { heatmap: true }).addTo(map).remove();

    expect(map.layers.length).toBe(0);
    expect(Object.keys(map.sources).length).toBe(0);
  });

  it("should draw every point as a circle, including ones with marker-symbol", async () => {
    const spots = JSON.parse(
      readFileSync("example/sample-spots.geojson", "utf8"),
    );
    const { SimpleStyle } = await import("../src/lib/simplestyle");
    const map = new MockMap();
    new SimpleStyle(spots, { circle: { color: "category" } }).addTo(map);

    const circles = map.getLayer("geolonia-simple-style-circle-points") as {
      filter: unknown;
    };
    expect(JSON.stringify(circles.filter)).not.toContain("marker-symbol");
    // 400 点のタイトルとアイコンが円に重ならないよう、シンボルは描かない
    expect(map.getLayer("geolonia-simple-style-symbol-points")).toBeUndefined();
  });
});
