/**
 * @vitest-environment jsdom
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MockMap } from "./helpers/mock-map";

// Mock maplibre-gl Popup used in setPopup()
vi.mock("maplibre-gl", () => {
  class MockPopup {
    setLngLat() {
      return this;
    }
    setHTML() {
      return this;
    }
    addTo() {
      return this;
    }
  }
  return { default: { Popup: MockPopup } };
});

beforeAll(() => {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => "blob:mock";
  }
});

const TEST_URL = "https://example.com/tiles/{z}/{x}/{y}.pbf";

const EXPECTED_LAYER_IDS = [
  "vt-geolonia-simple-style-polygon",
  "vt-geolonia-simple-style-linestring",
  "vt-geolonia-simple-style-polygon-symbol",
  "vt-geolonia-simple-style-linestring-symbol",
  "vt-circle-simple-style-points",
  "vt-geolonia-simple-style-points",
];

describe("SimpleStyleVector", () => {
  let SimpleStyleVector: typeof import("../src/lib/simplestyle-vector").default;
  let map: MockMap;

  beforeAll(async () => {
    const mod = await import("../src/lib/simplestyle-vector");
    SimpleStyleVector = mod.default;
  });

  beforeEach(() => {
    map = new MockMap();
  });

  it("should add 1 source and 6 layers", () => {
    new SimpleStyleVector(TEST_URL).addTo(map);

    expect(Object.keys(map.sources)).toHaveLength(1);
    expect(map.layers).toHaveLength(6);
  });

  it("should add source with type 'vector' and correct url", () => {
    new SimpleStyleVector(TEST_URL).addTo(map);

    const source = map.sources["vt-geolonia-simple-style"] as Record<
      string,
      unknown
    >;
    expect(source.type).toBe("vector");
    expect(source.url).toBe(TEST_URL);
  });

  it("should use 'vt-geolonia-simple-style' as source name", () => {
    new SimpleStyleVector(TEST_URL).addTo(map);

    expect(map.sources).toHaveProperty("vt-geolonia-simple-style");
  });

  it("should create layers for each geometry type", () => {
    new SimpleStyleVector(TEST_URL).addTo(map);

    const layerIds = map.layers.map((l) => l.id);
    for (const id of EXPECTED_LAYER_IDS) {
      expect(layerIds).toContain(id);
    }
  });

  it("should register click/mouseenter/mouseleave events for 4 popup layers", () => {
    const onSpy = vi.spyOn(map, "on");
    new SimpleStyleVector(TEST_URL).addTo(map);

    const popupLayers = [
      "vt-geolonia-simple-style-polygon",
      "vt-geolonia-simple-style-linestring",
      "vt-circle-simple-style-points",
      "vt-geolonia-simple-style-points",
    ];

    for (const layer of popupLayers) {
      for (const event of ["click", "mouseenter", "mouseleave"]) {
        expect(
          onSpy.mock.calls.some(
            (call) => call[0] === event && call[1] === layer,
          ),
        ).toBe(true);
      }
    }
  });

  it("should change cursor on mouseenter/mouseleave", () => {
    new SimpleStyleVector(TEST_URL).addTo(map);

    const layer = "vt-geolonia-simple-style-polygon";

    // mouseenter with description sets pointer cursor
    map.fireLayerEvent("mouseenter", layer, {
      features: [{ properties: { description: "hello" } }],
    });
    expect(map.getCanvas().style.cursor).toBe("pointer");

    // mouseleave resets cursor
    map.fireLayerEvent("mouseleave", layer, {});
    expect(map.getCanvas().style.cursor).toBe("");
  });

  it("should register sourcedata listener for fitBounds when dataset.lng is not set", () => {
    const onSpy = vi.spyOn(map, "on");
    new SimpleStyleVector(TEST_URL).addTo(map);

    const sourcedataCalls = onSpy.mock.calls.filter(
      (call) => call[0] === "sourcedata" && typeof call[1] === "function",
    );
    expect(sourcedataCalls).toHaveLength(1);
  });

  it("should skip fitBounds listener when dataset.lng is set", () => {
    (
      map.getContainer() as unknown as { dataset: Record<string, string> }
    ).dataset.lng = "139.77";
    (
      map.getContainer() as unknown as { dataset: Record<string, string> }
    ).dataset.lat = "35.68";

    const onSpy = vi.spyOn(map, "on");
    new SimpleStyleVector(TEST_URL).addTo(map);

    const sourcedataCalls = onSpy.mock.calls.filter(
      (call) => call[0] === "sourcedata" && typeof call[1] === "function",
    );
    expect(sourcedataCalls).toHaveLength(0);
  });
});
