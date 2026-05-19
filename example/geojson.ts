import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import type { GeoloniaMapOptions } from "../src/index";
import { GeoloniaMap } from "../src/index";

const params = new URLSearchParams(window.location.search);

const inlineGeoJSON: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { title: "Tokyo Station" },
      geometry: { type: "Point", coordinates: [139.767, 35.681] },
    },
    {
      type: "Feature",
      properties: { title: "Shinjuku" },
      geometry: { type: "Point", coordinates: [139.7, 35.689] },
    },
    {
      type: "Feature",
      properties: { title: "Shibuya" },
      geometry: { type: "Point", coordinates: [139.701, 35.659] },
    },
  ],
};

const options: GeoloniaMapOptions = {
  container: "#map",
  style: "/sample-basic-style.json",
  zoom: 12,
  marker: false,
  gestureHandling: false,
  geoloniaControl: false,
  loader: false,
  navigationControl: false,
};

// Default center unless explicitly testing fitBounds (?noCenter=true)
if (params.get("noCenter") !== "true") {
  options.center = [139.7671, 35.6812];
}

// Source: "url" fetches from /sample.geojson, "bad" points to 404,
// otherwise (default) passes the object directly.
const source = params.get("source") || "inline";
if (source === "url") {
  options.geojson = "/sample.geojson";
} else if (source === "bad") {
  options.geojson = "/does-not-exist.geojson";
} else {
  options.geojson = inlineGeoJSON;
}

if (params.has("cluster")) {
  options.cluster = params.get("cluster") === "true";
}

const map = new GeoloniaMap(options);

(window as unknown as Record<string, unknown>).map = map;
