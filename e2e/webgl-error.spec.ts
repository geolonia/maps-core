import { expect, test } from "@playwright/test";

/**
 * How the map fails on a device without WebGL. The fixture makes
 * `getContext('webgl')` return null, so initialization always throws.
 */
test.describe("WebGL initialization failure", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/webgl-error.html");
    await page.waitForSelector("#map-large .geolonia__error-container");
  });

  test("should show the recovery steps on a large map", async ({ page }) => {
    const container = page.locator("#map-large");
    await expect(
      container.locator(".geolonia__error-message-title"),
    ).toHaveText("地図を表示できませんでした");
    await expect(
      container.locator(".geolonia__error-message-lead"),
    ).toBeVisible();
    await expect(
      container.locator(".geolonia__error-message-steps li"),
    ).toHaveCount(4);
    await expect(
      container.locator(".geolonia__error-message-contact"),
    ).toBeVisible();
    await expect(
      container.locator(".geolonia__error-message-brief"),
    ).toBeHidden();
  });

  test("should not tell the visitor to open the developer tools", async ({
    page,
  }) => {
    await expect(page.locator("#map-large")).not.toContainText("開発者ツール");
  });

  test("should fall back to the short message on a medium map", async ({
    page,
  }) => {
    const container = page.locator("#map-medium");
    await expect(
      container.locator(".geolonia__error-message-title"),
    ).toBeVisible();
    await expect(
      container.locator(".geolonia__error-message-brief"),
    ).toBeVisible();
    await expect(
      container.locator(".geolonia__error-message-steps"),
    ).toBeHidden();
  });

  test("should show the headline alone on a small map", async ({ page }) => {
    const container = page.locator("#map-small");
    await expect(
      container.locator(".geolonia__error-message-title"),
    ).toBeVisible();
    await expect(
      container.locator(".geolonia__error-message-brief"),
    ).toBeHidden();
    await expect(
      container.locator(".geolonia__error-message-steps"),
    ).toBeHidden();
  });

  test("should keep the message inside the map container", async ({ page }) => {
    for (const id of ["#map-large", "#map-medium", "#map-small"]) {
      const container = await page.locator(id).boundingBox();
      const message = await page
        .locator(`${id} .geolonia__error-message`)
        .boundingBox();
      if (!container || !message) throw new Error(`no bounding box for ${id}`);
      expect(message.x).toBeGreaterThanOrEqual(container.x - 1);
      expect(message.y).toBeGreaterThanOrEqual(container.y - 1);
      expect(message.x + message.width).toBeLessThanOrEqual(
        container.x + container.width + 1,
      );
      expect(message.y + message.height).toBeLessThanOrEqual(
        container.y + container.height + 1,
      );
    }
  });

  test("should replace the message with errorMessage", async ({ page }) => {
    const container = page.locator("#map-custom");
    await expect(
      container.locator(".geolonia__error-message-description"),
    ).toHaveText(
      "地図を表示できませんでした。お手数ですが 0120-000-000 までご連絡ください。",
    );
    await expect(
      container.locator(".geolonia__error-message-steps"),
    ).toHaveCount(0);
  });

  test("should render nothing when errorMessage is false", async ({ page }) => {
    await expect(
      page.locator("#map-off .geolonia__error-container"),
    ).toHaveCount(0);
  });

  test("should stop the loader when initialization fails", async ({ page }) => {
    for (const id of ["#map-large", "#map-off"]) {
      await expect(page.locator(`${id} .loading-geolonia-map`)).toHaveCount(0);
    }
  });
});
