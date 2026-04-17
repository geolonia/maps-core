import { expect, test } from "@playwright/test";
import { waitForMapLoad } from "./helper";

async function wheelOverMap(
  page: import("@playwright/test").Page,
): Promise<void> {
  const canvas = page.locator("canvas.maplibregl-canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not visible");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  // Dispatch wheel events directly on the canvas element so MapLibre's
  // scrollZoom handler (bound to the canvas) receives them.
  await canvas.evaluate((el) => {
    for (let i = 0; i < 5; i++) {
      el.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: -120,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  });
}

test.describe("Gesture handling", () => {
  test("should suppress wheel zoom on scrollable pages by default", async ({
    page,
  }) => {
    await page.goto("/gesture.html");
    await waitForMapLoad(page);

    // Let the dynamic import of GestureHandling resolve
    await page.waitForTimeout(500);

    const initialZoom = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getZoom: () => number;
      };
      return map.getZoom();
    });

    await wheelOverMap(page);
    await page.waitForTimeout(300);

    const afterZoom = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getZoom: () => number;
      };
      return map.getZoom();
    });

    expect(afterZoom).toBeCloseTo(initialZoom, 2);
  });

  test("should allow wheel zoom when gestureHandling is false", async ({
    page,
  }) => {
    await page.goto("/gesture.html?gestureHandling=false");
    await waitForMapLoad(page);
    await page.waitForTimeout(500);

    const initialZoom = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getZoom: () => number;
      };
      return map.getZoom();
    });

    await wheelOverMap(page);
    await page.waitForTimeout(300);

    const afterZoom = await page.evaluate(() => {
      const map = (window as unknown as Record<string, unknown>).map as {
        getZoom: () => number;
      };
      return map.getZoom();
    });

    expect(afterZoom).toBeGreaterThan(initialZoom);
  });
});
