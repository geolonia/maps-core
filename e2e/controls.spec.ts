import { expect, test } from "@playwright/test";
import { waitForMapLoad } from "./helper";

test.describe("Control widgets", () => {
  test("should show NavigationControl by default", async ({ page }) => {
    await page.goto("/controls.html");
    await waitForMapLoad(page);
    await expect(page.locator(".maplibregl-ctrl-zoom-in")).toBeVisible();
  });

  test("should hide NavigationControl when navigationControl: false", async ({
    page,
  }) => {
    await page.goto("/controls.html?navigationControl=false");
    await waitForMapLoad(page);
    await expect(page.locator(".maplibregl-ctrl-zoom-in")).toHaveCount(0);
  });

  test("should show FullscreenControl when fullscreenControl: true", async ({
    page,
  }) => {
    await page.goto("/controls.html?fullscreenControl=true");
    await waitForMapLoad(page);
    await expect(page.locator(".maplibregl-ctrl-fullscreen")).toBeVisible();
  });

  test("should show ScaleControl when scaleControl: true", async ({ page }) => {
    await page.goto("/controls.html?scaleControl=true");
    await waitForMapLoad(page);
    await expect(page.locator(".maplibregl-ctrl-scale")).toBeVisible();
  });

  test("should show GeolocateControl when geolocateControl: true", async ({
    page,
  }) => {
    await page.goto("/controls.html?geolocateControl=true");
    await waitForMapLoad(page);
    await expect(page.locator(".maplibregl-ctrl-geolocate")).toBeVisible();
  });

  test("should place NavigationControl at specified position", async ({
    page,
  }) => {
    await page.goto("/controls.html?navigationControl=top-left");
    await waitForMapLoad(page);
    const topLeft = page.locator(".maplibregl-ctrl-top-left");
    await expect(topLeft.locator(".maplibregl-ctrl-zoom-in")).toBeVisible();
    // Should not be on the default top-right corner
    await expect(
      page.locator(".maplibregl-ctrl-top-right .maplibregl-ctrl-zoom-in"),
    ).toHaveCount(0);
  });

  test("should show GeoloniaControl logo by default", async ({ page }) => {
    await page.goto("/controls.html");
    await waitForMapLoad(page);
    const geoloniaLink = page.locator('a[href*="geolonia.com"]');
    await expect(geoloniaLink).toBeVisible();
    await expect(geoloniaLink.locator("img")).toHaveAttribute(
      "alt",
      "Geolonia",
    );
  });

  // `geoloniaControl: false` による非表示は現状効かない — 仕様要確認。#42 参照。
});
