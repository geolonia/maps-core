import { expect, type Page, type Route, test } from "@playwright/test";
import { collectConsoleErrors, waitForMapLoad } from "./helper";

/**
 * スタイルの取得を止めておき、止めたリクエストを返します。数え終わるまで地図の読み込みを進めないために使います
 * （時間で遅らせると、遅い環境で数え損なう）。
 */
async function holdStyleRequest(page: Page) {
  let pending: Route | undefined;
  await page.route("**/sample-basic-style.json", (route) => {
    pending = route;
  });
  return {
    /** 止めたリクエストが届くまで待ちます。届かないときは、テスト全体の timeout より先にここで落とす。 */
    async waitForRequest() {
      await expect
        .poll(() => pending !== undefined, { timeout: 3000 })
        .toBe(true);
    },
    /** 止めたリクエストを進めます。 */
    async release() {
      await pending?.continue();
    },
  };
}

/** example が記録した地図の error イベント（GeoloniaMap が購読するので、コンソールには出ない）です。 */
async function mapErrorsOf(page: Page) {
  return page.evaluate(
    () => (window as unknown as { mapErrors: string[] }).mapErrors,
  );
}

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
    const style = await holdStyleRequest(page);

    await page.goto("/loader.html?removeBeforeLoad=true");
    await style.waitForRequest();
    // 破棄した地図の表示は外れ、2 つ目の地図の表示だけが残る。
    // 修正前は表示が 2 つ残るので、待たずにいまの数を数えて、すぐに落ちるようにしている
    expect(await page.locator(".loading-geolonia-map").count()).toBe(1);

    await style.release();
    await waitForMapLoad(page);
    await expect(page.locator(".loading-geolonia-map")).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(await mapErrorsOf(page)).toEqual([]);
  });

  test("should keep the second map when the first one is removed twice", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    const style = await holdStyleRequest(page);

    // 1 つ目を破棄し、同じコンテナに 2 つ目を作ってから、1 つ目をもう一度 remove() する
    await page.goto("/loader.html?removeTwice=true");
    await style.waitForRequest();
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
    // 2 回目の remove() で、コンテナから maplibregl-map クラスを外さない（2 つ目の地図が使っている）
    expect(
      await page.evaluate(() =>
        document.querySelector("#map")?.classList.contains("maplibregl-map"),
      ),
    ).toBe(true);

    await style.release();
    await waitForMapLoad(page);
    await expect(page.locator(".loading-geolonia-map")).toHaveCount(0);
    await expect(page.locator("#map")).toHaveClass(/maplibregl-map/);
    expect(errors).toEqual([]);
    expect(await mapErrorsOf(page)).toEqual([]);
  });

  test("should remove only its own loader and registration", async ({
    page,
  }) => {
    const style = await holdStyleRequest(page);
    await page.goto("/loader.html");
    await style.waitForRequest();

    // 読み込み前の地図のコンテナに、別の地図の表示と登録があるときを作る
    const kept = await page.evaluate(() => {
      const w = window as unknown as { map: { remove: () => void } };
      const container = document.querySelector("#map") as HTMLElement & {
        geoloniaMap?: unknown;
      };
      const foreign = document.createElement("div");
      foreign.className = "loading-geolonia-map";
      foreign.id = "foreign-loader";
      container.appendChild(foreign);
      const other = {};
      container.geoloniaMap = other;

      w.map.remove();
      return {
        loaders: container.querySelectorAll(".loading-geolonia-map").length,
        foreign: !!container.querySelector("#foreign-loader"),
        registration: container.geoloniaMap === other,
      };
    });
    // 自分の表示だけを外し、別の地図の表示と登録は残す
    expect(kept).toEqual({ loaders: 1, foreign: true, registration: true });
  });
});
