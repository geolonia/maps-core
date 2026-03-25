import { expect, test } from "@playwright/test";
import { waitForMapLoad } from "./helper";

test.describe("Marker and Popup", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/marker-popup.html");
  });

  test("should render default marker", async ({ page }) => {
    await waitForMapLoad(page);
    const marker = page.locator(".geolonia-default-marker");
    await expect(marker.first()).toBeVisible();
  });

  test("should add geolonia-clickable-marker class", async ({ page }) => {
    await waitForMapLoad(page);
    const marker = page.locator(".geolonia-clickable-marker");
    await expect(marker.first()).toBeVisible();
  });

  test("should apply marker color", async ({ page }) => {
    await waitForMapLoad(page);
    const leftPath = page.locator(".geolonia-default-marker .left");
    const fill = await leftPath
      .first()
      .evaluate((el) => (el as HTMLElement).style.fill);
    expect(fill).toContain("rgb"); // tinycolor converts to rgb
  });
});
