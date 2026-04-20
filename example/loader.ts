import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import type { GeoloniaMapOptions } from "../src/index";
import { GeoloniaMap } from "../src/index";

const params = new URLSearchParams(window.location.search);

const options: GeoloniaMapOptions = {
  container: "#map",
  style: "https://tile.openstreetmap.jp/styles/osm-bright/style.json",
  center: [139.7671, 35.6812],
  zoom: 12,
  marker: false,
  geoloniaControl: false,
  gestureHandling: false,
  navigationControl: false,
};

if (params.has("loader")) {
  options.loader = params.get("loader") !== "false";
}

const map = new GeoloniaMap(options);

(window as unknown as Record<string, unknown>).map = map;
