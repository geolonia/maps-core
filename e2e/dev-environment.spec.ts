import { expect, test } from "@playwright/test";
import {
  collectConsoleErrors,
  readCanvasPixelsUpperHalf,
  waitForMapLoad,
} from "./helper";

// dev 環境 (api.geolonia.com/dev) を明示的に検証する e2e。
//
// stage=dev で地図をロードすると、SDK は dev ステージのエンドポイントを叩く (geolonia-map.ts)。
// geolonia/basic-v2 では sprite が `https://api.geolonia.com/${stage}/sprites/...` に解決されるため、
// dev の sprite が 2xx を返し、その上で地図が描画されることを確認する。
// dev バックエンドに変更が入った際の疎通・描画の回帰ネットとして使う。
test.describe("dev environment (api.geolonia.com/dev)", () => {
  test.beforeEach(async ({ page }) => {
    // glyph は dev サーバへ寄せる (本番の CORS 未対応回避。geolonia-style.spec と同様)。
    await page.route("**/glyphs.geolonia.com/**", (route) => {
      const url = route
        .request()
        .url()
        .replace("glyphs.geolonia.com", "glyphs-dev.geolonia.com");
      route.continue({ url });
    });
  });

  test("requests dev sprites (api.geolonia.com/dev/sprites)", async ({
    page,
  }) => {
    // stage=dev のとき SDK が sprite を api.geolonia.com/dev/sprites/... に解決して
    // 叩くことを確認する (sprite の stage 書き換えの回帰検知)。
    const devSpriteRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("api.geolonia.com/dev/sprites/")) {
        devSpriteRequests.push(url.split("?")[0]);
      }
    });
    await page.goto("/geolonia-style.html?stage=dev");
    await waitForMapLoad(page);
    // 固定 sleep ではなく観測条件を待つ (CI 安定性のため)
    await expect
      .poll(() => devSpriteRequests.length, { timeout: 10_000 })
      .toBeGreaterThan(0);
  });

  test("renders a map backed by the dev environment", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/geolonia-style.html?stage=dev");
    await waitForMapLoad(page);
    const hasContent = await readCanvasPixelsUpperHalf(page);
    expect(hasContent).toBe(true);
    expect(errors).toHaveLength(0);
  });
});
