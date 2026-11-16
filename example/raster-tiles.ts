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
});

(window as unknown as Record<string, unknown>).map = map;
