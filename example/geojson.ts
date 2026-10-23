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

// Data-driven styles: ?viz=choropleth | heatmap | circle
// sample-mesh.geojson (255 polygons with `value`) and sample-spots.geojson
// (400 points with `weight`, `category` and simplestyle `marker-*`) are
// synthetic data generated with a seeded PRNG, not real facilities or statistics.
// They are loaded by URL so that the range is computed after the fetch.
const viz = params.get("viz");
if (viz) {
  options.center = [139.75, 35.68];
  options.zoom = 10;
}
if (viz === "choropleth") {
  options.geojson = "/sample-mesh.geojson";
  options.choropleth = "value";
} else if (viz === "heatmap") {
  options.geojson = "/sample-spots.geojson";
  options.heatmap = "weight";
} else if (viz === "circle") {
  options.geojson = "/sample-spots.geojson";
  options.circle = { size: "weight", color: "category" };
}

if (params.has("cluster")) {
  options.cluster = params.get("cluster") === "true";
}

const map = new GeoloniaMap(options);

// GeoloniaMap listens to "error", so MapLibre does not log style validation
// errors to the console. Keep them for the E2E tests.
const mapErrors: string[] = [];
map.on("error", (e) => mapErrors.push(String(e.error?.message)));
(window as unknown as Record<string, unknown>).mapErrors = mapErrors;

(window as unknown as Record<string, unknown>).map = map;
