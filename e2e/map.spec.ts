import { expect, test } from "@playwright/test";
import {
  collectConsoleErrors,
  readCanvasPixelsUpperHalf,
  waitForMapLoad,
} from "./helper";

test.describe("GeoloniaMap basic rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should render a canvas element", async ({ page }) => {
    await waitForMapLoad(page);
    const canvas = page.locator("canvas.maplibregl-canvas");
    await expect(canvas).toBeVisible();
  });

  test("should store map instance on container.geoloniaMap", async ({
    page,
  }) => {
    await waitForMapLoad(page);
    const hasGeoloniaMap = await page.evaluate(() => {
      const container = document.querySelector("#map") as HTMLElement & {
        geoloniaMap?: unknown;
      };
      return !!(container && container.geoloniaMap);
    });
    expect(hasGeoloniaMap).toBe(true);
  });

  test("should render tile content in upper half (non-white pixels)", async ({
    page,
  }) => {
    await waitForMapLoad(page);
    const hasContent = await readCanvasPixelsUpperHalf(page);
    expect(hasContent).toBe(true);
  });

  test("should not produce application-level console errors", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.reload();
    await waitForMapLoad(page);
    expect(errors).toHaveLength(0);
  });

  test("should expose map instance on window", async ({ page }) => {
    await waitForMapLoad(page);
    const hasMap = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map;
      return map !== undefined && map !== null;
    });
    expect(hasMap).toBe(true);
  });
});
