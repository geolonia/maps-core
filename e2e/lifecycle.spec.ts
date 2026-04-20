import { expect, test } from "@playwright/test";
import { interceptRequests, waitForMapLoad } from "./helper";

test.describe("setStyle() / remove() lifecycle", () => {
  test("setStyle() should swap to a new style and request its tiles", async ({
    page,
  }) => {
    await page.goto("/lifecycle.html");
    await waitForMapLoad(page);

    const { requests, dispose } = interceptRequests(page, "maptiler-toner-en");
    await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        setStyle: (url: string) => void;
      };
      map.setStyle(
        "https://tile.openstreetmap.jp/styles/maptiler-toner-en/style.json",
      );
    });

    await expect
      .poll(() => requests.length, { timeout: 10000 })
      .toBeGreaterThan(0);
    dispose();
  });

  test("setStyle() with a Geolonia logical name should resolve to CDN URL", async ({
    page,
  }) => {
    await page.goto("/lifecycle.html");
    await waitForMapLoad(page);

    const { requests, dispose } = interceptRequests(
      page,
      "cdn.geolonia.com/style",
    );
    await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        setStyle: (name: string) => void;
      };
      map.setStyle("geolonia/basic-v2");
    });

    await expect
      .poll(() => requests.length, { timeout: 10000 })
      .toBeGreaterThan(0);
    dispose();

    const urls = requests.map((r) => r.url());
    expect(urls.some((u) => u.includes("/style/geolonia/basic-v2/"))).toBe(
      true,
    );
  });

  test("remove() should clear canvas and container.geoloniaMap", async ({
    page,
  }) => {
    await page.goto("/lifecycle.html");
    await waitForMapLoad(page);

    await expect(page.locator("canvas.maplibregl-canvas")).toHaveCount(1);

    await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        remove: () => void;
      };
      map.remove();
    });

    await expect(page.locator("canvas.maplibregl-canvas")).toHaveCount(0);
    const hasGeoloniaMap = await page.evaluate(() => {
      const container = document.querySelector("#map") as HTMLElement & {
        geoloniaMap?: unknown;
      };
      return container.geoloniaMap !== undefined;
    });
    expect(hasGeoloniaMap).toBe(false);
  });
});
