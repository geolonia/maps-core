import { expect, test } from "@playwright/test";
import {
  collectConsoleErrors,
  hasLayer,
  hasSource,
  waitForMapLoad,
} from "./helper";

test.describe("GeoJSON / SimpleStyle", () => {
  test("should add source and layer when geojson URL is provided", async ({
    page,
  }) => {
    await page.goto("/geojson.html?source=url");
    await waitForMapLoad(page);

    // SimpleStyle adds sources: `geolonia-simple-style` and `...-points`
    expect(await hasSource(page, "geolonia-simple-style")).toBe(true);
    expect(await hasSource(page, "geolonia-simple-style-points")).toBe(true);
    // At least one SimpleStyle layer should exist (symbol-points is created
    // for Point features).
    expect(await hasLayer(page, "geolonia-simple-style-symbol-points")).toBe(
      true,
    );
  });

  test("should render data when geojson object is passed directly", async ({
    page,
  }) => {
    await page.goto("/geojson.html"); // default: inline object
    await waitForMapLoad(page);

    expect(await hasSource(page, "geolonia-simple-style-points")).toBe(true);
    const featureCount = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getSource: (
          id: string,
        ) => { _data?: { features?: unknown[] } } | undefined;
      };
      const src = map.getSource("geolonia-simple-style-points");
      return src?._data?.features?.length ?? 0;
    });
    expect(featureCount).toBe(3);
  });

  test("should add cluster layers when cluster: true", async ({ page }) => {
    await page.goto("/geojson.html?cluster=true");
    await waitForMapLoad(page);

    expect(await hasLayer(page, "geolonia-simple-style-clusters")).toBe(true);
    expect(await hasLayer(page, "geolonia-simple-style-cluster-count")).toBe(
      true,
    );
  });

  test("should fit bounds to GeoJSON when center is not specified", async ({
    page,
  }) => {
    await page.goto("/geojson.html?noCenter=true");
    await waitForMapLoad(page);

    // Allow a little time for fitBounds to animate
    await page.waitForTimeout(500);

    const center = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getCenter: () => { lng: number; lat: number };
      };
      const c = map.getCenter();
      return { lng: c.lng, lat: c.lat };
    });

    // Feature centroid is roughly around 139.72, 35.68 (Tokyo area).
    // Default center in options.ts is 139.7671, 35.6812 — when unset,
    // MapLibre defaults to [0, 0]. fitBounds should move it to Tokyo.
    expect(center.lng).toBeGreaterThan(139);
    expect(center.lng).toBeLessThan(140);
    expect(center.lat).toBeGreaterThan(35);
    expect(center.lat).toBeLessThan(36);
  });

  test("should handle fetch failure gracefully", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/geojson.html?source=bad");
    await waitForMapLoad(page);

    // Map should still be alive (loaded() returned true via waitForMapLoad)
    const mapAlive = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as
        | { loaded: () => boolean }
        | undefined;
      return !!map?.loaded?.();
    });
    expect(mapAlive).toBe(true);
    // An error should have been logged for the failed GeoJSON load
    expect(errors.some((e) => e.includes("Failed to load GeoJSON"))).toBe(true);
  });
});
