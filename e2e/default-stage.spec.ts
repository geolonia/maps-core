import { expect, test } from "@playwright/test";
import { collectConsoleErrors, waitForMapLoad } from "./helper";

// stage を指定しなかったときに本番を向くことを検証する e2e。
//
// keyring の既定は "v1"（src/lib/keyring.ts の DEFAULT_STAGE）。かつては "dev"
// だったため、stage を渡し忘れた npm 利用者が黙って dev 環境を叩いていた。
// dev を明示したときの挙動は dev-environment.spec.ts が担保しているので、
// ここでは「指定しない場合」だけを見る。
//
// example/geolonia-style.ts は ?stage= がある時だけ options.stage を設定するので、
// クエリなしでアクセスすれば既定値の経路を通る。
test.describe("default stage (no stage option)", () => {
  test.beforeEach(async ({ page }) => {
    // glyph は dev サーバへ寄せる（本番の CORS 未対応回避。他の spec と同様）。
    await page.route("**/glyphs.geolonia.com/**", (route) => {
      const url = route
        .request()
        .url()
        .replace("glyphs.geolonia.com", "glyphs-dev.geolonia.com");
      route.continue({ url });
    });
  });

  test("requests production sprites, not dev", async ({ page }) => {
    const devSprites: string[] = [];
    const prodSprites: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("api.geolonia.com/dev/sprites/")) devSprites.push(url);
      if (url.includes("api.geolonia.com/v1/sprites/")) prodSprites.push(url);
    });

    await page.goto("/geolonia-style.html");
    await waitForMapLoad(page);
    await expect
      .poll(() => prodSprites.length, { timeout: 10_000 })
      .toBeGreaterThan(0);

    expect(devSprites).toHaveLength(0);
  });

  test("does not rewrite tile hosts to tileserver-dev", async ({ page }) => {
    // dev ホストが 0 件であることだけを見ると、そもそもタイルサーバへ
    // 一度もリクエストしていない場合にも通ってしまう。本番ホストへの
    // リクエストが実際に起きたことを合わせて確認する。
    const prodHosts: string[] = [];
    const devHosts: string[] = [];
    page.on("request", (req) => {
      const host = new URL(req.url()).host;
      if (host === "tileserver.geolonia.com") prodHosts.push(req.url());
      if (host === "tileserver-dev.geolonia.com") devHosts.push(req.url());
    });

    // タイルサーバの応答そのものを見る。collectConsoleErrors は
    // "Failed to load resource" を除外するので、リソース取得の失敗を
    // コンソール経由では検知できない。
    const failed: string[] = [];
    page.on("response", (res) => {
      const host = new URL(res.url()).host;
      if (host.startsWith("tileserver") && res.status() >= 400) {
        failed.push(`${res.status()} ${res.url()}`);
      }
    });

    const errors = collectConsoleErrors(page);
    await page.goto("/geolonia-style.html");
    await waitForMapLoad(page);
    await expect
      .poll(() => prodHosts.length, { timeout: 10_000 })
      .toBeGreaterThan(0);

    expect(devHosts).toHaveLength(0);
    expect(failed).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});
