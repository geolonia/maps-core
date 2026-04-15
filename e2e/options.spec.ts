import { expect, test } from "@playwright/test";
import { interceptRequests, waitForMapLoad } from "./helper";

test.describe("Constructor options", () => {
  test("should apply center and zoom", async ({ page }) => {
    await page.goto("/options.html?center=[135.5,34.7]&zoom=10");
    await waitForMapLoad(page);

    const state = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getCenter: () => { lng: number; lat: number };
        getZoom: () => number;
      };
      const c = map.getCenter();
      return { lng: c.lng, lat: c.lat, zoom: map.getZoom() };
    });

    expect(state.lng).toBeCloseTo(135.5, 1);
    expect(state.lat).toBeCloseTo(34.7, 1);
    expect(state.zoom).toBeCloseTo(10, 0);
  });

  test("should apply minZoom and maxZoom", async ({ page }) => {
    await page.goto("/options.html?minZoom=5&maxZoom=15");
    await waitForMapLoad(page);

    const limits = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getMinZoom: () => number;
        getMaxZoom: () => number;
      };
      return { minZoom: map.getMinZoom(), maxZoom: map.getMaxZoom() };
    });

    expect(limits.minZoom).toBe(5);
    expect(limits.maxZoom).toBe(15);
  });

  test("should apply bearing and pitch", async ({ page }) => {
    await page.goto("/options.html?bearing=45&pitch=30");
    await waitForMapLoad(page);

    const state = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getBearing: () => number;
        getPitch: () => number;
      };
      return { bearing: map.getBearing(), pitch: map.getPitch() };
    });

    expect(state.bearing).toBeCloseTo(45, 0);
    expect(state.pitch).toBeCloseTo(30, 0);
  });

  test("should reflect map state in URL hash when hash is enabled", async ({
    page,
  }) => {
    await page.goto("/options.html?hash=true&zoom=10&center=[139.7,35.6]");
    await waitForMapLoad(page);

    // Wait for hash to be written
    await page.waitForFunction(() => window.location.hash.length > 1, {
      timeout: 5000,
    });

    const hash = await page.evaluate(() => window.location.hash);
    // Hash format: #zoom/lat/lng or #zoom/lat/lng/bearing/pitch
    expect(hash).toMatch(/^#\d/);
  });

  test("should resolve Geolonia style with lang parameter", async ({
    page,
  }) => {
    const { requests, dispose } = interceptRequests(
      page,
      "cdn.geolonia.com/style",
    );

    await page.goto(
      "/options.html?style=geolonia/basic-v2&lang=en&apiKey=YOUR-API-KEY",
    );
    // Wait a bit for style request to be made (will 403 without valid API key, but URL is still requested)
    await page.waitForTimeout(3000);
    dispose();

    const styleUrls = requests.map((r) => r.url());
    expect(styleUrls.some((url) => url.includes("/en.json"))).toBe(true);
  });

  test("should resolve container from CSS selector", async ({ page }) => {
    await page.goto("/options.html");
    await waitForMapLoad(page);

    const canvas = page.locator("#map canvas.maplibregl-canvas");
    await expect(canvas).toBeVisible();
  });

  test("should resolve container from DOM element", async ({ page }) => {
    await page.goto("/options.html");
    await waitForMapLoad(page);

    // Verify that the existing map stored its instance on the resolved DOM
    // element, implying the container was resolved (either from CSS selector
    // or from DOM element). Then construct a second map using a DOM element
    // directly and verify it also resolves.
    const rendered = await page.evaluate(async () => {
      const GeoloniaMapCtor = (
        document.getElementById("map") as HTMLElement & {
          geoloniaMap?: { constructor: unknown };
        }
      )?.geoloniaMap?.constructor as
        | (new (
            opts: Record<string, unknown>,
          ) => {
            on: (ev: string, cb: () => void) => void;
          })
        | undefined;
      if (!GeoloniaMapCtor) return false;

      const div = document.createElement("div");
      div.id = "map2";
      div.style.width = "400px";
      div.style.height = "300px";
      document.body.appendChild(div);

      const map2 = new GeoloniaMapCtor({
        container: div,
        style: "https://tile.openstreetmap.jp/styles/osm-bright/style.json",
        center: [139.7671, 35.6812],
        zoom: 10,
        navigationControl: false,
        geoloniaControl: false,
        gestureHandling: false,
        loader: false,
      });

      return new Promise<boolean>((resolve) => {
        map2.on("load", () => {
          const canvas = div.querySelector("canvas.maplibregl-canvas");
          resolve(canvas !== null);
        });
        setTimeout(() => resolve(false), 15000);
      });
    });

    expect(rendered).toBe(true);
  });
});
