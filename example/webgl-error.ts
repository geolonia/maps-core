import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import type { GeoloniaMapOptions } from "../src/index";
import { GeoloniaMap } from "../src/index";

const base: Omit<GeoloniaMapOptions, "container"> = {
  style: "/sample-basic-style.json",
  center: [139.7671, 35.6812],
  zoom: 12,
  marker: false,
  geoloniaControl: false,
  gestureHandling: false,
  navigationControl: false,
};

const cases: Array<Pick<GeoloniaMapOptions, "container" | "errorMessage">> = [
  { container: "#map-large" },
  { container: "#map-medium" },
  { container: "#map-small" },
  {
    container: "#map-custom",
    errorMessage:
      "地図を表示できませんでした。お手数ですが 0120-000-000 までご連絡ください。",
  },
  { container: "#map-off", errorMessage: false },
];

// The constructor throws because WebGL is unavailable; that is the point of
// this fixture. Keep going so every case renders its own error state.
for (const options of cases) {
  try {
    new GeoloniaMap({ ...base, ...options });
  } catch {
    // expected
  }
}
