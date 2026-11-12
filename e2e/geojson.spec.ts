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
    ["circle-map", "geolonia-simple-style-circle-points", "circle-color"],
    [
      "extrusion",
      "geolonia-simple-style-polygon-extrusion",
      "fill-extrusion-height",
    ],
    [
      "extrusion",
      "geolonia-simple-style-polygon-extrusion",
      "fill-extrusion-color",
    ],
  ] as const) {
    test(`should accept the ${viz} ${property} expression in MapLibre`, async ({
      page,
    }) => {
      await page.goto(`/geojson.html?viz=${viz}`);
      await waitForMapLoad(page);

      expect(await hasLayer(page, layer)).toBe(true);
      const paint = async () =>
        JSON.stringify(
          await page.evaluate(
            ([layer, property]) => {
              const map = (window as unknown as Record<string, unknown>)
                .map as {
                getPaintProperty: (layer: string, property: string) => unknown;
              };
              return map.getPaintProperty(layer, property);
            },
            [layer, property] as const,
          ),
        );
      // GeoJSON を URL から読み込んだ後に、式がデータに合わせて設定されること
      // （既定の simplestyle の式のままではないこと）
      await expect
        .poll(paint, { timeout: 5000 })
        .toMatch(/"(value|weight|category)"/);
      if (viz === "circle-map") {
        // 式に対応表の 3 組がそのまま入り、対応表に無い 公園 はラベルにならないこと
        // （出現順に既定のパレットを割り当てる式になっていないこと）
        const expr = await paint();
        expect(expr).toContain('["to-string",["get","category"]]');
        expect(expr).toContain('"カフェ","#7A4FA0"');
        expect(expr).toContain('"書店","#2B6CB0"');
        expect(expr).toContain('"ベーカリー","#5B8C2A"');
        expect(expr).not.toContain('"公園"');
      }
      // 不正な式は MapLibre が拒否して error イベントで報告する
      const mapErrors = await page.evaluate(
        () => (window as unknown as Record<string, unknown>).mapErrors,
      );
      expect(mapErrors).toEqual([]);
    });
  }
});
