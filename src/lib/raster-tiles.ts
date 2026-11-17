import type {
  Map as MaplibreMap,
  RasterSourceSpecification,
} from "maplibre-gl";
import type { RasterTilesOptions } from "../types";

/** {@link addRasterTiles} が追加するソースの ID。 */
export const RASTER_TILES_SOURCE_ID = "geolonia-raster-tiles";
/** {@link addRasterTiles} が追加するレイヤの ID。 */
export const RASTER_TILES_LAYER_ID = "geolonia-raster-tiles";

const DEFAULT_TILE_SIZE = 256;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * {@link GeoloniaMapOptions} の `rasterTiles` のラスタタイルを地図に重ねます。
 *
 * スタイルの最初の symbol レイヤの下（ラベルの下）に重ね、symbol レイヤが無いスタイルでは一番上に重ねます。
 * `url` が `{z}`、`{x}`、`{y}` を含まないときは警告して重ねません。
 * 同じ ID のレイヤが既にあるときは何もしません。`setStyle` の `transformStyle` でソースだけが新しいスタイルに写されたときは、
 * 写されたソースを使ってレイヤだけを足します。ソースの設定は地図を作るときのオプションから変わらないので、写されたものをそのまま使えます。
 *
 * @param map 重ねる対象の地図です。
 * @param options 重ねるラスタタイルの指定です。
 */
export function addRasterTiles(
  map: Pick<
    MaplibreMap,
    "getStyle" | "getSource" | "getLayer" | "addSource" | "addLayer"
  >,
  options: RasterTilesOptions,
): void {
  const url = options.url;
  if (
    typeof url !== "string" ||
    !["{z}", "{x}", "{y}"].every((p) => url.includes(p))
  ) {
    console.warn(
      `[Geolonia] rasterTiles.url must be a tile URL template containing {z}, {x} and {y}: ${String(url)}`,
    );
    return;
  }

  if (map.getLayer(RASTER_TILES_LAYER_ID)) return;

  const source: RasterSourceSpecification = {
    type: "raster",
    tiles: [url],
    tileSize:
      isFiniteNumber(options.tileSize) && options.tileSize > 0
        ? options.tileSize
        : DEFAULT_TILE_SIZE,
  };
  if (options.attribution) source.attribution = options.attribution;
  if (isFiniteNumber(options.minZoom)) source.minzoom = options.minZoom;
  if (isFiniteNumber(options.maxZoom)) source.maxzoom = options.maxZoom;

  const opacity = isFiniteNumber(options.opacity)
    ? Math.min(1, Math.max(0, options.opacity))
    : 1;

  const firstSymbol = map
    .getStyle()
    ?.layers?.find((layer) => layer.type === "symbol");

  if (!map.getSource(RASTER_TILES_SOURCE_ID)) {
    map.addSource(RASTER_TILES_SOURCE_ID, source);
  }
  map.addLayer(
    {
      id: RASTER_TILES_LAYER_ID,
      type: "raster",
      source: RASTER_TILES_SOURCE_ID,
      paint: { "raster-opacity": opacity },
    },
    firstSymbol?.id,
  );
}
