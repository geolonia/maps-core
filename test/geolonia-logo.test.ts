/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { GeoloniaControl } from "../src/lib/controls/geolonia-logo";

describe("GeoloniaControl", () => {
  it("should return bottom-left as default position", () => {
    const ctrl = new GeoloniaControl();
    expect(ctrl.getDefaultPosition()).toBe("bottom-left");
  });

  it("should create a container with maplibregl-ctrl class", () => {
    const ctrl = new GeoloniaControl();
    const container = ctrl.onAdd();
    expect(container).toBeInstanceOf(HTMLDivElement);
    expect(container.className).toBe("maplibregl-ctrl");
  });

  it("should contain a link to geolonia.com", () => {
    const ctrl = new GeoloniaControl();
    const container = ctrl.onAdd();
    const link = container.querySelector("a") as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.href).toBe("https://geolonia.com/");
    expect(link.title).toBe("Powered by Geolonia");
  });

  it("should contain an img with Geolonia logo", () => {
    const ctrl = new GeoloniaControl();
    const container = ctrl.onAdd();
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain("geolonia-symbol");
    expect(img.alt).toBe("Geolonia");
    expect(img.style.width).toBe("16px");
    expect(img.style.height).toBe("16px");
  });

  it("should remove container from parent on onRemove", () => {
    const ctrl = new GeoloniaControl();
    const container = ctrl.onAdd();
    const parent = document.createElement("div");
    parent.appendChild(container);

    expect(parent.children.length).toBe(1);
    ctrl.onRemove();
    expect(parent.children.length).toBe(0);
  });
});
