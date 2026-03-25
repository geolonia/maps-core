import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import { GeoloniaMap } from "../src/index";

const map = new GeoloniaMap({
  container: "#map",
  apiKey: "YOUR-API-KEY",
  style: "geolonia/basic-v2",
  center: [139.7671, 35.6812],
  zoom: 14,
  marker: false,
  gestureHandling: false,
  loader: false,
});

(window as unknown as Record<string, unknown>).map = map;
