import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import { GeoloniaMap } from "../src/index";

// Use two distinct local fixtures so the "different styles per map" assertion
// in multiple-maps.spec.ts can compare them without external dependencies.
const styleA = "/sample-basic-style.json";
const styleB = "/sample-3d-style.json";

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
  style: styleA,
  center: [139.7671, 35.6812],
  ...commonOptions,
});

const mapB = new GeoloniaMap({
  container: "#map-b",
  style: styleB,
  center: [135.5023, 34.6937],
  ...commonOptions,
});

// Attempt a double initialization on the same container for the "prevents
// double init" test. Should return the existing mapA instance, not create a
// new one.
const mapADup = new GeoloniaMap({
  container: "#map-a",
  style: styleA,
  ...commonOptions,
});

(window as unknown as Record<string, unknown>).mapA = mapA;
(window as unknown as Record<string, unknown>).mapB = mapB;
(window as unknown as Record<string, unknown>).mapADup = mapADup;
