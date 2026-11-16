import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import { GeoloniaMap } from "../src/index";

const params = new URLSearchParams(window.location.search);

const map = new GeoloniaMap({
  container: "#map",
  style: "/sample-basic-style.json",
  center: [139.7671, 35.6812],
  zoom: 10,
  marker: false,
  gestureHandling: false,
  geoloniaControl: false,
  loader: false,
  navigationControl: false,
  // E2E で描画結果の画素を読むため。
  canvasContextAttributes: { preserveDrawingBuffer: true },
  rasterTiles: {
    url:
      params.get("url") || "https://raster.example.com/tiles/{z}/{x}/{y}.png",
    attribution: '<a href="https://raster.example.com/">Raster fixture</a>',
    opacity: Number(params.get("opacity") ?? 1),
    maxZoom: 12,
  },
  // 重なり順の E2E のため。geojson のレイヤはラスタタイルより上に描かれる。
  ...(params.get("geojson") === "true"
    ? {
        geojson: {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "Polygon" as const,
                coordinates: [
                  [
                    [139.7, 35.65],
                    [139.8, 35.65],
                    [139.8, 35.7],
                    [139.7, 35.65],
                  ],
                ],
              },
            },
          ],
        },
      }
    : {}),
  // 重なり順の E2E のため。既定の位置のマスクはラスタタイルより上に入る。
  ...(params.get("mask") === "true"
    ? { mask: { geojson: "/sample-boundary.geojson", outline: true } }
    : {}),
});

(window as unknown as Record<string, unknown>).map = map;
