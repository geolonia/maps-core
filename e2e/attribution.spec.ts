import { expect, test } from "@playwright/test";
import { waitForMapLoad } from "./helper";

test.describe("Custom Attribution Control", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForMapLoad(page);
  });

  test("should render attribution text inside a Shadow DOM", async ({
    page,
  }) => {
    // The CustomAttributionControl mounts a <div> whose shadow root contains
    // <details class="maplibregl-ctrl maplibregl-ctrl-attrib"> with inner
    // text (OpenMapTiles / OpenStreetMap contributors, etc.).
    const info = await page.evaluate(() => {
      const ctrls = document.querySelectorAll(
        ".maplibregl-ctrl-bottom-right > div",
      );
      for (const el of Array.from(ctrls)) {
        if (el.shadowRoot) {
          const details = el.shadowRoot.querySelector(
            "details.maplibregl-ctrl-attrib",
          );
          const inner = el.shadowRoot.querySelector(
            ".maplibregl-ctrl-attrib-inner",
          );
          return {
            hasShadow: true,
            hasDetails: !!details,
            innerText: inner?.textContent || "",
          };
        }
      }
      return { hasShadow: false, hasDetails: false, innerText: "" };
    });

    expect(info.hasShadow).toBe(true);
    expect(info.hasDetails).toBe(true);
    expect(info.innerText.length).toBeGreaterThan(0);
  });

  test("should not render MapLibre's default attribution in light DOM", async ({
    page,
  }) => {
    // MapLibre's built-in attribution would be a light-DOM <details> element
    // as a direct child of .maplibregl-ctrl-bottom-right. Our CustomAttribution
    // puts its <details> inside a shadow root of a wrapper <div> instead, so
    // no top-level <details class="maplibregl-ctrl-attrib"> should exist in
    // light DOM.
    const lightDomDetails = await page.evaluate(() => {
      // Exclude shadow roots — querySelectorAll does not pierce shadow DOM
      return document.querySelectorAll(
        ".maplibregl-ctrl-bottom-right > details.maplibregl-ctrl-attrib",
      ).length;
    });
    expect(lightDomDetails).toBe(0);
  });
});
