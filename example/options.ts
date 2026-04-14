import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import { GeoloniaMap } from "../src/index";

// Read options from URL search params so e2e tests can configure dynamically
const params = new URLSearchParams(window.location.search);

const map = new GeoloniaMap({
  container: "#map",
  style:
    params.get("style") ||
    "https://tile.openstreetmap.jp/styles/osm-bright/style.json",
  center: params.has("center")
    ? JSON.parse(params.get("center")!)
    : [139.7671, 35.6812],
  zoom: params.has("zoom") ? Number(params.get("zoom")) : 12,
  minZoom: params.has("minZoom") ? Number(params.get("minZoom")) : undefined,
  maxZoom: params.has("maxZoom") ? Number(params.get("maxZoom")) : undefined,
  bearing: params.has("bearing") ? Number(params.get("bearing")) : undefined,
  pitch: params.has("pitch") ? Number(params.get("pitch")) : undefined,
  hash: params.get("hash") === "true",
  lang: (params.get("lang") as "ja" | "en" | "auto") || undefined,
  navigationControl: false,
  geoloniaControl: false,
  gestureHandling: false,
  loader: false,
});

(window as unknown as Record<string, unknown>).map = map;
