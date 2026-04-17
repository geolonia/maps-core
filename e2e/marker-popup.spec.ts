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

  test("should not render marker when marker: false", async ({ page }) => {
    await page.goto("/marker-popup.html?marker=false");
    await waitForMapLoad(page);
    const marker = page.locator(".geolonia-default-marker");
    await expect(marker).toHaveCount(0);
  });

  test("should show popup initially when openPopup: true", async ({ page }) => {
    await waitForMapLoad(page);
    const popup = page.locator(".maplibregl-popup");
    await expect(popup).toBeVisible();
    await expect(popup.locator(".test-popup")).toHaveText("Hello Tokyo");
  });

  test("should use custom marker element when customMarker is set", async ({
    page,
  }) => {
    await page.goto("/marker-popup.html?customMarker=%23custom-marker");
    await waitForMapLoad(page);

    // The custom element should have been moved into the map as a marker,
    // and display:none should have been cleared
    const customMarker = page.locator(
      ".maplibregl-marker#custom-marker, #custom-marker.maplibregl-marker",
    );
    await expect(customMarker).toBeVisible();
    // Default marker should not exist since customMarker is used
    const defaultMarker = page.locator(".geolonia-default-marker");
    await expect(defaultMarker).toHaveCount(0);
  });

  test("should toggle popup on marker click", async ({ page }) => {
    await page.goto("/marker-popup.html?openPopup=false");
    await waitForMapLoad(page);

    const popup = page.locator(".maplibregl-popup");
    await expect(popup).toHaveCount(0);

    const marker = page.locator(".geolonia-clickable-marker").first();
    await marker.click();
    await expect(popup).toBeVisible();

    await marker.click();
    await expect(popup).toHaveCount(0);
  });
});
