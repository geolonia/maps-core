import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import { GeoloniaMap } from "../src/index";

// Map with apiKey set but using an external (non-Geolonia) style.
// Used to verify the API key is NOT appended to non-Geolonia tile URLs.
const map = new GeoloniaMap({
  container: "#map",
  apiKey: "YOUR-API-KEY",
  style: "https://tile.openstreetmap.jp/styles/osm-bright/style.json",
  center: [139.7671, 35.6812],
  zoom: 12,
  marker: false,
  gestureHandling: false,
  loader: false,
  navigationControl: false,
});

(window as unknown as Record<string, unknown>).map = map;
