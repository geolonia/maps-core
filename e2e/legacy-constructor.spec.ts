import { expect, test } from "@playwright/test";
import { waitForMapLoad } from "./helper";

/**
 * Backward compatibility with the old embed API: `new geolonia.Map('#map')`
 * and `new geolonia.Map(element)` resolve the container and read its `data-*`
 * attributes into the map options. See maps-core#90 / embed#500.
 */
test.describe("Legacy constructor argument", () => {
  const readState = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getCenter: () => { lng: number; lat: number };
        getZoom: () => number;
        getMinZoom: () => number;
        getMaxZoom: () => number;
      };
      const c = map.getCenter();
      return {
        lng: c.lng,
        lat: c.lat,
        zoom: map.getZoom(),
        minZoom: map.getMinZoom(),
        maxZoom: map.getMaxZoom(),
      };
    });

  test("CSS selector string reads data-* attributes", async ({ page }) => {
    await page.goto("/legacy-constructor.html");
    await waitForMapLoad(page);

    const state = await readState(page);
    expect(state.lng).toBeCloseTo(135.5, 1);
    expect(state.lat).toBeCloseTo(34.7, 1);
    expect(state.zoom).toBeCloseTo(10, 0);
    expect(state.minZoom).toBe(5);
    expect(state.maxZoom).toBe(15);
  });

  test("HTMLElement argument reads data-* attributes", async ({ page }) => {
    await page.goto("/legacy-constructor.html?arg=element");
    await waitForMapLoad(page);

    const state = await readState(page);
    expect(state.lng).toBeCloseTo(135.5, 1);
    expect(state.lat).toBeCloseTo(34.7, 1);
    expect(state.zoom).toBeCloseTo(10, 0);
  });
});
