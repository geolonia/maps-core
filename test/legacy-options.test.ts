/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  normalizeConstructorArg,
  optionsFromContainer,
} from "../src/lib/legacy-options";

/**
 * Backward compatibility for the old embed API (maps-core#90): a bare container
 * (CSS selector or HTMLElement) is resolved and its `data-*` attributes are
 * read into GeoloniaMapOptions, mirroring embed's attsToOptions() defaults.
 */
describe("optionsFromContainer", () => {
  it("applies old-embed defaults for an attribute-less container", () => {
    const el = document.createElement("div");
    const opts = optionsFromContainer(el);

    expect(opts.container).toBe(el);
    expect(opts.marker).toBe(true);
    expect(opts.markerColor).toBe("#E4402F");
    expect(opts.loader).toBe(true);
    expect(opts.gestureHandling).toBe(true);
    expect(opts.navigationControl).toBe(true);
    expect(opts.geoloniaControl).toBe(true);
    expect(opts.geolocateControl).toBe(false);
    expect(opts.fullscreenControl).toBe(false);
    expect(opts.scaleControl).toBe(false);
    expect(opts.cluster).toBe(true);
    expect(opts.hash).toBe(false);
    expect(opts["3d"]).toBe(false);
    // No coordinates → no center (keeps marker gating / geojson fitBounds).
    expect(opts.center).toBeUndefined();
  });

  it("reads data-* attributes into options", () => {
    const el = document.createElement("div");
    el.dataset.lat = "34.7";
    el.dataset.lng = "135.5";
    el.dataset.zoom = "10";
    el.dataset.marker = "off";
    el.dataset.hash = "on";
    el.dataset.style = "geolonia/gsi";
    el.dataset.lang = "en";

    const opts = optionsFromContainer(el);

    expect(opts.center).toEqual([135.5, 34.7]);
    expect(opts.zoom).toBe(10);
    expect(opts.marker).toBe(false);
    expect(opts.hash).toBe(true);
    expect(opts.style).toBe("geolonia/gsi");
    expect(opts.lang).toBe("en");
  });

  it("maps control positions and on/off to boolean | ControlPosition", () => {
    const el = document.createElement("div");
    el.dataset.navigationControl = "top-right";
    el.dataset.geolocateControl = "on";
    el.dataset.scaleControl = "off";

    const opts = optionsFromContainer(el);

    expect(opts.navigationControl).toBe("top-right");
    expect(opts.geolocateControl).toBe(true);
    expect(opts.scaleControl).toBe(false);
  });

  it("sets center only when both lat and lng are present", () => {
    const onlyLat = document.createElement("div");
    onlyLat.dataset.lat = "35";
    expect(optionsFromContainer(onlyLat).center).toBeUndefined();
  });

  it('honours data-max-zoom="0" (0 is a valid bound, not falsy)', () => {
    const el = document.createElement("div");
    el.dataset.minZoom = "0";
    el.dataset.maxZoom = "0";

    const opts = optionsFromContainer(el);

    expect(opts.minZoom).toBe(0);
    expect(opts.maxZoom).toBe(0);
  });

  it("parses customMarkerOffset into a numeric tuple", () => {
    const el = document.createElement("div");
    el.dataset.customMarkerOffset = "10, -5";
    expect(optionsFromContainer(el).customMarkerOffset).toEqual([10, -5]);
  });
});

describe("normalizeConstructorArg", () => {
  it("resolves a CSS selector string to its container's options", () => {
    const el = document.createElement("div");
    el.id = "map";
    el.dataset.zoom = "8";
    document.body.appendChild(el);

    const opts = normalizeConstructorArg("#map");
    expect(opts.container).toBe(el);
    expect(opts.zoom).toBe(8);

    el.remove();
  });

  it("resolves a bare element id (getElementById fallback)", () => {
    const el = document.createElement("div");
    el.id = "map2";
    document.body.appendChild(el);

    expect(normalizeConstructorArg("map2").container).toBe(el);

    el.remove();
  });

  it("reads data-* off an HTMLElement argument", () => {
    const el = document.createElement("div");
    el.dataset.zoom = "9";
    expect(normalizeConstructorArg(el).zoom).toBe(9);
  });

  it("passes an options object through unchanged (no data-* parsing)", () => {
    const el = document.createElement("div");
    el.dataset.zoom = "9";
    const options = { container: el, zoom: 3 };
    // Object form must NOT re-read data-* — embed already built the options.
    expect(normalizeConstructorArg(options)).toBe(options);
    expect(normalizeConstructorArg(options).zoom).toBe(3);
  });

  it("throws a helpful error when the selector matches nothing", () => {
    expect(() => normalizeConstructorArg("#does-not-exist")).toThrow(
      /No HTML elements found matching/,
    );
  });
});
