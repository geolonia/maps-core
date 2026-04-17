import { expect, test } from "@playwright/test";
import { hasSource, waitForMapLoad } from "./helper";

test.describe("SimpleStyleVector", () => {
  // Stub the vector tile (.pbf) requests so they don't 404 noisily.
  test.beforeEach(async ({ page }) => {
    await page.route("**/tiles/**/*.pbf", (route) => {
      route.fulfill({ status: 204, body: "" });
    });
  });

  test("should add vector source when simpleVector is provided", async ({
    page,
  }) => {
    await page.goto("/simple-vector.html");
    await waitForMapLoad(page);

    expect(await hasSource(page, "vt-geolonia-simple-style")).toBe(true);

    const sourceType = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getSource: (id: string) => { type: string } | undefined;
      };
      return map.getSource("vt-geolonia-simple-style")?.type;
    });
    expect(sourceType).toBe("vector");
  });

  test("should fitBounds to source bounds when no center is specified", async ({
    page,
  }) => {
    await page.goto("/simple-vector.html?noCenter=true");
    await waitForMapLoad(page);

    // Wait for source to load bounds and trigger fitBounds
    await expect
      .poll(
        async () =>
          await page.evaluate(() => {
            const map = (window as unknown as Record<string, unknown>).map as {
              getCenter: () => { lng: number; lat: number };
            };
            return map.getCenter().lng;
          }),
        { timeout: 10000 },
      )
      .toBeGreaterThan(139);

    const center = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getCenter: () => { lng: number; lat: number };
      };
      const c = map.getCenter();
      return { lng: c.lng, lat: c.lat };
    });

    // Source bounds are [139.6, 35.55, 139.85, 35.75], so center should be in Tokyo
    expect(center.lng).toBeGreaterThan(139.5);
    expect(center.lng).toBeLessThan(140);
    expect(center.lat).toBeGreaterThan(35.5);
    expect(center.lat).toBeLessThan(35.8);
  });

  test("should add interactive feature layers for popup on click", async ({
    page,
  }) => {
    await page.goto("/simple-vector.html");
    await waitForMapLoad(page);

    // SimpleStyleVector calls setPopup() on each of these layers, which
    // registers click/mouseenter/mouseleave handlers. Actually triggering a
    // popup requires real rendered vector features, which is out of scope for
    // this test — verifying that the layers exist implies the handlers were
    // wired up in addTo().
    const layers = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getLayer: (id: string) => unknown;
      };
      return {
        polygon: !!map.getLayer("vt-geolonia-simple-style-polygon"),
        linestring: !!map.getLayer("vt-geolonia-simple-style-linestring"),
        circlePoints: !!map.getLayer("vt-circle-simple-style-points"),
        symbolPoints: !!map.getLayer("vt-geolonia-simple-style-points"),
      };
    });
    expect(layers).toEqual({
      polygon: true,
      linestring: true,
      circlePoints: true,
      symbolPoints: true,
    });
  });
});
