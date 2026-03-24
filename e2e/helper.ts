import type { Page } from '@playwright/test';

const LOAD_TIMEOUT = 15000;

/**
 * Wait for the map canvas to be visible and the map to be loaded.
 */
export async function waitForMapLoad(page: Page): Promise<void> {
  await page.waitForSelector('canvas.maplibregl-canvas', { timeout: LOAD_TIMEOUT });
  await page.waitForFunction(
    () => {
      const map = (window as unknown as Record<string, unknown>).map as { loaded?: () => boolean } | undefined;
      return map && typeof map.loaded === 'function' && map.loaded();
    },
    { timeout: LOAD_TIMEOUT },
  );
}

/**
 * Check if the canvas has been rendered with non-white pixels.
 */
export async function readCanvasPixels(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas.maplibregl-canvas') as HTMLCanvasElement | null;
    if (!canvas) return false;

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Check if at least 1% of pixels are non-white
    let nonWhite = 0;
    const total = width * height;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) {
        nonWhite++;
      }
    }
    return nonWhite / total > 0.01;
  });
}
