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

const WORLD = [
  [-180, -90],
  [180, -90],
  [180, 90],
  [-180, 90],
  [-180, -90],
];

const asMap = (map: MockMap) => map as unknown as Parameters<Mask["addTo"]>[0];

const sourceData = (map: MockMap, id: string) =>
  (map.getSource(id) as { data: GeoJSON.GeoJSON }).data;

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

  it("drops a face whose outer ring is broken, so that a hole is not promoted", () => {
    const broken = [
      [0, 0],
      [1, 1],
      [0, 0],
    ];
    expect(collectPolygons(polygon(broken, square(0.2, 0.2, 0.5)))).toEqual([]);
  });

  it("drops holes that cannot form an area", () => {
    const flat = [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 0],
    ];
    expect(collectPolygons(polygon(square(0, 0), flat))).toEqual([
      [square(0, 0)],
    ]);
  });

  it("ignores geometries without coordinates from untyped callers", () => {
    const bad = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "MultiPolygon", coordinates: null },
        },
        null,
      ],
    } as unknown as GeoJSON.FeatureCollection;
    expect(collectPolygons(bad)).toEqual([]);
  });
});

describe("maskGeometry", () => {
  it("cuts every face out of the world", () => {
    expect(maskGeometry([[square(0, 0)], [square(2, 0)]])).toEqual({
      type: "MultiPolygon",
      coordinates: [[WORLD, square(0, 0), square(2, 0)]],
    });
  });

  it("keeps a hole of a face masked as a separate polygon", () => {
    const lake = square(0.25, 0.25, 0.5);
    expect(maskGeometry([[square(0, 0), lake]]).coordinates).toEqual([
      [WORLD, square(0, 0)],
      [lake],
    ]);
  });

  it("cuts a face inside a hole out of that hole, not out of the world", () => {
    const lake = square(0.2, 0.2, 0.6);
    const island = square(0.4, 0.4, 0.2);
    expect(maskGeometry([[square(0, 0), lake], [island]]).coordinates).toEqual([
      [WORLD, square(0, 0)],
      [lake, island],
    ]);
  });
});

describe("maskGeometry with shared boundaries", () => {
  const lake = square(0.2, 0.2, 0.6);
  const rotate = (ring: Ring, n: number): Ring => {
    const open = ring.slice(0, -1);
    const rotated = [...open.slice(n), ...open.slice(0, n)];
    return [...rotated, rotated[0]];
  };

  it.each([0, 1, 2, 3])(
    "cuts an area that fills the hole exactly out of the hole (start vertex %i)",
    (n) => {
      const enclosed = rotate(lake, n);
      expect(
        maskGeometry([[square(0, 0), lake], [enclosed]]).coordinates,
      ).toEqual([
        [WORLD, square(0, 0)],
        [lake, enclosed],
      ]);
    },
  );

  it("cuts an island touching the shore out of the lake", () => {
    // 先頭の頂点が湖の線の上にある
    const island: Ring = [
      [0.2, 0.4],
      [0.4, 0.4],
      [0.4, 0.6],
      [0.2, 0.6],
      [0.2, 0.4],
    ];
    expect(maskGeometry([[square(0, 0), lake], [island]]).coordinates).toEqual([
      [WORLD, square(0, 0)],
      [lake, island],
    ]);
  });

  it("cuts an area out of the hole even when it reuses the hole's array", () => {
    // プログラムで組み立てたデータで、穴と同じ配列を別の面の外周に使い回す
    expect(maskGeometry([[square(0, 0), lake], [lake]]).coordinates).toEqual([
      [WORLD, square(0, 0)],
      [lake, lake],
    ]);
  });

  it("keeps an adjacent area sharing an edge out of the hole", () => {
    const neighbor = square(1, 0);
    expect(
      maskGeometry([[square(0, 0), lake], [neighbor]]).coordinates,
    ).toEqual([[WORLD, square(0, 0), neighbor], [lake]]);
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
    expect(sourceData(map, "geolonia-mask")).toEqual({
      type: "Feature",
      properties: {},
      geometry: maskGeometry([[square(0, 0)]]),
    });
    expect(map.getLayer("geolonia-mask-outline")).toBeUndefined();
  });

  const basicV2Like = () => {
    // geolonia/basic-v2 の並びを縮めたもの（ラベルの後ろに行政界の線、その後ろに都道府県名が並ぶ）
    for (const [id, type] of [
      ["background", "background"],
      ["water", "fill"],
      ["waterway-name", "symbol"],
      ["building-3d", "fill-extrusion"],
      ["place-city", "symbol"],
      ["oc-boundary-land-level-0", "line"],
      ["place-city-pref", "symbol"],
    ]) {
      map.addLayer({ id, type });
    }
  };

  it("inserts the layers above every layer of the base map by default", () => {
    basicV2Like();
    new Mask({ geojson: polygon(square(0, 0)), outline: true }).addTo(
      asMap(map),
    );

    expect(map.getLayersOrder().slice(-3)).toEqual([
      "place-city-pref",
      "geolonia-mask",
      "geolonia-mask-outline",
    ]);
  });

  it("inserts the layers below beforeId", () => {
    basicV2Like();
    new Mask({
      geojson: polygon(square(0, 0)),
      outline: true,
      beforeId: "waterway-name",
    }).addTo(asMap(map));

    expect(map.getLayersOrder().slice(0, 5)).toEqual([
      "background",
      "water",
      "geolonia-mask",
      "geolonia-mask-outline",
      "waterway-name",
    ]);
  });

  it("logs and uses the default position when beforeId does not exist", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    basicV2Like();
    new Mask({ geojson: polygon(square(0, 0)), beforeId: "nope" }).addTo(
      asMap(map),
    );

    expect(map.getLayersOrder().at(-1)).toBe("geolonia-mask");
    expect(error).toHaveBeenCalledWith(
      "[Geolonia] The mask beforeId layer does not exist. The mask is added below the geojson layers:",
      "nope",
    );
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
    expect(
      (sourceData(map, "geolonia-mask-outline") as GeoJSON.Feature).geometry,
    ).toEqual({ type: "MultiPolygon", coordinates: [[square(0, 0)]] });
  });

  it("adds empty layers first and fills them after loading from a URL", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(polygon(square(0, 0)))),
    );
    const mask = new Mask({
      geojson: "https://example.com/boundary.geojson",
      outline: true,
    })
      .addTo(asMap(map))
      .fitBounds();
    expect(map.getLayer("geolonia-mask")).toBeDefined();
    expect(sourceData(map, "geolonia-mask")).toEqual({
      type: "FeatureCollection",
      features: [],
    });

    await mask._loadingPromise;

    expect(
      (sourceData(map, "geolonia-mask") as GeoJSON.Feature).geometry,
    ).toEqual(maskGeometry([[square(0, 0)]]));
    expect(
      (sourceData(map, "geolonia-mask-outline") as GeoJSON.Feature).geometry,
    ).toEqual({ type: "MultiPolygon", coordinates: [[square(0, 0)]] });
    expect(map.bounds).toBe(true);
  });

  it("logs and keeps the mask empty when the URL fails to load", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response("", { status: 404 }),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const mask = new Mask("https://example.com/missing.geojson").addTo(
      asMap(map),
    );

    await mask._loadingPromise;

    expect(sourceData(map, "geolonia-mask")).toEqual({
      type: "FeatureCollection",
      features: [],
    });
    expect(error).toHaveBeenCalledWith(
      "[Geolonia] Failed to load mask GeoJSON:",
      expect.any(Error),
    );
  });

  it("logs an invalid URL without fetching", () => {
    const fetch = vi.spyOn(window, "fetch");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    new Mask("boundary.geojson").addTo(asMap(map));

    expect(fetch).not.toHaveBeenCalled();
    expect(map.getLayersOrder()).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      "[Geolonia] Invalid mask GeoJSON URL:",
      "boundary.geojson",
    );
  });

  it("logs when there is no polygon", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    new Mask({
      geojson: { type: "FeatureCollection", features: [] },
    }).addTo(asMap(map));

    expect(error).toHaveBeenCalledWith(
      "[Geolonia] The mask GeoJSON has no Polygon or MultiPolygon.",
    );
  });

  it("does nothing when the source is gone before the GeoJSON arrives", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(polygon(square(0, 0)))),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const mask = new Mask("https://example.com/boundary.geojson")
      .addTo(asMap(map))
      .fitBounds();
    // setStyle でスタイルが差し替えられたときと同じく、ソースとレイヤーが消える
    map.layers = [];
    map.sources = {};

    await mask._loadingPromise;

    expect(map.getSource("geolonia-mask")).toBeUndefined();
    expect(map.bounds).toBe(false);
    expect(error).not.toHaveBeenCalled();
  });

  it("does not use a response that arrives after remove", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(polygon(square(0, 0)))),
    );
    const mask = new Mask("https://example.com/boundary.geojson").addTo(
      asMap(map),
    );
    mask.remove();

    await mask._loadingPromise;

    expect(map.getSource("geolonia-mask")).toBeUndefined();
  });

  it("can be added again after remove", () => {
    const mask = new Mask({
      geojson: polygon(square(0, 0)),
      outline: true,
    }).addTo(asMap(map));

    mask.remove();
    expect(map.getLayersOrder()).toEqual([]);
    expect(map.getSource("geolonia-mask")).toBeUndefined();
    expect(map.getSource("geolonia-mask-outline")).toBeUndefined();

    mask.addTo(asMap(map));
    expect(map.getLayersOrder()).toEqual([
      "geolonia-mask",
      "geolonia-mask-outline",
    ]);
    expect(
      (sourceData(map, "geolonia-mask") as GeoJSON.Feature).geometry,
    ).toEqual(maskGeometry([[square(0, 0)]]));
  });

  it("refuses a second mask on the same map", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    new Mask({ geojson: polygon(square(0, 0)) }).addTo(asMap(map));
    const second = new Mask({
      geojson: polygon(square(5, 5)),
      color: "#ff0000",
    }).addTo(asMap(map));

    expect(error).toHaveBeenCalled();
    expect(
      (map.getLayer("geolonia-mask") as { paint: Record<string, unknown> })
        .paint["fill-color"],
    ).toBe(DEFAULT_MASK_COLOR);
    // 追加しなかった側の remove で、先に追加したマスクを消さない
    second.remove();
    expect(map.getLayer("geolonia-mask")).toBeDefined();
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

  it("does not move the map when removed before the next frame", () => {
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frame = cb;
      return 0;
    });
    const fitBounds = vi.spyOn(map, "fitBounds");
    const mask = new Mask({ geojson: polygon(square(0, 0)) })
      .addTo(asMap(map))
      .fitBounds();
    mask.remove();
    frame?.(0);

    expect(fitBounds).not.toHaveBeenCalled();
  });

  it("logs and adds nothing when there is no geojson", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    new Mask({} as unknown as string).addTo(asMap(map));

    expect(map.getLayersOrder()).toEqual([]);
    expect(error).toHaveBeenCalledWith(
      "[Geolonia] The mask option has no geojson.",
    );
  });

  it("re-adds itself when addTo is called twice, keeping the URL result", async () => {
    vi.spyOn(window, "fetch").mockImplementation(
      async () => new Response(JSON.stringify(polygon(square(0, 0)))),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const mask = new Mask("https://example.com/boundary.geojson");
    mask.addTo(asMap(map));
    mask.addTo(asMap(map));

    await mask._loadingPromise;

    expect(error).not.toHaveBeenCalled();
    expect(
      (sourceData(map, "geolonia-mask") as GeoJSON.Feature).geometry,
    ).toEqual(maskGeometry([[square(0, 0)]]));
  });

  it("moves to another map when added to it", () => {
    const other = new MockMap();
    const mask = new Mask({ geojson: polygon(square(0, 0)) }).addTo(asMap(map));
    mask.addTo(asMap(other));

    expect(map.getSource("geolonia-mask")).toBeUndefined();
    expect(other.getSource("geolonia-mask")).toBeDefined();
    mask.remove();
    expect(other.getSource("geolonia-mask")).toBeUndefined();
  });

  it("does not touch a mask that replaced it after a style change", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(polygon(square(0, 0)))),
    );
    const old = new Mask("https://example.com/old.geojson").addTo(asMap(map));
    // setStyle でソースとレイヤーが消え、新しいスタイルに別の Mask が追加される
    map.layers = [];
    map.sources = {};
    new Mask({ geojson: polygon(square(5, 5)) }).addTo(asMap(map));

    await old._loadingPromise;
    expect(
      (sourceData(map, "geolonia-mask") as GeoJSON.Feature).geometry,
    ).toEqual(maskGeometry([[square(5, 5)]]));

    old.remove();
    expect(map.getLayer("geolonia-mask")).toBeDefined();
    expect(map.getSource("geolonia-mask")).toBeDefined();
  });

  it("does not use the GeoJSON when the map has been destroyed", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify(polygon(square(0, 0)))),
    );
    const mask = new Mask("https://example.com/boundary.geojson").addTo(
      asMap(map),
    );
    (map as unknown as { _removed: boolean })._removed = true;

    await mask._loadingPromise;

    expect(sourceData(map, "geolonia-mask")).toEqual({
      type: "FeatureCollection",
      features: [],
    });
  });

  it("drops a ring that is not closed", () => {
    const open = square(0, 0).slice(0, -1);
    expect(collectPolygons(polygon(open))).toEqual([]);
  });

  it("uses the default opacity for a value outside 0 to 1", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    new Mask({ geojson: polygon(square(0, 0)), opacity: 1.5 }).addTo(
      asMap(map),
    );

    expect(
      (map.getLayer("geolonia-mask") as { paint: Record<string, unknown> })
        .paint["fill-opacity"],
    ).toBe(DEFAULT_MASK_OPACITY);
    expect(error).toHaveBeenCalled();
  });

  it("adds nothing when MapLibre rejects the layer", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    // MapLibre は解釈できない色のレイヤーを追加しない
    const addLayer = map.addLayer.bind(map);
    vi.spyOn(map, "addLayer").mockImplementation((layer, before) => {
      if (layer.id !== "geolonia-mask") addLayer(layer, before);
    });
    const mask = new Mask({ geojson: polygon(square(0, 0)), color: "foo" });
    mask.addTo(asMap(map));

    expect(map.getLayersOrder()).toEqual([]);
    expect(map.getSource("geolonia-mask")).toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "[Geolonia] Failed to add the mask layer. Check `color`.",
    );
  });

  it("skips polygons with coordinates outside longitude and latitude", () => {
    const projected = square(-30000, 50000, 1000);
    expect(collectPolygons(polygon(projected))).toEqual([]);
  });

  it("keeps the fill and logs when only the outline layer is rejected", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const addLayer = map.addLayer.bind(map);
    vi.spyOn(map, "addLayer").mockImplementation((layer, before) => {
      if (layer.id !== "geolonia-mask-outline") addLayer(layer, before);
    });
    new Mask({
      geojson: polygon(square(0, 0)),
      outline: { color: "foo" },
    }).addTo(asMap(map));

    expect(map.getLayer("geolonia-mask")).toBeDefined();
    expect(error).toHaveBeenCalledWith(
      "[Geolonia] Failed to add the mask outline layer. Check `outline.color` and `outline.width`.",
    );
  });

  it("accepts a GeoJSON whose top level is a geometry", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ type: "Polygon", coordinates: [square(0, 0)] }),
      ),
    );
    const mask = new Mask("https://example.com/boundary.geojson").addTo(
      asMap(map),
    );

    await mask._loadingPromise;

    expect(
      (sourceData(map, "geolonia-mask") as GeoJSON.Feature).geometry,
    ).toEqual(maskGeometry([[square(0, 0)]]));
  });

  it("refuses when a layer with the mask ID already exists", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    map.addLayer({ id: "geolonia-mask", type: "fill", source: "other" });
    const mask = new Mask({ geojson: polygon(square(0, 0)) }).addTo(asMap(map));
    mask.remove();

    expect(error).toHaveBeenCalled();
    expect(map.getLayer("geolonia-mask")).toEqual({
      id: "geolonia-mask",
      type: "fill",
      source: "other",
    });
  });

  it("does not report a failed fetch that was discarded by remove", async () => {
    vi.spyOn(window, "fetch").mockRejectedValue(new Error("offline"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const mask = new Mask("https://example.com/boundary.geojson").addTo(
      asMap(map),
    );
    mask.remove();

    await mask._loadingPromise;

    expect(error).not.toHaveBeenCalled();
  });

  it("refuses when only the outline source or layer already exists", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    map.addLayer({ id: "geolonia-mask-outline", type: "line", source: "x" });
    const mask = new Mask({
      geojson: polygon(square(0, 0)),
      outline: true,
    }).addTo(asMap(map));
    mask.remove();

    expect(error).toHaveBeenCalled();
    expect(map.getLayersOrder()).toEqual(["geolonia-mask-outline"]);
    expect(map.getSource("geolonia-mask")).toBeUndefined();
  });
});
