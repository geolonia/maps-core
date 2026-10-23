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
    // GeoJSONSource の内部プロパティ `_data` は maplibre-gl のバージョンで形が変わるため、
    // 公開 API の `getData()` を使う。
    const featureCount = await page.evaluate(async () => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getSource: (
          id: string,
        ) => { getData?: () => Promise<{ features?: unknown[] }> } | undefined;
      };
      const src = map.getSource("geolonia-simple-style-points");
      if (!src?.getData) return 0;
      const data = await src.getData();
      return data?.features?.length ?? 0;
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

    // SimpleStyle.fitBounds() runs an animated transition (duration: 3000ms),
    // so poll until the center has moved into the Tokyo bbox instead of
    // relying on a fixed sleep.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const map = (window as unknown as Record<string, unknown>).map as {
              getCenter: () => { lng: number; lat: number };
            };
            return map.getCenter().lng;
          }),
        { timeout: 5000 },
      )
      .toBeGreaterThan(139);

    const center = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getCenter: () => { lng: number; lat: number };
      };
      const c = map.getCenter();
      return { lng: c.lng, lat: c.lat };
    });

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

  for (const [viz, layer, property] of [
    ["choropleth", "geolonia-simple-style-polygon", "fill-color"],
    ["heatmap", "geolonia-simple-style-heatmap", "heatmap-weight"],
    ["circle", "geolonia-simple-style-circle-points", "circle-color"],
  ] as const) {
    test(`should accept the ${viz} expressions in MapLibre`, async ({
      page,
    }) => {
      await page.goto(`/geojson.html?viz=${viz}`);
      await waitForMapLoad(page);

      expect(await hasLayer(page, layer)).toBe(true);
      // GeoJSON を URL から読み込んだ後に、式がデータに合わせて設定されること
      // （既定の simplestyle の式のままではないこと）
      await expect
        .poll(
          async () =>
            JSON.stringify(
              await page.evaluate(
                ([layer, property]) => {
                  const map = (window as unknown as Record<string, unknown>)
                    .map as {
                    getPaintProperty: (
                      layer: string,
                      property: string,
                    ) => unknown;
                  };
                  return map.getPaintProperty(layer, property);
                },
                [layer, property] as const,
              ),
            ),
          { timeout: 5000 },
        )
        .toMatch(/"(value|weight|category)"/);
      // 不正な式は MapLibre が拒否して error イベントで報告する
      const mapErrors = await page.evaluate(
        () => (window as unknown as Record<string, unknown>).mapErrors,
      );
      expect(mapErrors).toEqual([]);
    });
  }
});
