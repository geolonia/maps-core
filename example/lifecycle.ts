import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import { GeoloniaMap } from "../src/index";

// Initialize with an apiKey so that keyring.apiKey is set — required for
// setStyle() with a Geolonia logical name to resolve to the CDN URL.
const map = new GeoloniaMap({
  container: "#map",
  apiKey: "YOUR-API-KEY",
  style: "/sample-basic-style.json",
  center: [139.7671, 35.6812],
  zoom: 12,
  marker: false,
  geoloniaControl: false,
  gestureHandling: false,
  loader: false,
  navigationControl: false,
});

(window as unknown as Record<string, unknown>).map = map;
