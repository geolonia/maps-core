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
// GeoloniaMap listens to "error", so MapLibre does not log map errors to the
// console. Keep them for the E2E tests.
const mapErrors: string[] = [];
(window as unknown as Record<string, unknown>).mapErrors = mapErrors;
const recordErrors = (m: GeoloniaMap) =>
  m.on("error", (e) => mapErrors.push(String(e.error?.message)));

let first: GeoloniaMap | undefined;
if (
  params.get("removeBeforeLoad") === "true" ||
  params.get("removeTwice") === "true"
) {
  first = new GeoloniaMap(options);
  recordErrors(first);
  first.remove();
}

const map = new GeoloniaMap(options);
recordErrors(map);
// ?recreateOnRemove=true replaces this with the recreated map below.
(window as unknown as Record<string, unknown>).map = map;

if (params.get("removeTwice") === "true") {
  first?.remove();
}

// ?recreateOnRemove=true creates a new map in the same container from a
// "remove" listener of the first map, before the first map has loaded.
if (params.get("recreateOnRemove") === "true") {
  const original = map;
  original.on("remove", () => {
    const recreated = new GeoloniaMap(options);
    recordErrors(recreated);
    const w = window as unknown as Record<string, unknown>;
    w.map = recreated;
    w.recreatedIsNew = recreated !== original;
  });
  original.remove();
}
