import { expect, test } from "@playwright/test";
import {
  collectConsoleErrors,
  readCanvasPixelsUpperHalf,
  waitForMapLoad,
} from "./helper";

test.describe("Geolonia style with API key", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/geolonia-style.html");
  });

  test("should fetch Geolonia style JSON", async ({ page }) => {
    const styleRequest = page.waitForRequest((req) =>
      req.url().includes("cdn.geolonia.com/style/geolonia/basic-v2"),
    );
    await page.goto("/geolonia-style.html");
    const req = await styleRequest;
    expect(req.url()).toContain("basic-v2");
  });

  test("should render a canvas element", async ({ page }) => {
    await waitForMapLoad(page);
    const canvas = page.locator("canvas.maplibregl-canvas");
    await expect(canvas).toBeVisible();
  });

  test("should render tile content", async ({ page }) => {
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
});
