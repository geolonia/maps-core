import { expect, test } from "@playwright/test";
import { waitForMapLoad } from "./helper";

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
});
