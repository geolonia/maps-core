import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import type { GeoloniaMapOptions } from "../src/index";
import { GeoloniaMap } from "../src/index";

const params = new URLSearchParams(window.location.search);

const options: GeoloniaMapOptions = {
  container: "#map",
  style: "/sample-3d-style.json",
  center: [139.7671, 35.6812],
  zoom: 10,
  marker: false,
  geoloniaControl: false,
  gestureHandling: false,
  loader: false,
  navigationControl: false,
};

if (params.get("3d") === "true") {
  options["3d"] = true;
}

const map = new GeoloniaMap(options);

(window as unknown as Record<string, unknown>).map = map;
