import { Point } from "maplibre-gl";

/**
 * DOM utility class extracted from maplibre-gl-js.
 * https://github.com/maplibre/maplibre-gl-js/blob/main/src/util/dom.ts
 */
export class DOM {
  static #docStyle: CSSStyleDeclaration | false =
    typeof window !== "undefined" &&
    window.document &&
    window.document.documentElement.style;

  static #userSelect: string | undefined;

  static #selectProp: string = DOM.testProp([
    "userSelect",
    "MozUserSelect",
    "WebkitUserSelect",
    "msUserSelect",
  ]);

  static #transformProp: string = DOM.testProp([
    "transform",
    "WebkitTransform",
  ]);

  static testProp(props: string[]): string {
    if (!DOM.#docStyle) return props[0];
    for (let i = 0; i < props.length; i++) {
      if (props[i] in DOM.#docStyle) {
        return props[i];
      }
    }
    return props[0];
  }

  static create(
    tagName: string,
    className?: string,
    container?: HTMLElement,
  ): HTMLElement {
    const el = window.document.createElement(tagName);
    if (className !== undefined) el.className = className;
    if (container) container.appendChild(el);
    return el;
  }

  static createNS(namespaceURI: string, tagName: string): Element {
    return window.document.createElementNS(namespaceURI, tagName);
  }

  static disableDrag(): void {
    if (DOM.#docStyle && DOM.#selectProp) {
      DOM.#userSelect = (DOM.#docStyle as Record<string, string>)[
        DOM.#selectProp
      ];
      (DOM.#docStyle as Record<string, string>)[DOM.#selectProp] = "none";
    }
  }

  static enableDrag(): void {
    if (DOM.#docStyle && DOM.#selectProp) {
      (DOM.#docStyle as Record<string, string>)[DOM.#selectProp] =
        DOM.#userSelect ?? "";
    }
  }

  static setTransform(el: HTMLElement, value: string): void {
    (el.style as Record<string, string>)[DOM.#transformProp] = value;
  }

  static addEventListener(
    target: EventTarget,
    type: string,
    callback: EventListenerOrEventListenerObject,
    options: AddEventListenerOptions,
  ): void {
    if ("passive" in options) {
      target.addEventListener(type, callback, options);
    } else {
      target.addEventListener(type, callback, options.capture);
    }
  }

  static removeEventListener(
    target: EventTarget,
    type: string,
    callback: EventListenerOrEventListenerObject,
    options: EventListenerOptions,
  ): void {
    if ("passive" in options) {
      target.removeEventListener(type, callback, options);
    } else {
      target.removeEventListener(type, callback, options.capture);
    }
  }

  static mousePos(el: HTMLElement, e: MouseEvent): InstanceType<typeof Point> {
    const rect = el.getBoundingClientRect();
    return new Point(
      e.clientX - rect.left - el.clientLeft,
      e.clientY - rect.top - el.clientTop,
    );
  }

  static touchPos(
    el: HTMLElement,
    touches: TouchList,
  ): InstanceType<typeof Point>[] {
    const rect = el.getBoundingClientRect();
    const points: InstanceType<typeof Point>[] = [];
    for (let i = 0; i < touches.length; i++) {
      points.push(
        new Point(
          touches[i].clientX - rect.left - el.clientLeft,
          touches[i].clientY - rect.top - el.clientTop,
        ),
      );
    }
    return points;
  }

  static mouseButton(e: MouseEvent): number {
    return e.button;
  }

  static remove(node: HTMLElement): void {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }
}

/**
 * Bind methods to a context object.
 * https://github.com/maplibre/maplibre-gl-js/blob/main/src/util/util.ts#L223-L228
 */
export function bindAll(fns: string[], context: Record<string, unknown>): void {
  for (const fn of fns) {
    if (typeof context[fn] === "function") {
      context[fn] = (context[fn] as (...args: unknown[]) => unknown).bind(
        context,
      );
    }
  }
}
