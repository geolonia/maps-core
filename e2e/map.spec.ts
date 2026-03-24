import { test, expect } from '@playwright/test';
import { waitForMapLoad, readCanvasPixels } from './helper';

test.describe('GeoloniaMap basic rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render a canvas element', async ({ page }) => {
    await waitForMapLoad(page);
    const canvas = page.locator('canvas.maplibregl-canvas');
    await expect(canvas).toBeVisible();
  });

  test('should render map content (non-white pixels)', async ({ page }) => {
    await waitForMapLoad(page);
    const hasContent = await readCanvasPixels(page);
    expect(hasContent).toBe(true);
  });

  test('should not produce console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.reload();
    await waitForMapLoad(page);

    expect(errors).toEqual([]);
  });

  test('should expose map instance on window', async ({ page }) => {
    await waitForMapLoad(page);
    const hasMap = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map;
      return map !== undefined && map !== null;
    });
    expect(hasMap).toBe(true);
  });
});
