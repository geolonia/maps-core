import type { ExpiryData, GetResourceResponse } from "maplibre-gl";
import { keyring } from "./keyring";

export type GetImageCallback = (
  error?: Error | null,
  image?: HTMLImageElement | ImageBitmap | null,
  expiry?: ExpiryData | null,
) => void;

/**
 * Resolve a URL string.
 * Returns the URL if it's absolute or relative, false otherwise.
 */
export function isURL(str: string): string | false {
  if (str.match(/^https?:\/\//)) {
    return str;
  }
  if (str.match(/^\//) || str.match(/^\.\.?/)) {
    try {
      return new URL(str, globalThis.location?.href).href;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * 与えられた URL が Geolonia のタイルホストかどうかを判定します。
 *
 * ホスト名が `tileserver.geolonia.com` に完全一致するか、または
 * `.tiles.geolonia.com` で終わる場合に Geolonia のタイルホストとみなします。
 * URL の解釈に失敗した場合は `false` を返します。
 *
 * @param url 判定対象の URL 文字列または `URL` オブジェクト。
 * @returns Geolonia のタイルホストであれば `true`、それ以外や解釈に失敗した場合は `false`。
 */
export function isGeoloniaTilesHost(url: string | URL): boolean {
  try {
    const urlObj = typeof url === "string" ? new URL(url) : url;
    return (
      urlObj.hostname === "tileserver.geolonia.com" ||
      urlObj.hostname.endsWith(".tiles.geolonia.com")
    );
  } catch {
    return false;
  }
}

/**
 * スタイル名または URL を完全なスタイル URL に解決します。
 *
 * 解決のルールは次のとおりです。
 *
 * - `style` が空文字の場合は、`basic-v2` のデフォルトスタイル URL を返します。
 * - `style` が絶対 URL または相対 URL の場合は、そのまま解決した URL を返します。
 * - `style` が `.json` で終わる場合は、`.json` ファイルへの URL として解決します。
 * - 上記以外は Geolonia の論理名とみなし、
 *   `https://cdn.geolonia.com/style/<name>/<ja|en>.json` を返します。
 *
 * `lang` が `"ja"` または `"ja-jp"` の場合は `ja` 版、それ以外は `en` 版のスタイルを返します。
 *
 * `style` が Geolonia のスタイルであるにもかかわらず API キーが指定されていない場合は
 * エラーを投げます。API キーは `options.apiKey`、指定がなければ `keyring.apiKey` を使用します。
 *
 * @param style スタイル名または URL。空文字の場合はデフォルトスタイルを返します。
 * @param options 解決時のオプション。
 * @param options.lang 言語コード。`"ja"` または `"ja-jp"` で日本語版、省略時は `"en"`。
 * @param options.apiKey Geolonia スタイルの利用に必要な API キー。省略時は `keyring.apiKey` を使用します。
 * @returns 解決された完全なスタイル URL。
 * @throws {Error} Geolonia のスタイルであるのに API キーが指定されていない場合。
 *
 * @example
 * ```typescript
 * // 論理名を日本語版のスタイル URL に解決する
 * getStyle("geolonia/basic-v2", { lang: "ja", apiKey: "YOUR-API-KEY" });
 * // => "https://cdn.geolonia.com/style/geolonia/basic-v2/ja.json"
 *
 * // 空文字を渡すとデフォルトスタイルを返す
 * getStyle("", { apiKey: "YOUR-API-KEY" });
 * // => "https://cdn.geolonia.com/style/geolonia/basic-v2/en.json"
 *
 * // URL はそのまま解決する
 * getStyle("https://example.com/style.json", {});
 * // => "https://example.com/style.json"
 * ```
 */
export function getStyle(
  style: string,
  options: { lang?: string; apiKey?: string },
): string {
  const lang = options.lang || "en";
  const apiKey = options.apiKey || keyring.apiKey;

  if (keyring.isGeoloniaStyleCheck(style) && !apiKey) {
    throw new Error("[Geolonia] API key is required to use Geolonia styles.");
  }

  if (!style || style === "") {
    return `https://cdn.geolonia.com/style/geolonia/basic-v2/${lang === "ja" || lang === "ja-jp" ? "ja" : "en"}.json`;
  }

  const styleUrl = isURL(style);
  if (styleUrl) {
    return styleUrl;
  }

  if (style.endsWith(".json")) {
    try {
      return new URL(style, globalThis.location?.href).href;
    } catch {
      return style;
    }
  }

  // Geolonia logical name like "geolonia/basic-v2"
  return `https://cdn.geolonia.com/style/${style}/${lang === "ja" || lang === "ja-jp" ? "ja" : "en"}.json`;
}

/**
 * ブラウザの言語設定を検出して `"ja"` または `"en"` を返します。
 *
 * `navigator.languages[0]`、なければ `navigator.language` を小文字化して判定します。
 * 値が `"ja"` または `"ja-jp"` の場合は `"ja"`、それ以外は `"en"` を返します。
 * `navigator` が存在しない環境では `"en"` を返します。
 *
 * @returns 検出された言語。日本語なら `"ja"`、それ以外は `"en"`。
 */
export function getLang(): "ja" | "en" {
  if (typeof globalThis.navigator === "undefined") {
    return "en";
  }
  const lang =
    globalThis.navigator.languages?.[0]?.toLowerCase() ||
    globalThis.navigator.language?.toLowerCase();
  return lang === "ja" || lang === "ja-jp" ? "ja" : "en";
}

/**
 * Generate a random session ID.
 */
let sessionId = "";
export function getSessionId(digit: number): string {
  if (sessionId) {
    return sessionId;
  }
  const array = new Uint8Array(digit / 2);
  crypto.getRandomValues(array);
  sessionId = Array.from(array, (dec) =>
    dec.toString(16).padStart(2, "0"),
  ).join("");
  return sessionId;
}

export function resetSessionId(): void {
  sessionId = "";
}

/**
 * Parse a control option value.
 * Accepts boolean or ControlPosition string.
 */
export function parseControlOption(value: boolean | string | undefined): {
  enabled: boolean;
  position: string | undefined;
} {
  if (typeof value === "boolean") {
    return { enabled: value, position: undefined };
  }
  if (typeof value === "string") {
    const positions = ["top-right", "bottom-right", "bottom-left", "top-left"];
    if (positions.includes(value.toLowerCase())) {
      return { enabled: true, position: value.toLowerCase() };
    }
  }
  return { enabled: false, position: undefined };
}

export function parseSimpleVector(attributeValue: string): string {
  if (/^(https?|geolonia):\/\//.test(attributeValue)) {
    return attributeValue;
  }
  return `geolonia://tiles/custom/${attributeValue}`;
}

export function handleRestrictedMode(map: {
  getContainer: () => HTMLElement;
  remove: () => void;
  _geolonia_restricted_mode_handled?: boolean;
}): void {
  if (!map._geolonia_restricted_mode_handled) {
    map._geolonia_restricted_mode_handled = true;
    const container = map.getContainer();
    map.remove();
    container.innerHTML = "";
    container.classList.add("geolonia__restricted-mode-image-container");
  }
}

export function handleErrorMode(container: HTMLElement): void {
  const errorContainer = document.createElement("div");
  errorContainer.classList.add("geolonia__error-container");

  const div = document.createElement("div");
  const h2 = document.createElement("h2");
  h2.textContent = "Geolonia Maps";
  div.appendChild(h2);
  div.classList.add("geolonia__error-message");
  div.innerHTML +=
    '<div class="geolonia__error-message-description">地図の初期化に失敗しました。管理者にお問い合わせ下さい。</div>';

  errorContainer.appendChild(div);
  container.appendChild(errorContainer);
}

export async function sanitizeDescription(
  description: string,
): Promise<string> {
  const { default: sanitizeHtml } = await import("sanitize-html");
  return sanitizeHtml(description, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["class"],
    },
  });
}

/**
 * Backward compatibility for loadImage callback style.
 */
export function loadImageCompatibility(
  promise: Promise<GetResourceResponse<HTMLImageElement | ImageBitmap>>,
  callback: GetImageCallback,
): void {
  promise
    .then((response) => {
      callback(null, response.data, {
        cacheControl: response.cacheControl,
        expires: response.expires,
      });
    })
    .catch((error) => {
      callback(error);
    });
}
