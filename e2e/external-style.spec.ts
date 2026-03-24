import { test, expect } from '@playwright/test';
import { waitForMapLoad, readCanvasPixelsUpperHalf } from './helper';

const EXTERNAL_STYLE_URL = 'https://tile.openstreetmap.jp/styles/osm-bright/style.json';

test.describe('External style support', () => {
  test('should render a map with external style URL', async ({ page }) => {
    await page.goto('/external-style.html');
    await waitForMapLoad(page);

    const canvas = page.locator('canvas.maplibregl-canvas');
    await expect(canvas).toBeVisible();
  });

  test('should fetch the external style URL', async ({ page }) => {
    const styleRequest = page.waitForRequest((req) =>
      req.url().includes(EXTERNAL_STYLE_URL),
    );

    await page.goto('/external-style.html');

    const req = await styleRequest;
    expect(req.url()).toBe(EXTERNAL_STYLE_URL);
  });

  test('should render tile content with external style', async ({ page }) => {
    await page.goto('/external-style.html');
    await waitForMapLoad(page);

    const hasContent = await readCanvasPixelsUpperHalf(page);
    expect(hasContent).toBe(true);
  });
});
