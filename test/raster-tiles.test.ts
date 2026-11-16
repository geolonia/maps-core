import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addRasterTiles,
  RASTER_TILES_LAYER_ID,
  RASTER_TILES_SOURCE_ID,
} from "../src/lib/raster-tiles";

const URL_TEMPLATE = "https://example.com/tiles/{z}/{x}/{y}.png";

type Layer = { id: string; type: string };

/** addRasterTiles が使うメソッドだけを持つ地図。 */
function createMap(layers: Layer[] = []) {
  const sources: Record<string, unknown> = {};
  const added: { layer: Record<string, unknown>; beforeId?: string }[] = [];
  return {
    sources,
    added,
    getStyle: () => ({ layers }),
    getSource: (id: string) => sources[id],
    getLayer: (id: string) =>
      [...layers, ...added.map((a) => a.layer as Layer)].find(
        (l) => l.id === id,
      ),
    addSource: vi.fn((id: string, source: unknown) => {
      sources[id] = source;
    }),
    addLayer: vi.fn((layer: Record<string, unknown>, beforeId?: string) => {
      added.push({ layer, beforeId });
    }),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("addRasterTiles", () => {
  it("XYZ のテンプレート URL をラスタのソースとして追加し、既定のタイルサイズを 256 にする", () => {
    const map = createMap();
    addRasterTiles(map as never, { url: URL_TEMPLATE });

    expect(map.sources[RASTER_TILES_SOURCE_ID]).toEqual({
      type: "raster",
      tiles: [URL_TEMPLATE],
      tileSize: 256,
    });
    expect(map.added).toEqual([
      {
        layer: {
          id: RASTER_TILES_LAYER_ID,
          type: "raster",
          source: RASTER_TILES_SOURCE_ID,
          paint: { "raster-opacity": 1 },
        },
        beforeId: undefined,
      },
    ]);
  });

  it("出典、タイルサイズ、ズーム範囲をソースに、不透明度をレイヤに渡す", () => {
    const map = createMap();
    addRasterTiles(map as never, {
      url: URL_TEMPLATE,
      attribution: '<a href="https://example.com/">出典</a>',
      opacity: 0.7,
      tileSize: 512,
      minZoom: 2,
      maxZoom: 17,
    });

    expect(map.sources[RASTER_TILES_SOURCE_ID]).toEqual({
      type: "raster",
      tiles: [URL_TEMPLATE],
      tileSize: 512,
      attribution: '<a href="https://example.com/">出典</a>',
      minzoom: 2,
      maxzoom: 17,
    });
    expect(map.added[0].layer.paint).toEqual({ "raster-opacity": 0.7 });
  });

  it("スタイルの最初の symbol レイヤの下に重ねる", () => {
    const map = createMap([
      { id: "background", type: "background" },
      { id: "road", type: "line" },
      { id: "road-label", type: "symbol" },
      { id: "place-label", type: "symbol" },
    ]);
    addRasterTiles(map as never, { url: URL_TEMPLATE });

    expect(map.added[0].beforeId).toBe("road-label");
  });

  it("symbol レイヤが無いスタイルでは一番上に重ねる", () => {
    const map = createMap([
      { id: "background", type: "background" },
      { id: "water", type: "fill" },
    ]);
    addRasterTiles(map as never, { url: URL_TEMPLATE });

    expect(map.added[0].beforeId).toBeUndefined();
  });

  it.each([
    ["範囲より大きい", 1.5, 1],
    ["範囲より小さい", -0.2, 0],
    ["数値でない", Number.NaN, 1],
  ])("不透明度が%s値なら 0 から 1 に収める", (_label, opacity, expected) => {
    const map = createMap();
    addRasterTiles(map as never, { url: URL_TEMPLATE, opacity });

    expect(map.added[0].layer.paint).toEqual({ "raster-opacity": expected });
  });

  it.each([0, -256, Number.NaN])(
    "タイルサイズが正の数でない (%s) なら 256 にする",
    (tileSize) => {
      const map = createMap();
      addRasterTiles(map as never, { url: URL_TEMPLATE, tileSize });

      expect(
        (map.sources[RASTER_TILES_SOURCE_ID] as { tileSize: number }).tileSize,
      ).toBe(256);
    },
  );

  it("数値でないズームはソースに渡さない", () => {
    const map = createMap();
    addRasterTiles(map as never, {
      url: URL_TEMPLATE,
      minZoom: Number.NaN,
      maxZoom: Number.POSITIVE_INFINITY,
    });

    const source = map.sources[RASTER_TILES_SOURCE_ID] as Record<
      string,
      unknown
    >;
    expect(source).not.toHaveProperty("minzoom");
    expect(source).not.toHaveProperty("maxzoom");
  });

  it.each([
    ["{z}, {x}, {y} を含まない URL", "https://example.com/tiles.json"],
    ["{y} を含まない URL", "https://example.com/{z}/{x}.png"],
    ["空文字", ""],
  ])("%sは警告して重ねない", (_label, url) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const map = createMap();
    addRasterTiles(map as never, { url });

    expect(warn).toHaveBeenCalledOnce();
    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.addLayer).not.toHaveBeenCalled();
  });

  it("ソースとレイヤが既にあれば何もしない", () => {
    const map = createMap([{ id: RASTER_TILES_LAYER_ID, type: "raster" }]);
    map.sources[RASTER_TILES_SOURCE_ID] = { type: "raster" };
    addRasterTiles(map as never, { url: URL_TEMPLATE });

    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.addLayer).not.toHaveBeenCalled();
  });

  it("ソースだけが写されてレイヤが無いときは、レイヤだけを足す", () => {
    const map = createMap([{ id: "road-label", type: "symbol" }]);
    map.sources[RASTER_TILES_SOURCE_ID] = { type: "raster" };
    addRasterTiles(map as never, { url: URL_TEMPLATE, opacity: 0.5 });

    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.added).toEqual([
      {
        layer: {
          id: RASTER_TILES_LAYER_ID,
          type: "raster",
          source: RASTER_TILES_SOURCE_ID,
          paint: { "raster-opacity": 0.5 },
        },
        beforeId: "road-label",
      },
    ]);
  });
});
