import type { ControlPosition } from "maplibre-gl";
import type { GeoloniaMapOptions } from "../types";

/**
 * Backward-compatibility layer for the old embed API, where the map was created
 * from a bare container (`new geolonia.Map('#map')` or an HTMLElement) and its
 * `data-*` attributes configured the map. Mirrors embed's attsToOptions() so
 * the legacy calling convention keeps the same defaults and behavior.
 */

const CONTROL_POSITIONS = [
  "top-right",
  "bottom-right",
  "bottom-left",
  "top-left",
] as const;

/** Convert a `data-*-control` value (`on`/`off`/position) to `boolean | ControlPosition`. */
function toControlAttr(value: string): boolean | ControlPosition {
  const v = value.toLowerCase();
  if ((CONTROL_POSITIONS as readonly string[]).includes(v)) {
    return v as ControlPosition;
  }
  return v === "on";
}

/** True when `value` is a CSS selector for an inline element, not a URL/path. */
function isCssSelector(value: string): Element | null {
  if (/^https?:\/\//.test(value) || /^\.?\.?\//.test(value)) {
    return null;
  }
  try {
    return document.querySelector(value);
  } catch {
    return null;
  }
}

/** Resolve a `data-geojson` value to a URL/JSON string or parsed FeatureCollection. */
function resolveGeojson(value: string): string | GeoJSON.FeatureCollection {
  const el = isCssSelector(value);
  if (el?.textContent) {
    return JSON.parse(el.textContent) as GeoJSON.FeatureCollection;
  }
  return value;
}

/** Detect a DOM element without assuming HTMLElement is defined (SSR-safe). */
export function isDomElement(o: unknown): o is HTMLElement {
  return typeof HTMLElement !== "undefined"
    ? o instanceof HTMLElement
    : !!o &&
        typeof o === "object" &&
        (o as { nodeType?: number }).nodeType === 1;
}

/**
 * Read a container's `data-*` attributes into GeoloniaMapOptions, reproducing
 * the legacy embed behavior of `new geolonia.Map('#map')`. Only keys that were
 * meaningful in the old embed are read; the same defaults apply (marker on,
 * loader on, navigation/geolonia control on, etc.).
 */
export function optionsFromContainer(
  container: HTMLElement,
): GeoloniaMapOptions {
  const ds = container.dataset;
  const options: GeoloniaMapOptions = {
    container,
    bearing: Number.parseFloat(ds.bearing ?? "") || 0,
    pitch: Number.parseFloat(ds.pitch ?? "") || 0,
    zoom: Number.parseFloat(ds.zoom ?? "") || 0,
    hash: ds.hash === "on",
    marker: (ds.marker ?? "on") === "on",
    markerColor: ds.markerColor ?? "#E4402F",
    openPopup: ds.openPopup === "on",
    loader: ds.loader !== "off",
    gestureHandling: ds.gestureHandling !== "off",
    navigationControl: toControlAttr(ds.navigationControl ?? "on"),
    geolocateControl: toControlAttr(ds.geolocateControl ?? "off"),
    fullscreenControl: toControlAttr(ds.fullscreenControl ?? "off"),
    scaleControl: toControlAttr(ds.scaleControl ?? "off"),
    geoloniaControl: toControlAttr(ds.geoloniaControl ?? "on"),
    cluster: (ds.cluster ?? "on") === "on",
    clusterColor: ds.clusterColor ?? "#ff0000",
    "3d": ds["3d"] === "on",
  };

  if (ds.style) options.style = ds.style;
  if (ds.lang !== undefined) {
    options.lang = ds.lang as GeoloniaMapOptions["lang"];
  }
  if (ds.key) options.apiKey = ds.key;
  if (ds.stage) options.stage = ds.stage;

  // Set center only when both lat and lng are present (mirrors embed gating:
  // marker requires a center, and GeoJSON fitBounds is skipped when one is set).
  const hasLat = ds.lat !== undefined && ds.lat !== "";
  const hasLng = ds.lng !== undefined && ds.lng !== "";
  if (hasLat && hasLng) {
    options.center = [
      Number.parseFloat(ds.lng as string),
      Number.parseFloat(ds.lat as string),
    ];
  }

  if (ds.customMarker) options.customMarker = ds.customMarker;
  if (ds.customMarkerOffset) {
    const [x, y] = ds.customMarkerOffset
      .split(",")
      .map((n) => Number(n.trim()));
    options.customMarkerOffset = [x || 0, y || 0];
  }
  if (ds.geojson) options.geojson = resolveGeojson(ds.geojson);
  if (ds.simpleVector) options.simpleVector = ds.simpleVector;

  if (
    ds.minZoom !== undefined &&
    ds.minZoom !== "" &&
    (Number(ds.minZoom) === 0 || Number(ds.minZoom))
  ) {
    options.minZoom = Number(ds.minZoom);
  }
  if (
    ds.maxZoom !== undefined &&
    ds.maxZoom !== "" &&
    (Number(ds.maxZoom) === 0 || Number(ds.maxZoom))
  ) {
    options.maxZoom = Number(ds.maxZoom);
  }

  return options;
}

/**
 * Normalize a constructor argument into GeoloniaMapOptions. Accepts the legacy
 * embed forms — a CSS selector string or an HTMLElement — in addition to the
 * options object. Legacy forms read the container's `data-*` attributes; the
 * options object is passed through unchanged.
 */
export function normalizeConstructorArg(
  arg: string | HTMLElement | GeoloniaMapOptions,
): GeoloniaMapOptions {
  if (typeof arg === "string") {
    const el = document.querySelector(arg) || document.getElementById(arg);
    if (!el) {
      throw new Error(
        `[Geolonia] No HTML elements found matching \`${arg}\`. Please ensure the map container element exists.`,
      );
    }
    return optionsFromContainer(el as HTMLElement);
  }
  if (isDomElement(arg)) {
    return optionsFromContainer(arg);
  }
  return arg;
}
