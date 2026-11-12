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

/** 地図の error イベントで報告されたエラーです（GeoloniaMap が購読するので、コンソールには出ない）。 */
async function mapErrorsOf(page: Page) {
  return page.evaluate(
    () => (window as unknown as { mapErrors: string[] }).mapErrors,
  );
}

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

    // レイヤーは取得の前から空で存在するので、外側が塗られる（取得が終わる）まで待つ
    await expect.poll(() => isMasked(page, [139.5, 35.69])).toBe(true);

    // 境界の内側は塗らず、外側と、境界の穴（別の地域）は塗る
    expect(await isMasked(page, [139.8, 35.7])).toBe(false);
    expect(await isMasked(page, [139.95, 35.62])).toBe(false);
    expect(await isMasked(page, [139.5, 35.69])).toBe(true);
    expect(await isMasked(page, [139.72, 35.695])).toBe(true);
    // 境界の穴の中にある面（島）は、穴の面からくり抜く
    expect(await isMasked(page, [139.708, 35.688])).toBe(false);

    expect(await mapErrorsOf(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("should place the mask above the base map and below the geojson layers", async ({
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
        // sample-basic-style.json の最後の塗りのレイヤー
        fixture: layers.indexOf("fixture"),
        firstSimpleStyle: layers.findIndex((id) =>
          id.startsWith("geolonia-simple-style"),
        ),
      };
    });
    expect(order.fixture).toBeGreaterThanOrEqual(0);
    expect(order.fixture).toBeLessThan(order.mask);
    expect(order.mask).toBeLessThan(order.outline);
    expect(order.outline).toBeLessThan(order.firstSimpleStyle);
    expect(await mapErrorsOf(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("should place the mask below beforeId", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/geojson.html?mask=true&maskBefore=fixture");
    await waitForMapLoad(page);
    await expect.poll(() => hasLayer(page, "geolonia-mask")).toBe(true);

    const order = await page.evaluate(() =>
      (window as unknown as { map: TestMap }).map.getLayersOrder(),
    );
    // マスクと境界線が、この順で beforeId のレイヤーの直前に入る
    const mask = order.indexOf("geolonia-mask");
    expect(order.slice(mask, mask + 3)).toEqual([
      "geolonia-mask",
      "geolonia-mask-outline",
      "fixture",
    ]);
    expect(await mapErrorsOf(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("should add the mask again after setStyle", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/geojson.html?mask=true");
    await waitForMapLoad(page);
    // 既定の表示範囲に入る、境界の穴の中の地点（範囲の外なので塗られる）
    await expect.poll(() => isMasked(page, [139.72, 35.695])).toBe(true);

    // スタイルを差し替え、新しいスタイルが読み込まれて描画が落ち着くまで待つ。
    // 差し替えの途中は古いスタイルとマスクが残るので、待たずに確かめると作り直しを確かめられない
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const w = window as unknown as {
            map: {
              getSource: (id: string) => unknown;
              setStyle: (s: string) => void;
              once: (e: string, f: () => void) => void;
            };
            oldMaskSource: unknown;
          };
          w.oldMaskSource = w.map.getSource("geolonia-mask");
          w.map.once("style.load", () => w.map.once("idle", () => resolve()));
          // 相対パスにクエリを付けると Geolonia の論理名と判定されるので、絶対 URL で渡す
          w.map.setStyle(
            new URL("/sample-basic-style.json?v=2", location.href).href,
          );
        }),
    );

    // 新しいスタイルに作り直したマスク（前とは別のソース）が、また外側を塗る
    await expect
      .poll(() =>
        page.evaluate(() => {
          const w = window as unknown as {
            map: { getSource: (id: string) => unknown };
            oldMaskSource: unknown;
          };
          const source = w.map.getSource("geolonia-mask");
          return source !== undefined && source !== w.oldMaskSource;
        }),
      )
      .toBe(true);
    await expect.poll(() => isMasked(page, [139.72, 35.695])).toBe(true);
    expect(await mapErrorsOf(page)).toEqual([]);
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
        // fitBounds の既定の duration（3000ms）に、取得とフレームの余裕を足した値
        { timeout: 6000 },
      )
      .toBe(true);
    expect(await mapErrorsOf(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
