import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import { GeoloniaMap } from "../src/index";

const osmStyle = "https://tile.openstreetmap.jp/styles/osm-bright/style.json";
const vtStyle =
  "https://tile.openstreetmap.jp/styles/maptiler-toner-en/style.json";

const commonOptions = {
  zoom: 10,
  marker: false,
  geoloniaControl: false,
  gestureHandling: false,
  loader: false,
  navigationControl: false,
};

const mapA = new GeoloniaMap({
  container: "#map-a",
  style: osmStyle,
  center: [139.7671, 35.6812],
  ...commonOptions,
});

const mapB = new GeoloniaMap({
  container: "#map-b",
  style: vtStyle,
  center: [135.5023, 34.6937],
  ...commonOptions,
});

// Attempt a double initialization on the same container for the "prevents
// double init" test. Should return the existing mapA instance, not create a
// new one.
const mapADup = new GeoloniaMap({
  container: "#map-a",
  style: osmStyle,
  ...commonOptions,
});

(window as unknown as Record<string, unknown>).mapA = mapA;
(window as unknown as Record<string, unknown>).mapB = mapB;
(window as unknown as Record<string, unknown>).mapADup = mapADup;
