import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import type { ControlPosition } from "maplibre-gl";
import { GeoloniaMap } from "../src/index";

// Read control options from URL search params
const params = new URLSearchParams(window.location.search);

function parseBoolOrPosition(
  value: string | null,
): boolean | ControlPosition | undefined {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return value as ControlPosition;
}

const map = new GeoloniaMap({
  container: "#map",
  style: "https://tile.openstreetmap.jp/styles/osm-bright/style.json",
  center: [139.7671, 35.6812],
  zoom: 12,
  gestureHandling: false,
  loader: false,
  navigationControl:
    parseBoolOrPosition(params.get("navigationControl")) ?? true,
  fullscreenControl:
    parseBoolOrPosition(params.get("fullscreenControl")) ?? false,
  scaleControl: parseBoolOrPosition(params.get("scaleControl")) ?? false,
  geolocateControl:
    parseBoolOrPosition(params.get("geolocateControl")) ?? false,
  geoloniaControl: parseBoolOrPosition(params.get("geoloniaControl")) ?? true,
});

(window as unknown as Record<string, unknown>).map = map;
