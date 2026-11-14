import { expect, type Page, test } from "@playwright/test";
import { waitForMapLoad } from "./helper";

type ProjectionMap = {
  style: object;
  getProjection: () => { type?: unknown } | undefined;
  setProjection: (projection: { type: string }) => void;
  setStyle: (style: unknown, options?: Record<string, unknown>) => void;
  getStyle: () => Record<string, unknown>;
  getLayer: (id: string) => unknown;
  addLayer: (layer: Record<string, unknown>) => void;
  on: (
    type: string,
    listener: (event: { newProjection?: string }) => void,
  ) => void;
  once: (type: string, listener: () => void) => void;
};

type TestWindow = {
  map: ProjectionMap;
  /** 地図を読み込んだ後に発火した projectiontransition の新しい投影です。 */
  transitions: string[];
};

/** 地図の今の投影の名前です。スタイルに投影が無いときは undefined です。 */
async function projectionOf(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const map = (window as unknown as TestWindow).map;
    return map.getProjection()?.type;
  });
}

/**
 * 地図を開いて読み込みを待ち、その後の projectiontransition を記録し始めます。
 * コンソールのエラーとページの例外を集めた配列を返します。
 */
async function openMap(page: Page, query: string): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`/options.html${query}`);
  await waitForMapLoad(page);
  await page.evaluate(() => {
    const w = window as unknown as TestWindow;
    w.transitions = [];
    w.map.on("projectiontransition", (event) => {
      w.transitions.push(String(event.newProjection));
    });
  });
  return errors;
}

/** 地図を読み込んだ後に発火した projectiontransition の新しい投影です。 */
async function transitionsOf(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as TestWindow).transitions);
}

/**
 * スタイルを差し替え、その後の `style.load` を待ちます。
 * 待たずに確かめると、新しいスタイルを適用する前の投影を見てしまうためです。
 *
 * - `full`: サンプルのスタイルを URL で、作り直し（`diff: false`）で適用する
 * - `styleGlobe`: 今のスタイルに `projection: globe` を足し、作り直しで適用する
 * - `diff`: 今のスタイルから `projection` を除いてレイヤーを 1 つ足し、差分で適用する
 * - `same`: 今のスタイル（`getStyle()`）をそのまま差分で適用する
 * - `userTransform`: サンプルのスタイルを、レイヤーを 1 つ足す transformStyle 付きで、作り直しで適用する
 *
 * 待つ上限の 10 秒は、地図の読み込みの待ち（`waitForMapLoad`）と合わせて、テストの timeout（30 秒）に収まる値です。
 */
async function setStyleAndWait(
  page: Page,
  kind: "full" | "styleGlobe" | "diff" | "same" | "userTransform",
): Promise<void> {
  await page.evaluate(
    (kind) =>
      new Promise<void>((resolve, reject) => {
        const map = (window as unknown as TestWindow).map;
        const timer = setTimeout(
          () => reject(new Error("style.load timed out")),
          10000,
        );
        map.once("style.load", () => {
          clearTimeout(timer);
          resolve();
        });
        const added = {
          id: "added-by-test",
          type: "background",
          paint: { "background-opacity": 0 },
        };
        if (kind === "full") {
          map.setStyle("/sample-basic-style.json", { diff: false });
        } else if (kind === "styleGlobe") {
          map.setStyle(
            { ...map.getStyle(), projection: { type: "globe" } },
            { diff: false },
          );
        } else if (kind === "diff") {
          const { projection: _, ...style } = map.getStyle();
          map.setStyle({
            ...style,
            layers: [...(style.layers as unknown[]), added],
          });
        } else if (kind === "same") {
          map.setStyle(map.getStyle());
        } else {
          map.setStyle("/sample-basic-style.json", {
            diff: false,
            transformStyle: (_: unknown, next: Record<string, unknown>) => ({
              ...next,
              layers: [...(next.layers as unknown[]), added],
            }),
          });
        }
      }),
    kind,
  );
}

test.describe("projection option", () => {
  test("should show the map as a globe", async ({ page }) => {
    const errors = await openMap(page, "?projection=globe");

    expect(await projectionOf(page)).toBe("globe");
    expect(errors).toEqual([]);
  });

  test("should keep the projection of the style without the option", async ({
    page,
  }) => {
    const errors = await openMap(page, "");

    // サンプルのスタイルは projection を持たないので、MapLibre の既定（mercator）のまま
    expect(await projectionOf(page)).toBeUndefined();
    expect(errors).toEqual([]);
  });

  test("should prefer the option to the projection of the style", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=mercator");

    await setStyleAndWait(page, "styleGlobe");

    expect(await projectionOf(page)).toBe("mercator");
    expect(errors).toEqual([]);
  });

  test("should apply the projection again after a full setStyle, without switching to mercator on the way", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=globe");

    await setStyleAndWait(page, "full");

    expect(await projectionOf(page)).toBe("globe");
    // スタイルを適用する前に投影を書き込むので、途中でスタイルの投影（mercator）に切り替わらない
    expect(await transitionsOf(page)).not.toContain("mercator");
    expect(errors).toEqual([]);
  });

  test("should apply the projection again after setStyle is applied as a diff", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=globe");
    // 差分で適用されたことを確かめるため、今の Style のオブジェクトに印を付ける。
    // 作り直しなら Style のオブジェクトが新しくなり、印が消える
    await page.evaluate(() => {
      const map = (window as unknown as TestWindow).map;
      (map.style as { __beforeDiff?: boolean }).__beforeDiff = true;
    });

    // projection の無いスタイルを差分で適用する。投影を書き込まなければ、MapLibre は投影を mercator に戻す
    await setStyleAndWait(page, "diff");

    const state = await page.evaluate(() => {
      const map = (window as unknown as TestWindow).map;
      return {
        diffApplied:
          (map.style as { __beforeDiff?: boolean }).__beforeDiff === true,
        projection: map.getProjection()?.type,
      };
    });
    expect(state).toEqual({ diffApplied: true, projection: "globe" });
    expect(await transitionsOf(page)).not.toContain("mercator");
    expect(errors).toEqual([]);
  });

  test("should keep a projection set by the user until the next setStyle", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=globe");

    await page.evaluate(() => {
      const map = (window as unknown as TestWindow).map;
      map.setProjection({ type: "mercator" });
      // スタイルの変更（レイヤーの追加）では、オプションの投影に戻さない
      map.addLayer({
        id: "added-after-set-projection",
        type: "background",
        paint: { "background-opacity": 0 },
      });
    });
    expect(await projectionOf(page)).toBe("mercator");

    // 今のスタイルをそのまま差分で適用しても、オプションの投影に戻る
    await setStyleAndWait(page, "same");
    expect(await projectionOf(page)).toBe("globe");
    expect(errors).toEqual([]);
  });

  test("should apply the projection with a transformStyle given to setStyle", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=globe");

    await setStyleAndWait(page, "userTransform");

    const state = await page.evaluate(() => {
      const map = (window as unknown as TestWindow).map;
      return {
        transformed: map.getLayer("added-by-test") !== undefined,
        projection: map.getProjection()?.type,
      };
    });
    expect(state).toEqual({ transformed: true, projection: "globe" });
    expect(errors).toEqual([]);
  });

  test("should apply the projection with a transformStyle given to the constructor", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=globe&transformStyle=true");

    const state = await page.evaluate(() => {
      const map = (window as unknown as TestWindow).map;
      return {
        transformed:
          map.getLayer("added-by-constructor-transform") !== undefined,
        projection: map.getProjection()?.type,
      };
    });
    expect(state).toEqual({ transformed: true, projection: "globe" });
    expect(errors).toEqual([]);
  });

  test("should log an error and ignore an unsupported projection", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=vertical-perspective");

    expect(await projectionOf(page)).toBeUndefined();
    expect(errors).toEqual([
      expect.stringContaining("[Geolonia] The projection must be"),
    ]);
  });
});
