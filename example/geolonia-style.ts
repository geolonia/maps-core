import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import type { GeoloniaMapOptions } from "../src/index";
import { GeoloniaMap } from "../src/index";

const params = new URLSearchParams(window.location.search);

const options: GeoloniaMapOptions = {
  container: "#map",
  apiKey: params.get("apiKey") || "YOUR-API-KEY",
  style: params.get("style") || "geolonia/basic-v2",
  center: [139.7671, 35.6812],
  zoom: 14,
  marker: false,
  gestureHandling: false,
  loader: false,
};

if (params.has("stage")) options.stage = params.get("stage")!;

const map = new GeoloniaMap(options);

(window as unknown as Record<string, unknown>).map = map;
