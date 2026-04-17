import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import type { GeoloniaMapOptions } from "../src/index";
import { GeoloniaMap } from "../src/index";

const params = new URLSearchParams(window.location.search);

const options: GeoloniaMapOptions = {
  container: "#map",
  style: "https://tile.openstreetmap.jp/styles/osm-bright/style.json",
  zoom: 6,
  marker: false,
  gestureHandling: false,
  geoloniaControl: false,
  loader: false,
  navigationControl: false,
  simpleVector:
    params.get("simpleVector") || "http://localhost:5174/sample-vector.json",
};

// Only set center when explicitly asked, so fitBounds behavior can be tested.
if (params.get("noCenter") !== "true") {
  options.center = [139.7671, 35.6812];
}

const map = new GeoloniaMap(options);

(window as unknown as Record<string, unknown>).map = map;
