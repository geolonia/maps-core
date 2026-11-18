import type { Point } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

const ALLOWED_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "del",
  "div",
  "em",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "ul",
  "var",
  "wbr",
]);

const ALLOWED_ATTRIBUTES = new Set([
  "alt",
  "class",
  "datetime",
  "dir",
  "height",
  "href",
  "hreflang",
  "lang",
  "referrerpolicy",
  "rel",
  "role",
  "src",
  "target",
  "title",
  "translate",
  "type",
  "width",
]);

const URL_ATTRIBUTES = new Set(["href", "src"]);

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * 相対 URL は、プロトコルを読む前に何かに対して解決する必要がある。
 * 使うのは結果のプロトコルだけなので、この基点が出力に漏れることはない。
 */
const RELATIVE_URL_BASE = "https://maplibre.invalid/";

type ElementInternals = {
  getAttribute: Element["getAttribute"];
  getAttributeNames: Element["getAttributeNames"];
  querySelectorAll: (this: Element, selectors: string) => NodeListOf<Element>;
  remove: Element["remove"];
  removeAttribute: Element["removeAttribute"];
  localName: (this: Element) => string;
  namespaceURI: (this: Element) => string;
};

let elementInternals: ElementInternals | undefined;

/**
 * サニタイザーが使う `Element` のメンバーを、見ている要素ではなくプロトタイプから読む。
 * `children`、`remove`、`localName` という名前のフォームコントロールは、自分の form 要素の
 * 同名のプロパティを隠すので、信頼できないマークアップが、サニタイザーの見る木を選べてしまう。
 * モジュールの読み込み時ではなく初回の利用時に読む（DOM が無い環境でも import されるため）。
 */
function getElementInternals(): ElementInternals {
  if (elementInternals) return elementInternals;
  elementInternals = {
    getAttribute: Element.prototype.getAttribute,
    getAttributeNames: Element.prototype.getAttributeNames,
    querySelectorAll: Element.prototype.querySelectorAll,
    remove: Element.prototype.remove,
    removeAttribute: Element.prototype.removeAttribute,
    localName: Object.getOwnPropertyDescriptor(Element.prototype, "localName")
      ?.get as () => string,
    namespaceURI: Object.getOwnPropertyDescriptor(
      Element.prototype,
      "namespaceURI",
    )?.get as () => string,
  };
  return elementInternals;
}

/**
 * `href` と `src` は、許可したプロトコルだけに絞る。生の文字列ではなく解析した URL からプロトコルを読むのは、
 * ブラウザが適用する URL パーサーが、タブ、改行、先頭の制御文字を無視するため。
 */
function isAllowedAttribute(name: string, value: string): boolean {
  if (!ALLOWED_ATTRIBUTES.has(name) && !name.startsWith("aria-")) return false;
  if (!URL_ATTRIBUTES.has(name)) return true;
  try {
    return ALLOWED_PROTOCOLS.has(new URL(value, RELATIVE_URL_BASE).protocol);
  } catch {
    return false;
  }
}

function isAllowedElement(element: Element): boolean {
  const { namespaceURI, localName } = getElementInternals();
  return (
    namespaceURI.call(element) === HTML_NAMESPACE &&
    ALLOWED_TAGS.has(localName.call(element))
  );
}

function removeDisallowedAttributes(element: Element): void {
  const { getAttributeNames, getAttribute, removeAttribute } =
    getElementInternals();
  for (const name of getAttributeNames.call(element)) {
    if (isAllowedAttribute(name, getAttribute.call(element, name) ?? ""))
      continue;
    removeAttribute.call(element, name);
  }
}

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
      DOM.#userSelect = (DOM.#docStyle as unknown as Record<string, string>)[
        DOM.#selectProp
      ];
      (DOM.#docStyle as unknown as Record<string, string>)[DOM.#selectProp] =
        "none";
    }
  }

  static enableDrag(): void {
    if (DOM.#docStyle && DOM.#selectProp) {
      (DOM.#docStyle as unknown as Record<string, string>)[DOM.#selectProp] =
        DOM.#userSelect ?? "";
    }
  }

  static setTransform(el: HTMLElement, value: string): void {
    (el.style as unknown as Record<string, string>)[DOM.#transformProp] = value;
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

  static mousePos(el: HTMLElement, e: MouseEvent): Point {
    const rect = el.getBoundingClientRect();
    return new maplibregl.Point(
      e.clientX - rect.left - el.clientLeft,
      e.clientY - rect.top - el.clientTop,
    );
  }

  static touchPos(el: HTMLElement, touches: TouchList): Point[] {
    const rect = el.getBoundingClientRect();
    const points: Point[] = [];
    for (let i = 0; i < touches.length; i++) {
      points.push(
        new maplibregl.Point(
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

  /**
   * 信頼できない HTML 文字列（スタイルやオプションで渡された出典など）をサニタイズします。
   * 許可したタグと属性だけを残し、それ以外は部分木ごと捨てます。既知の危険なものを消す方式ではなく
   * 許可リスト方式なのは、前者は知らないものを黙って通すため。
   * 文字列ではなくノードを返すのは、直列化して再解析すると、入れ子にしたマークアップが
   * サニタイズ済みでない別の木に変わりうるため。
   * MapLibre の `DOM.sanitize()`（GHSA-jrc7-96c5-q579 の修正後、6.4.1 以降）と同じ許可リストです。
   */
  static sanitize(str: string): DocumentFragment {
    const doc = new DOMParser().parseFromString(str, "text/html");
    const body = doc.body;
    const { querySelectorAll, remove } = getElementInternals();
    for (const element of Array.from(querySelectorAll.call(body, "*"))) {
      if (isAllowedElement(element)) {
        removeDisallowedAttributes(element);
      } else {
        remove.call(element);
      }
    }
    const fragment = document.createDocumentFragment();
    fragment.append(...Array.from(body.childNodes));
    return fragment;
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
