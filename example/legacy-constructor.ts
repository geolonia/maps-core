import "maplibre-gl/dist/maplibre-gl.css";
import "../src/assets/style.css";
import { GeoloniaMap } from "../src/index";

// Legacy embed API: pass a bare CSS selector string. The container's `data-*`
// attributes are read into the map options (center, zoom, controls, ...).
const params = new URLSearchParams(window.location.search);
const arg = params.get("arg");

// `arg=element` exercises the HTMLElement form; anything else uses the selector.
const map =
  arg === "element"
    ? new GeoloniaMap(document.getElementById("map") as HTMLElement)
    : new GeoloniaMap("#map");

(window as unknown as Record<string, unknown>).map = map;
