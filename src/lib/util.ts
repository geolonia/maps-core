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
 * Resolve style name or URL to a full style URL.
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
    return `https://cdn.geolonia.com/style/geolonia/basic-v2/${lang === "ja" ? "ja" : "en"}.json`;
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
  return `https://cdn.geolonia.com/style/${style}/${lang === "ja" ? "ja" : "en"}.json`;
}

/**
 * Detect browser language.
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
