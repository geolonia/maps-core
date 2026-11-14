import { expect, type Page, test } from "@playwright/test";
import { waitForMapLoad } from "./helper";

type ProjectionMap = {
  getProjection: () => { type?: unknown } | undefined;
  setProjection: (projection: { type: string }) => void;
  setStyle: (style: unknown, options?: Record<string, unknown>) => void;
  getStyle: () => Record<string, unknown>;
  addLayer: (layer: Record<string, unknown>) => void;
  once: (type: string, listener: () => void) => void;
};

/** 地図の今の投影の名前です。スタイルに投影が無いときは undefined です。 */
async function projectionOf(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const map = (window as unknown as { map: ProjectionMap }).map;
    return map.getProjection()?.type;
  });
}

/**
 * スタイルを差し替え、その後の `style.load` を待ちます。
 * 待たずに確かめると、新しいスタイルを適用する前の投影を見てしまうためです。
 *
 * - `full`: サンプルのスタイルを URL で、作り直し（`diff: false`）で適用する
 * - `styleGlobe`: 今のスタイルに `projection: globe` を足し、作り直しで適用する
 * - `diff`: 今のスタイルから `projection` を除いてレイヤーを 1 つ足し、差分で適用する
 */
async function setStyleAndWait(
  page: Page,
  kind: "full" | "styleGlobe" | "diff",
): Promise<void> {
  await page.evaluate(
    (kind) =>
      new Promise<void>((resolve, reject) => {
        const map = (window as unknown as { map: ProjectionMap }).map;
        const timer = setTimeout(
          () => reject(new Error("style.load timed out")),
          10000,
        );
        map.once("style.load", () => {
          clearTimeout(timer);
          resolve();
        });
        if (kind === "full") {
          map.setStyle("/sample-basic-style.json", { diff: false });
        } else if (kind === "styleGlobe") {
          map.setStyle(
            { ...map.getStyle(), projection: { type: "globe" } },
            { diff: false },
          );
        } else {
          const { projection: _, ...style } = map.getStyle();
          map.setStyle({
            ...style,
            layers: [
              ...(style.layers as unknown[]),
              {
                id: "added-by-diff",
                type: "background",
                paint: { "background-opacity": 0 },
              },
            ],
          });
        }
      }),
    kind,
  );
}

/** コンソールのエラーを集めます。 */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("projection option", () => {
  test("should show the map as a globe", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/options.html?projection=globe");
    await waitForMapLoad(page);

    expect(await projectionOf(page)).toBe("globe");
    expect(errors).toEqual([]);
  });

  test("should keep the projection of the style without the option", async ({
    page,
  }) => {
    await page.goto("/options.html");
    await waitForMapLoad(page);

    // サンプルのスタイルは projection を持たないので、MapLibre の既定（mercator）のまま
    expect(await projectionOf(page)).toBeUndefined();
  });

  test("should prefer the option to the projection of the style", async ({
    page,
  }) => {
    await page.goto("/options.html?projection=mercator");
    await waitForMapLoad(page);

    await setStyleAndWait(page, "styleGlobe");

    expect(await projectionOf(page)).toBe("mercator");
  });

  test("should apply the projection again after a full setStyle", async ({
    page,
  }) => {
    await page.goto("/options.html?projection=globe");
    await waitForMapLoad(page);

    await setStyleAndWait(page, "full");

    expect(await projectionOf(page)).toBe("globe");
  });

  test("should apply the projection again after setStyle is applied as a diff", async ({
    page,
  }) => {
    await page.goto("/options.html?projection=globe");
    await waitForMapLoad(page);

    // 差分で適用されたことを確かめるため、今の Style のオブジェクトに印を付ける。
    // 作り直しなら Style のオブジェクトが新しくなり、印が消える
    await page.evaluate(() => {
      const map = (window as unknown as { map: { style: object } }).map;
      (map.style as { __beforeDiff?: boolean }).__beforeDiff = true;
    });

    // projection の無いスタイルを差分で適用すると、MapLibre は投影を mercator に戻す差分も適用する
    await setStyleAndWait(page, "diff");

    const state = await page.evaluate(() => {
      const map = (
        window as unknown as { map: ProjectionMap & { style: object } }
      ).map;
      return {
        diffApplied:
          (map.style as { __beforeDiff?: boolean }).__beforeDiff === true,
        projection: map.getProjection()?.type,
      };
    });
    expect(state).toEqual({ diffApplied: true, projection: "globe" });
  });

  test("should keep a projection set by the user until the next style load", async ({
    page,
  }) => {
    await page.goto("/options.html?projection=globe");
    await waitForMapLoad(page);

    await page.evaluate(() => {
      const map = (window as unknown as { map: ProjectionMap }).map;
      map.setProjection({ type: "mercator" });
      // スタイルの変更（styledata）では、オプションの投影に戻さない
      map.addLayer({
        id: "added-after-set-projection",
        type: "background",
        paint: { "background-opacity": 0 },
      });
    });
    expect(await projectionOf(page)).toBe("mercator");

    await setStyleAndWait(page, "full");
    expect(await projectionOf(page)).toBe("globe");
  });

  test("should log an error and ignore an unsupported projection", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/options.html?projection=vertical-perspective");
    await waitForMapLoad(page);

    expect(await projectionOf(page)).toBeUndefined();
    expect(errors).toEqual([
      expect.stringContaining("[Geolonia] The projection must be"),
    ]);
  });
});
