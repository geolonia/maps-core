import { expect, test } from "@playwright/test";
import { interceptRequests } from "./helper";

test.describe("Authentication (apiKey, sessionId, stage, transformRequest)", () => {
  test("should append key= to Geolonia tile requests", async ({ page }) => {
    const { requests, dispose } = interceptRequests(
      page,
      /api\.geolonia\.com|tileserver(-dev)?\.geolonia\.com/,
    );
    await page.goto("/geolonia-style.html");
    await expect
      .poll(() => requests.length, { timeout: 10000 })
      .toBeGreaterThan(0);
    dispose();

    const urlsWithKey = requests
      .map((r) => r.url())
      .filter((url) => new URL(url).searchParams.has("key"));
    expect(urlsWithKey.length).toBeGreaterThan(0);
  });

  test("should append sessionId= to Geolonia tile requests", async ({
    page,
  }) => {
    const { requests, dispose } = interceptRequests(
      page,
      /api\.geolonia\.com|tileserver(-dev)?\.geolonia\.com/,
    );
    await page.goto("/geolonia-style.html");
    await expect
      .poll(() => requests.length, { timeout: 10000 })
      .toBeGreaterThan(0);
    dispose();

    const urlsWithSession = requests
      .map((r) => r.url())
      .filter((url) => new URL(url).searchParams.has("sessionId"));
    expect(urlsWithSession.length).toBeGreaterThan(0);
  });

  test("should NOT append key/sessionId to non-Geolonia tile URLs", async ({
    page,
  }) => {
    const { requests, dispose } = interceptRequests(
      page,
      "tile.openstreetmap.jp",
    );
    await page.goto("/auth-external.html");
    await expect
      .poll(() => requests.length, { timeout: 10000 })
      .toBeGreaterThan(0);
    dispose();

    for (const req of requests) {
      const url = new URL(req.url());
      expect(url.searchParams.has("key")).toBe(false);
      expect(url.searchParams.has("sessionId")).toBe(false);
    }
  });

  test("should reflect stage option in API path", async ({ page }) => {
    const { requests, dispose } = interceptRequests(page, "api.geolonia.com");
    await page.goto("/geolonia-style.html?stage=v1");
    await expect
      .poll(() => requests.length, { timeout: 10000 })
      .toBeGreaterThan(0);
    dispose();

    // Every api.geolonia.com request should hit /v1/ path, not /dev/
    const v1Urls = requests
      .map((r) => r.url())
      .filter((url) => new URL(url).pathname.startsWith("/v1/"));
    expect(v1Urls.length).toBeGreaterThan(0);
  });
});
