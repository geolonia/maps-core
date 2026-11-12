import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import type { GeoloniaMapOptions } from "../src/index";
import { GeoloniaMap } from "../src/index";

const params = new URLSearchParams(window.location.search);

const options: GeoloniaMapOptions = {
  container: "#map",
  style: "/sample-basic-style.json",
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

// ?removeBeforeLoad=true removes a first map before it loads and creates a new
// one in the same container, as React StrictMode does with maps-react's <Map>.
// ?removeTwice=true does the same, and then calls remove() on the first map
// again after the second map has been created.
let first: GeoloniaMap | undefined;
if (
  params.get("removeBeforeLoad") === "true" ||
  params.get("removeTwice") === "true"
) {
  first = new GeoloniaMap(options);
  first.remove();
}

const map = new GeoloniaMap(options);

if (params.get("removeTwice") === "true") {
  first?.remove();
}

(window as unknown as Record<string, unknown>).map = map;
