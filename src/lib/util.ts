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

/**
 * 地図の初期化に失敗したときのエラー表示。
 *
 * 既定では「WebGL が使えない状態かもしれない」という原因と、利用者が自分で試せる
 * 復旧手順を描画する。手順を書き切った版と 1 行の短縮版の両方を DOM に入れておき、
 * どちらを見せるかは地図コンテナの広さに応じて CSS（コンテナクエリ）が決める。
 *
 * `message` に文字列を渡すとその文言に差し替える（HTML としては解釈しない）。
 * `false` または `'off'` を渡すとエラー表示自体を行わない。
 *
 * @param container 地図コンテナ
 * @param options `message` に差し替え文言、`false` / `'off'` で表示しない
 */
export function handleErrorMode(
  container: HTMLElement,
  options: { message?: string | false } = {},
): void {
  if (options.message === false) {
    return;
  }

  const message = (options.message ?? "").trim();
  if (message.toLowerCase() === "off") {
    return;
  }

  const errorContainer = document.createElement("div");
  errorContainer.classList.add("geolonia__error-container");

  const div = document.createElement("div");
  div.classList.add("geolonia__error-message");
  div.setAttribute("role", "alert");

  const description = document.createElement("div");
  description.classList.add("geolonia__error-message-description");

  if (message) {
    // 消費側が指定した文言。HTML は解釈せずテキストとして描画する。
    description.textContent = message;
    div.appendChild(description);
  } else {
    const title = document.createElement("h2");
    title.classList.add("geolonia__error-message-title");
    title.textContent = "地図を表示できませんでした";
    div.appendChild(title);

    const lead = document.createElement("p");
    lead.classList.add("geolonia__error-message-lead");
    lead.textContent =
      "お使いの環境で地図の描画機能（WebGL）が利用できない状態になっている可能性があります。次の順にお試しください。";
    description.appendChild(lead);

    const steps = document.createElement("ol");
    steps.classList.add("geolonia__error-message-steps");
    for (const step of [
      "ブラウザをすべて閉じて、開き直す",
      "パソコンやスマートフォンを再起動する",
      "別のブラウザで開く",
      "パソコンの場合は、グラフィックドライバを更新する",
    ]) {
      const li = document.createElement("li");
      li.textContent = step;
      steps.appendChild(li);
    }
    description.appendChild(steps);

    const contact = document.createElement("p");
    contact.classList.add("geolonia__error-message-contact");
    contact.textContent =
      "解決しない場合は、このサイトの窓口までご連絡ください。";
    description.appendChild(contact);

    // 手順を書き切れない狭いコンテナ向け。表示の切り替えは CSS が行う。
    const brief = document.createElement("p");
    brief.classList.add("geolonia__error-message-brief");
    brief.textContent = "ブラウザや端末を再起動すると解消する場合があります。";
    description.appendChild(brief);

    div.appendChild(description);
  }

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
