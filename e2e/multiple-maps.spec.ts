import { expect, test } from "@playwright/test";
import { waitForMapLoadOn } from "./helper";

test.describe("Multiple maps on the same page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/multiple-maps.html");
    await waitForMapLoadOn(page, "#map-a");
    await waitForMapLoadOn(page, "#map-b");
  });

  test("should render both maps independently", async ({ page }) => {
    const canvasA = page.locator("#map-a canvas.maplibregl-canvas");
    const canvasB = page.locator("#map-b canvas.maplibregl-canvas");
    await expect(canvasA).toBeVisible();
    await expect(canvasB).toBeVisible();

    const centers = await page.evaluate(() => {
      const w = window as unknown as Record<
        string,
        { getCenter: () => { lng: number; lat: number } }
      >;
      return {
        a: w.mapA.getCenter(),
        b: w.mapB.getCenter(),
      };
    });
    // mapA centered on Tokyo, mapB on Osaka — they must differ
    expect(centers.a.lng).toBeCloseTo(139.7671, 1);
    expect(centers.b.lng).toBeCloseTo(135.5023, 1);
  });

  test("should use different styles per map", async ({ page }) => {
    const styles = await page.evaluate(() => {
      const w = window as unknown as Record<
        string,
        { getStyle: () => { name?: string; sprite?: string } }
      >;
      return {
        a: w.mapA.getStyle(),
        b: w.mapB.getStyle(),
      };
    });
    // Two different style JSONs should produce different style objects
    // (distinguishable by name or sprite URL)
    expect(JSON.stringify(styles.a)).not.toBe(JSON.stringify(styles.b));
  });

  test("should prevent double initialization on the same container", async ({
    page,
  }) => {
    const sameInstance = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return w.mapA === w.mapADup;
    });
    expect(sameInstance).toBe(true);

    // Container should have only one canvas (no second map was mounted)
    const canvasCount = await page
      .locator("#map-a canvas.maplibregl-canvas")
      .count();
    expect(canvasCount).toBe(1);
  });
});
