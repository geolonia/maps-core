import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import type { GeoloniaMapOptions } from "../src/index";
import { GeoloniaMap } from "../src/index";

// Read options from URL search params so e2e tests can configure dynamically
const params = new URLSearchParams(window.location.search);

const options: GeoloniaMapOptions = {
  container: "#map",
  style: params.get("style") || "/sample-basic-style.json",
  center: params.has("center")
    ? JSON.parse(params.get("center") ?? "[]")
    : [139.7671, 35.6812],
  zoom: params.has("zoom") ? Number(params.get("zoom")) : 12,
  navigationControl: false,
  geoloniaControl: false,
  gestureHandling: false,
  loader: false,
};

if (params.has("minZoom")) options.minZoom = Number(params.get("minZoom"));
if (params.has("maxZoom")) options.maxZoom = Number(params.get("maxZoom"));
if (params.has("bearing")) options.bearing = Number(params.get("bearing"));
if (params.has("pitch")) options.pitch = Number(params.get("pitch"));
if (params.get("hash") === "true") options.hash = true;
if (params.has("lang")) {
  options.lang = params.get("lang") as "ja" | "en" | "auto";
}
if (params.has("apiKey")) options.apiKey = params.get("apiKey") ?? "";

const map = new GeoloniaMap(options);

(window as unknown as Record<string, unknown>).map = map;
