import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import type { GeoloniaMapOptions } from "../src/index";
import { GeoloniaMap } from "../src/index";

// Read options from URL search params so e2e tests can configure dynamically
const params = new URLSearchParams(window.location.search);

const options: GeoloniaMapOptions = {
  container: "#map",
  style: "https://tile.openstreetmap.jp/styles/osm-bright/style.json",
  center: [139.7671, 35.6812],
  zoom: 14,
  marker: params.get("marker") !== "false",
  markerColor: params.get("markerColor") || "#FF0000",
  openPopup: params.get("openPopup") !== "false",
  gestureHandling: false,
  geoloniaControl: false,
  loader: false,
};

if (params.has("customMarker")) {
  options.customMarker = params.get("customMarker")!;
}

// Set popup content via dataset unless disabled
const mapEl = document.querySelector("#map");
if (mapEl instanceof HTMLElement && params.get("popupContent") !== "false") {
  mapEl.dataset.popupContent = '<p class="test-popup">Hello Tokyo</p>';
}

const map = new GeoloniaMap(options);

(window as unknown as Record<string, unknown>).map = map;
