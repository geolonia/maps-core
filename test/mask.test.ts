/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectPolygons,
  DEFAULT_MASK_COLOR,
  DEFAULT_MASK_OPACITY,
  Mask,
  maskGeometry,
  normalizeMask,
} from "../src/lib/mask";
import { MockMap } from "./helpers/mock-map";

type Ring = number[][];

/** 反時計回りの正方形です。 */
const square = (x: number, y: number, size = 1): Ring => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
];

const polygon = (...rings: Ring[]): GeoJSON.Feature => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Polygon", coordinates: rings },
});

const signedArea = (ring: Ring) => {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum;
};

const asMap = (map: MockMap) => map as unknown as Parameters<Mask["addTo"]>[0];

describe("normalizeMask", () => {
  it("treats a string as the GeoJSON URL", () => {
    expect(normalizeMask("/boundary.geojson")).toEqual({
      geojson: "/boundary.geojson",
    });
  });

  it("returns undefined without a geojson", () => {
    expect(normalizeMask(undefined)).toBeUndefined();
    expect(normalizeMask("")).toBeUndefined();
    expect(
      normalizeMask({} as unknown as Parameters<typeof normalizeMask>[0]),
    ).toBeUndefined();
  });
});

describe("collectPolygons", () => {
  it("collects Polygon and MultiPolygon faces and ignores other geometries", () => {
    const polygons = collectPolygons({
      type: "FeatureCollection",
      features: [
        polygon(square(0, 0)),
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "MultiPolygon",
            coordinates: [[square(2, 0)], [square(4, 0)]],
          },
        },
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [0, 0] },
        },
      ],
    });
    expect(polygons).toEqual([[square(0, 0)], [square(2, 0)], [square(4, 0)]]);
  });

  it("accepts a single Feature", () => {
    expect(collectPolygons(polygon(square(0, 0)))).toEqual([[square(0, 0)]]);
  });

  it("drops rings that cannot form an area", () => {
    const broken = [
      [0, 0],
      [1, 1],
      [0, 0],
    ];
    const flat = [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 0],
    ];
    expect(collectPolygons(polygon(broken))).toEqual([]);
    expect(collectPolygons(polygon(flat))).toEqual([]);
  });
});

describe("maskGeometry", () => {
  it("cuts every face out of the world, with holes wound clockwise", () => {
    const geometry = maskGeometry([[square(0, 0)], [square(2, 0)]]);
    const [world] = geometry.coordinates;
    const [outer, ...holes] = world;
    expect(signedArea(outer)).toBeGreaterThan(0);
    expect(holes).toHaveLength(2);
    for (const hole of holes) {
      expect(signedArea(hole)).toBeLessThan(0);
    }
  });

  it("rewinds a clockwise outer ring into a clockwise hole either way", () => {
    const clockwise = [...square(0, 0)].reverse();
    const [[, hole]] = maskGeometry([[clockwise]]).coordinates;
    expect(signedArea(hole)).toBeLessThan(0);
  });

  it("keeps the holes of a face masked as separate polygons", () => {
    const enclave = square(0.25, 0.25, 0.5);
    const geometry = maskGeometry([[square(0, 0), [...enclave].reverse()]]);
    expect(geometry.coordinates).toHaveLength(2);
    const [island] = geometry.coordinates[1];
    expect(signedArea(island)).toBeGreaterThan(0);
  });
});

describe("Mask", () => {
  let map: MockMap;

  beforeEach(() => {
    map = new MockMap();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds the fill layer with the default color and opacity", () => {
    new Mask({ geojson: polygon(square(0, 0)) }).addTo(asMap(map));

    const layer = map.getLayer("geolonia-mask") as Record<string, unknown>;
    expect(layer.type).toBe("fill");
    expect(layer.paint).toEqual({
      "fill-color": DEFAULT_MASK_COLOR,
      "fill-opacity": DEFAULT_MASK_OPACITY,
    });
    expect(map.getLayer("geolonia-mask-outline")).toBeUndefined();
  });

  it("inserts the layers below the first symbol layer", () => {
    map.addLayer({ id: "background", type: "background" });
    map.addLayer({ id: "place-label", type: "symbol" });
    map.addLayer({ id: "poi-label", type: "symbol" });

    new Mask({ geojson: polygon(square(0, 0)), outline: true }).addTo(
      asMap(map),
    );

    expect(map.getLayersOrder()).toEqual([
      "background",
      "geolonia-mask",
      "geolonia-mask-outline",
      "place-label",
      "poi-label",
    ]);
  });

  it("inserts the layers below SimpleStyle layers added before the mask", () => {
    map.addLayer({ id: "background", type: "background" });
    map.addLayer({ id: "geolonia-simple-style-polygon", type: "fill" });
    map.addLayer({
      id: "geolonia-simple-style-polygon-symbol",
      type: "symbol",
    });

    new Mask({ geojson: polygon(square(0, 0)) }).addTo(asMap(map));

    expect(map.getLayersOrder()).toEqual([
      "background",
      "geolonia-mask",
      "geolonia-simple-style-polygon",
      "geolonia-simple-style-polygon-symbol",
    ]);
  });

  it("draws the outline on the original faces, not on the world edge", () => {
    new Mask({
      geojson: polygon(square(0, 0)),
      color: "#123456",
      opacity: 0.5,
      outline: { width: 4 },
    }).addTo(asMap(map));

    const outline = map.getLayer("geolonia-mask-outline") as Record<
      string,
      unknown
    >;
    expect(outline.paint).toEqual({ "line-color": "#123456", "line-width": 4 });
    const source = map.getSource("geolonia-mask-outline") as {
      data: GeoJSON.Feature<GeoJSON.MultiPolygon>;
    };
    expect(source.data.geometry.coordinates).toEqual([[square(0, 0)]]);
  });

  it("loads the GeoJSON from a URL before adding the layers", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(polygon(square(0, 0)))),
    );
    const mask = new Mask("https://example.com/boundary.geojson")
      .addTo(asMap(map))
      .fitBounds();
    expect(map.getLayer("geolonia-mask")).toBeUndefined();

    await mask._loadingPromise;

    expect(map.getLayer("geolonia-mask")).toBeDefined();
    expect(map.bounds).toBe(true);
  });

  it("logs and adds nothing when the URL fails to load", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response("", { status: 404 }),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const mask = new Mask("https://example.com/missing.geojson").addTo(
      asMap(map),
    );

    await mask._loadingPromise;

    expect(map.getLayer("geolonia-mask")).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "[Geolonia] Failed to load mask GeoJSON:",
      expect.any(Error),
    );
  });

  it("logs and adds nothing when there is no polygon", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    new Mask({
      geojson: { type: "FeatureCollection", features: [] },
    }).addTo(asMap(map));

    expect(map.getLayer("geolonia-mask")).toBeUndefined();
    expect(error).toHaveBeenCalled();
  });

  it("does not add the layers when removed before the GeoJSON arrives", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(polygon(square(0, 0)))),
    );
    const mask = new Mask("https://example.com/boundary.geojson").addTo(
      asMap(map),
    );
    mask.remove();

    await mask._loadingPromise;

    expect(map.getLayer("geolonia-mask")).toBeUndefined();
    expect(map.getSource("geolonia-mask")).toBeUndefined();
  });

  it("removes its layers and sources", () => {
    const mask = new Mask({
      geojson: polygon(square(0, 0)),
      outline: true,
    }).addTo(asMap(map));

    mask.remove();

    expect(map.getLayersOrder()).toEqual([]);
    expect(map.getSource("geolonia-mask")).toBeUndefined();
    expect(map.getSource("geolonia-mask-outline")).toBeUndefined();
  });

  it("fits the map to the boundary", () => {
    const fitBounds = vi.spyOn(map, "fitBounds");
    new Mask({ geojson: polygon(square(1, 2, 3)) })
      .addTo(asMap(map))
      .fitBounds({ duration: 0 });

    expect(fitBounds).toHaveBeenCalledWith([1, 2, 4, 5], {
      duration: 0,
      padding: 30,
    });
  });
});
