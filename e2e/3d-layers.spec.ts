import { expect, test } from "@playwright/test";
import { waitForMapLoad } from "./helper";

async function getVisibility(
  page: import("@playwright/test").Page,
  layerId: string,
): Promise<string | undefined> {
  return page.evaluate((id: string) => {
    const map = (window as unknown as Record<string, unknown>).map as {
      getLayoutProperty: (id: string, prop: string) => string | undefined;
    };
    return map.getLayoutProperty(id, "visibility");
  }, layerId);
}

test.describe("3D mode", () => {
  test('should set visible-on-3d layers to "visible" when "3d": true', async ({
    page,
  }) => {
    await page.goto("/3d.html?3d=true");
    await waitForMapLoad(page);

    // fixture: "show-on-3d-layer" starts with visibility: "none" and has
    // metadata["visible-on-3d"] = true, so 3d mode should flip it to "visible".
    expect(await getVisibility(page, "show-on-3d-layer")).toBe("visible");

    // Sanity check: with 3d off, the same layer stays "none"
    await page.goto("/3d.html");
    await waitForMapLoad(page);
    expect(await getVisibility(page, "show-on-3d-layer")).toBe("none");
  });

  test('should set hide-on-3d layers to "none" when "3d": true', async ({
    page,
  }) => {
    await page.goto("/3d.html?3d=true");
    await waitForMapLoad(page);

    // fixture: "hide-on-3d-layer" has no initial visibility (defaults to
    // visible) and has metadata["hide-on-3d"] = true, so 3d mode should flip
    // it to "none".
    expect(await getVisibility(page, "hide-on-3d-layer")).toBe("none");

    // Sanity check: with 3d off, visibility is undefined (= default visible)
    await page.goto("/3d.html");
    await waitForMapLoad(page);
    const v = await getVisibility(page, "hide-on-3d-layer");
    expect(v === undefined || v === "visible").toBe(true);
  });
});
