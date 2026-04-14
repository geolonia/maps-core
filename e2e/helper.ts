import type { Page, Request } from "@playwright/test";

const LOAD_TIMEOUT = 15000;

/**
 * Wait for the map canvas to be visible and the map to be loaded.
 */
export async function waitForMapLoad(page: Page): Promise<void> {
  await page.waitForSelector("canvas.maplibregl-canvas", {
    timeout: LOAD_TIMEOUT,
  });
  await page.waitForFunction(
    () => {
      const map = (window as unknown as Record<string, unknown>).map as
        | { loaded?: () => boolean }
        | undefined;
      return map && typeof map.loaded === "function" && map.loaded();
    },
    { timeout: LOAD_TIMEOUT },
  );
}

/**
 * Check if the upper half of the canvas has non-white pixels (tiles rendered).
 * Only checks the upper half to avoid false positives from attribution controls at the bottom.
 */
export async function readCanvasPixelsUpperHalf(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector(
      "canvas.maplibregl-canvas",
    ) as HTMLCanvasElement | null;
    if (!canvas) return false;

    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return false;

    const width = gl.drawingBufferWidth;
    const halfHeight = Math.floor(gl.drawingBufferHeight / 2);
    const pixels = new Uint8Array(width * halfHeight * 4);

    // WebGL reads bottom-to-top, so reading from y=halfHeight gets the upper half
    gl.readPixels(
      0,
      halfHeight,
      width,
      halfHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );

    let nonWhite = 0;
    const total = width * halfHeight;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] < 250 || pixels[i + 1] < 250 || pixels[i + 2] < 250) {
        nonWhite++;
        // Early exit: enough non-white pixels found
        if (nonWhite > total * 0.01) {
          return true;
        }
      }
    }
    return nonWhite > 0;
  });
}

/**
 * Collect console errors, excluding resource loading failures (tile 404s etc.)
 */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.startsWith("Failed to load resource")) {
        errors.push(text);
      }
    }
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

/**
 * Wait for a specific map container to load (for pages with multiple maps).
 */
export async function waitForMapLoadOn(
  page: Page,
  containerSelector: string,
): Promise<void> {
  await page.waitForSelector(`${containerSelector} canvas.maplibregl-canvas`, {
    timeout: LOAD_TIMEOUT,
  });
  await page.waitForFunction(
    (selector: string) => {
      const container = document.querySelector(selector) as
        | (HTMLElement & { geoloniaMap?: { loaded?: () => boolean } })
        | null;
      const map = container?.geoloniaMap;
      return map && typeof map.loaded === "function" && map.loaded();
    },
    containerSelector,
    { timeout: LOAD_TIMEOUT },
  );
}

/**
 * Intercept network requests matching a URL pattern and collect them.
 * Call this BEFORE navigating to the page. Call `dispose()` when done
 * to remove the listener.
 */
export function interceptRequests(
  page: Page,
  urlPattern: string | RegExp,
): { requests: Request[]; dispose: () => void } {
  const requests: Request[] = [];
  const pattern =
    typeof urlPattern === "string"
      ? urlPattern
      : new RegExp(urlPattern.source, urlPattern.flags.replace(/[gy]/g, ""));
  const onRequest = (req: Request) => {
    const url = req.url();
    if (
      typeof pattern === "string" ? url.includes(pattern) : pattern.test(url)
    ) {
      requests.push(req);
    }
  };
  page.on("request", onRequest);
  return { requests, dispose: () => page.off("request", onRequest) };
}

/**
 * Check if a map layer exists.
 */
export async function hasLayer(page: Page, layerId: string): Promise<boolean> {
  return page.evaluate((id: string) => {
    const map = (window as unknown as Record<string, unknown>).map as
      | { getLayer?: (id: string) => unknown }
      | undefined;
    return !!map?.getLayer?.(id);
  }, layerId);
}

/**
 * Check if a map source exists.
 */
export async function hasSource(
  page: Page,
  sourceId: string,
): Promise<boolean> {
  return page.evaluate((id: string) => {
    const map = (window as unknown as Record<string, unknown>).map as
      | { getSource?: (id: string) => unknown }
      | undefined;
    return !!map?.getSource?.(id);
  }, sourceId);
}

/**
 * Check if a popup is currently visible on the page.
 */
export async function isPopupVisible(page: Page): Promise<boolean> {
  const popup = page.locator(".maplibregl-popup");
  return popup.isVisible();
}
