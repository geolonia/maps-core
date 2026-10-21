import { expect, type Page, test } from "@playwright/test";
import {
  collectConsoleErrors,
  readCanvasPixelsUpperHalf,
  waitForMapLoad,
} from "./helper";

type TransformCall = { url: string; resourceType?: string };

const getCalls = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { transformCalls: TransformCall[] }).transformCalls,
  );

// GeoloniaMap の transformRequest オプションが、maps-core が変換する
// Geolonia のソースとスプライトのリクエストにも適用されることを確認する。
test.describe("transformRequest option", () => {
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

  test("receives Geolonia source and sprite URLs transformed by maps-core", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/transform-request.html?mode=record");
    await waitForMapLoad(page);

    const calls = await getCalls(page);
    const source = calls.find(
      (c) =>
        c.resourceType === "Source" &&
        c.url.startsWith("https://osm.v2.tiles.geolonia.com/tiles.json"),
    );
    expect(source).toBeDefined();
    const sourceUrl = new URL(source?.url ?? "");
    expect(sourceUrl.searchParams.get("key")).toBe("YOUR-API-KEY");
    expect(sourceUrl.searchParams.get("sessionId")).toBeTruthy();

    const sprite = calls.find(
      (c) =>
        c.resourceType === "SpriteJSON" &&
        c.url.startsWith("https://api.geolonia.com/v1/sprites/"),
    );
    expect(sprite).toBeDefined();
    expect(new URL(sprite?.url ?? "").searchParams.get("key")).toBe(
      "YOUR-API-KEY",
    );

    expect(await readCanvasPixelsUpperHalf(page)).toBe(true);
    expect(errors).toHaveLength(0);
  });

  for (const mode of ["append", "promise"]) {
    test(`uses the request returned by the user function (${mode})`, async ({
      page,
    }) => {
      const errors = collectConsoleErrors(page);
      const requested: string[] = [];
      page.on("request", (req) => requested.push(req.url()));

      await page.goto(`/transform-request.html?mode=${mode}`);
      await waitForMapLoad(page);

      const tilejson = requested
        .map((u) => new URL(u))
        .find(
          (u) =>
            u.hostname === "osm.v2.tiles.geolonia.com" &&
            u.pathname === "/tiles.json",
        );
      expect(tilejson).toBeDefined();
      expect(tilejson?.searchParams.get("e2e")).toBe("1");
      expect(tilejson?.searchParams.get("key")).toBe("YOUR-API-KEY");
      expect(tilejson?.searchParams.get("sessionId")).toBeTruthy();

      const sprite = requested
        .map((u) => new URL(u))
        .find((u) => u.pathname.startsWith("/v1/sprites/"));
      expect(sprite?.searchParams.get("e2e")).toBe("1");
      expect(sprite?.searchParams.get("key")).toBe("YOUR-API-KEY");

      expect(await readCanvasPixelsUpperHalf(page)).toBe(true);
      expect(errors).toHaveLength(0);
    });
  }
});
