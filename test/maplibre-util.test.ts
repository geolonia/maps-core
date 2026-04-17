/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindAll, DOM } from "../src/lib/maplibre-util";

describe("DOM.create", () => {
  it("should create an element with given tag name", () => {
    const el = DOM.create("div");
    expect(el.tagName).toBe("DIV");
  });

  it("should set className when provided", () => {
    const el = DOM.create("span", "my-class");
    expect(el.className).toBe("my-class");
  });

  it("should append to container when provided", () => {
    const container = document.createElement("div");
    const el = DOM.create("p", "child", container);
    expect(container.children.length).toBe(1);
    expect(container.children[0]).toBe(el);
  });

  it("should not set className when undefined", () => {
    const el = DOM.create("div");
    expect(el.className).toBe("");
  });
});

describe("DOM.remove", () => {
  it("should remove node from parent", () => {
    const parent = document.createElement("div");
    const child = document.createElement("span");
    parent.appendChild(child);

    expect(parent.children.length).toBe(1);
    DOM.remove(child);
    expect(parent.children.length).toBe(0);
  });

  it("should not throw if node has no parent", () => {
    const orphan = document.createElement("div");
    expect(() => DOM.remove(orphan)).not.toThrow();
  });
});

describe("DOM.createNS", () => {
  it("should create an element with namespace", () => {
    const el = DOM.createNS("http://www.w3.org/2000/svg", "svg");
    expect(el.tagName).toBe("svg");
    expect(el.namespaceURI).toBe("http://www.w3.org/2000/svg");
  });
});

describe("DOM.mousePos", () => {
  it("should return a Point with correct coordinates", () => {
    const el = document.createElement("div");
    // jsdom does not populate getBoundingClientRect by default, so we stub it
    el.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 10,
      y: 20,
      toJSON() {},
    });
    // clientLeft/clientTop default to 0 in jsdom

    const event = new MouseEvent("click", { clientX: 50, clientY: 80 });
    const point = DOM.mousePos(el, event);

    // x = clientX(50) - rect.left(10) - clientLeft(0) = 40
    // y = clientY(80) - rect.top(20) - clientTop(0) = 60
    expect(point.x).toBe(40);
    expect(point.y).toBe(60);
  });
});

describe("DOM.touchPos", () => {
  it("should return an array of Points for each touch", () => {
    const el = document.createElement("div");
    el.getBoundingClientRect = () => ({
      left: 5,
      top: 10,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 5,
      y: 10,
      toJSON() {},
    });

    const touches = {
      length: 2,
      0: { clientX: 25, clientY: 40 },
      1: { clientX: 55, clientY: 70 },
      item: (i: number) => (touches as Record<number, unknown>)[i],
    } as unknown as TouchList;

    const points = DOM.touchPos(el, touches);

    expect(points).toHaveLength(2);
    // touch 0: x = 25 - 5 - 0 = 20, y = 40 - 10 - 0 = 30
    expect(points[0].x).toBe(20);
    expect(points[0].y).toBe(30);
    // touch 1: x = 55 - 5 - 0 = 50, y = 70 - 10 - 0 = 60
    expect(points[1].x).toBe(50);
    expect(points[1].y).toBe(60);
  });

  it("should return an empty array when there are no touches", () => {
    const el = document.createElement("div");
    el.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON() {},
    });

    const touches = {
      length: 0,
      item: () => null,
    } as unknown as TouchList;

    const points = DOM.touchPos(el, touches);
    expect(points).toHaveLength(0);
  });
});

describe("DOM.mouseButton", () => {
  it("should return the mouse button value", () => {
    const event = new MouseEvent("mousedown", { button: 2 });
    expect(DOM.mouseButton(event)).toBe(2);
  });
});

describe("DOM.setTransform", () => {
  it("should set the transform style property", () => {
    const el = document.createElement("div");
    DOM.setTransform(el, "translate(10px, 20px)");
    expect(el.style.transform).toBe("translate(10px, 20px)");
  });
});

describe("DOM.addEventListener / removeEventListener", () => {
  it("should add and remove event listener with passive option", () => {
    const target = document.createElement("div");
    const callback = vi.fn();

    DOM.addEventListener(target, "click", callback, { passive: true });
    target.dispatchEvent(new Event("click"));
    expect(callback).toHaveBeenCalledTimes(1);

    DOM.removeEventListener(target, "click", callback, { passive: true });
    target.dispatchEvent(new Event("click"));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should add and remove event listener with capture option", () => {
    const parent = document.createElement("div");
    const child = document.createElement("div");
    parent.appendChild(child);
    document.body.appendChild(parent);
    const callback = vi.fn();

    DOM.addEventListener(parent, "click", callback, { capture: true });
    child.dispatchEvent(new Event("click", { bubbles: true }));
    expect(callback).toHaveBeenCalledTimes(1);

    DOM.removeEventListener(parent, "click", callback, { capture: true });
    child.dispatchEvent(new Event("click", { bubbles: true }));
    expect(callback).toHaveBeenCalledTimes(1);
    parent.remove();
  });
});

describe("DOM.disableDrag / enableDrag", () => {
  const originalUserSelect = document.documentElement.style.userSelect;

  afterEach(() => {
    document.documentElement.style.userSelect = originalUserSelect;
  });

  it("should disable and re-enable user-select", () => {
    const style = document.documentElement.style;
    style.userSelect = "auto";

    DOM.disableDrag();
    expect(style.userSelect).toBe("none");

    DOM.enableDrag();
    expect(style.userSelect).toBe("auto");
  });
});

describe("bindAll", () => {
  it("should bind methods to context", () => {
    const obj = {
      value: 42,
      getValue() {
        return this.value;
      },
    };

    bindAll(["getValue"], obj as unknown as Record<string, unknown>);

    const fn = obj.getValue;
    expect(fn()).toBe(42);
  });

  it("should skip non-existent methods", () => {
    const obj = { value: 1 };
    expect(() =>
      bindAll(["nonExistent"], obj as unknown as Record<string, unknown>),
    ).not.toThrow();
  });

  it("should skip non-function properties", () => {
    const obj = { value: 42 };
    expect(() =>
      bindAll(["value"], obj as unknown as Record<string, unknown>),
    ).not.toThrow();
  });
});
