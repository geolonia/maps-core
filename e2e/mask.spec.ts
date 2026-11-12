import { expect, type Page, test } from "@playwright/test";
import { collectConsoleErrors, hasLayer, waitForMapLoad } from "./helper";

type TestMap = {
  getLayersOrder: () => string[];
  getLayer: (id: string) => { type: string } | undefined;
  getCenter: () => { lng: number; lat: number };
  jumpTo: (options: { center: [number, number]; zoom: number }) => void;
  once: (event: string, handler: () => void) => void;
  project: (lnglat: [number, number]) => { x: number; y: number };
  queryRenderedFeatures: (
    point: [number, number],
    options: { layers: string[] },
  ) => unknown[];
};

/** 指定した地点がマスクで塗られているかどうかを返します。 */
async function isMasked(page: Page, lnglat: [number, number]) {
  return page.evaluate((lnglat) => {
    const map = (window as unknown as { map: TestMap }).map;
    const { x, y } = map.project(lnglat);
    return (
      map.queryRenderedFeatures([x, y], { layers: ["geolonia-mask"] }).length >
      0
    );
  }, lnglat);
}

test.describe("mask", () => {
  test("should cut the boundary out of the mask in MapLibre", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/geojson.html?mask=true");
    await waitForMapLoad(page);
    await expect.poll(() => hasLayer(page, "geolonia-mask")).toBe(true);
    expect(await hasLayer(page, "geolonia-mask-outline")).toBe(true);

    // 境界全体が入るように引いて、描画が終わるのを待つ
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const map = (window as unknown as { map: TestMap }).map;
          map.once("idle", () => resolve());
          map.jumpTo({ center: [139.78, 35.69], zoom: 10 });
        }),
    );

    // 境界の内側は塗らず、外側と、境界の穴（別の地域）は塗る
    expect(await isMasked(page, [139.8, 35.7])).toBe(false);
    expect(await isMasked(page, [139.95, 35.62])).toBe(false);
    expect(await isMasked(page, [139.5, 35.69])).toBe(true);
    expect(await isMasked(page, [139.72, 35.695])).toBe(true);
    // 境界の穴の中にある面（島）は、穴の面からくり抜く
    expect(await isMasked(page, [139.708, 35.688])).toBe(false);

    const mapErrors = await page.evaluate(
      () => (window as unknown as { mapErrors: string[] }).mapErrors,
    );
    expect(mapErrors).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("should place the mask below the labels and the geojson layers", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/geojson.html?mask=true");
    await waitForMapLoad(page);
    await expect.poll(() => hasLayer(page, "geolonia-mask")).toBe(true);

    const order = await page.evaluate(() => {
      const map = (window as unknown as { map: TestMap }).map;
      const layers = map.getLayersOrder();
      return {
        mask: layers.indexOf("geolonia-mask"),
        outline: layers.indexOf("geolonia-mask-outline"),
        firstSymbol: layers.findIndex(
          (id) => map.getLayer(id)?.type === "symbol",
        ),
        firstSimpleStyle: layers.findIndex((id) =>
          id.startsWith("geolonia-simple-style"),
        ),
      };
    });
    expect(order.mask).toBeLessThan(order.outline);
    expect(order.outline).toBeLessThan(order.firstSymbol);
    expect(order.outline).toBeLessThan(order.firstSimpleStyle);
    expect(errors).toEqual([]);
  });

  test("should fit to the mask when neither center nor geojson is given", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/geojson.html?mask=only&noCenter=true");
    await waitForMapLoad(page);

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const c = (window as unknown as { map: TestMap }).map.getCenter();
            return (
              c.lng > 139.58 && c.lng < 139.98 && c.lat > 35.58 && c.lat < 35.8
            );
          }),
        { timeout: 6000 },
      )
      .toBe(true);
    expect(errors).toEqual([]);
  });
});
