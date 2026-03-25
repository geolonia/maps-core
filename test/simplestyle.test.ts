/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  // maplibre-gl tries URL.createObjectURL on import
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => "blob:mock";
  }
});

// Mock Map class for testing SimpleStyle without MapLibre
class MockMap {
  bounds = false;
  layers: Record<string, unknown>[] = [];
  sources: Record<string, unknown> = {};

  addSource(id: string, source: unknown) {
    this.sources[id] = source;
  }

  addLayer(layer: Record<string, unknown>) {
    this.layers.push(layer);
  }

  on() {}

  getSource(id: string) {
    const sources = this.sources;
    return {
      setData(geojson: unknown) {
        sources[id] = { type: "geojson", data: geojson };
      },
    };
  }

  getCanvas() {
    return { style: {} };
  }

  getContainer() {
    return { dataset: {} };
  }

  fitBounds() {
    this.bounds = true;
  }
}

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
});
