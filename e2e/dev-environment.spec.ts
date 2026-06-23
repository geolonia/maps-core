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

  test("requests the dev backend (api.geolonia.com/dev)", async ({ page }) => {
    // stage=dev のとき SDK が api.geolonia.com の dev ステージを叩くことを確認する。
    // basic-v2 では sprite が api.geolonia.com/dev/sprites/... に解決される。
    const devRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("api.geolonia.com/dev/")) {
        devRequests.push(url.split("?")[0]);
      }
    });
    await page.goto("/geolonia-style.html?stage=dev");
    await waitForMapLoad(page);
    // 地図ロード後に残りのアセット (sprite 等) 取得を少し待つ
    await page.waitForTimeout(2000);
    expect(devRequests.length).toBeGreaterThan(0);
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
