/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

// Mock maplibre-gl to neutralize Marker's super() constructor
vi.mock("maplibre-gl", () => {
  class MockMarker {
    _element: HTMLElement;
    _offset: unknown;
    constructor(options: Record<string, unknown> = {}) {
      this._element =
        (options.element as HTMLElement) || document.createElement("div");
      this._offset = options.offset;
    }
    getElement() {
      return this._element;
    }
  }
  return {
    default: { Marker: MockMarker },
    Marker: MockMarker,
  };
});

beforeAll(() => {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => "blob:mock";
  }
});

import GeoloniaMarker from "../src/lib/geolonia-marker";

describe("GeoloniaMarker", () => {
  it("should generate div with SVG structure when no element is provided", () => {
    const marker = new GeoloniaMarker();
    const el = marker.getElement();

    expect(el.tagName).toBe("DIV");
    expect(el.className).toBe("geolonia-default-marker");

    const svg = el.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.querySelector("circle")).not.toBeNull();
    expect(svg?.querySelector(".left")).not.toBeNull();
    expect(svg?.querySelector(".right")).not.toBeNull();
  });

  it("should apply default color #E4402F", () => {
    const marker = new GeoloniaMarker();
    const el = marker.getElement();

    const left = el.querySelector(".left") as HTMLElement;
    // jsdom normalizes hex to rgb
    expect(left.style.fill).toBe("rgb(228, 64, 47)");
  });

  it("should apply custom color", () => {
    const marker = new GeoloniaMarker({ color: "#0000FF" });
    const el = marker.getElement();

    const left = el.querySelector(".left") as HTMLElement;
    expect(left.style.fill).toBe("rgb(0, 0, 255)");

    const right = el.querySelector(".right") as HTMLElement;
    // right side should be a darkened variant, distinct from left
    expect(right.style.fill).toBeTruthy();
    expect(right.style.fill).not.toBe(left.style.fill);
  });

  it("should set element size to 26px × 34px", () => {
    const marker = new GeoloniaMarker();
    const el = marker.getElement();

    expect(el.style.width).toBe("26px");
    expect(el.style.height).toBe("34px");
  });

  it("should set default offset to [0, -15]", () => {
    const marker = new GeoloniaMarker();
    expect((marker as unknown as { _offset: unknown })._offset).toEqual([
      0, -15,
    ]);
  });

  it("should skip SVG generation when custom element is provided", () => {
    const custom = document.createElement("span");
    custom.textContent = "custom";
    const marker = new GeoloniaMarker({ element: custom });
    const el = marker.getElement();

    expect(el.tagName).toBe("SPAN");
    expect(el.querySelector("svg")).toBeNull();
  });
});
