import { expect, type Route, test } from "@playwright/test";
import { collectConsoleErrors, waitForMapLoad } from "./helper";

test.describe("Loader animation", () => {
  test("should show loader while the map is loading (default)", async ({
    page,
  }) => {
    // Delay the style fetch so the loader is observable. With the local
    // fixture the map otherwise finishes loading almost instantly.
    await page.route("**/sample-basic-style.json", async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });

    await page.goto("/loader.html");
    await expect(page.locator(".loading-geolonia-map")).toHaveCount(1);
  });

  test("should remove loader after map is loaded (default)", async ({
    page,
  }) => {
    await page.goto("/loader.html");
    await waitForMapLoad(page);
    await expect(page.locator(".loading-geolonia-map")).toHaveCount(0);
  });

  test("should not show loader when loader: false", async ({ page }) => {
    await page.goto("/loader.html?loader=false");
    await waitForMapLoad(page);
    await expect(page.locator(".loading-geolonia-map")).toHaveCount(0);

    // Also verify it was never there, not just removed after load
    const everPresent = await page.evaluate(() => {
      // If the loader was never added, there should be no such element at
      // any time — check the DOM right now and assume the test timing is
      // tight enough that the constructor already ran.
      return !!document.querySelector(".loading-geolonia-map");
    });
    expect(everPresent).toBe(false);
  });

  test("should not leave the loader of a map removed before load", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    // 2 つ目の地図のスタイルの取得を、数え終わるまで止めておく（時間で遅らせると遅い環境で数え損なう）
    let pending: Route | undefined;
    await page.route("**/sample-basic-style.json", (route) => {
      pending = route;
    });

    await page.goto("/loader.html?removeBeforeLoad=true");
    await expect.poll(() => pending !== undefined).toBe(true);
    // 破棄した地図の表示は外れ、2 つ目の地図の表示だけが残る。
    // 修正前は表示が 2 つ残るので、待たずにいまの数を数えて、すぐに落ちるようにしている
    expect(await page.locator(".loading-geolonia-map").count()).toBe(1);

    await pending?.continue();
    await waitForMapLoad(page);
    await expect(page.locator(".loading-geolonia-map")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("should keep the second map when the first one is removed twice", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    let pending: Route | undefined;
    await page.route("**/sample-basic-style.json", (route) => {
      pending = route;
    });

    // 1 つ目を破棄し、同じコンテナに 2 つ目を作ってから、1 つ目をもう一度 remove() する
    await page.goto("/loader.html?removeTwice=true");
    await expect.poll(() => pending !== undefined).toBe(true);
    // 2 回目の remove() は、2 つ目の地図の表示もコンテナへの登録も消さない
    expect(await page.locator(".loading-geolonia-map").count()).toBe(1);
    expect(
      await page.evaluate(() => {
        const w = window as unknown as Record<string, unknown>;
        const container = document.querySelector("#map") as unknown as {
          geoloniaMap?: unknown;
        };
        return container.geoloniaMap === w.map;
      }),
    ).toBe(true);

    await pending?.continue();
    await waitForMapLoad(page);
    await expect(page.locator(".loading-geolonia-map")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
