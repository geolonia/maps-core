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
 * - `urlDiff`: サンプルのスタイル（今と同じ URL）を、差分で適用する
 * - `object`: 今のスタイルから `projection` を除いたオブジェクトを、作り直しで適用する
 * - `styleGlobe`: 今のスタイルに `projection: globe` を足し、作り直しで適用する
 * - `diff`: 今のスタイルから `projection` を除いてレイヤーを 1 つ足し、差分で適用する
 * - `same`: 今のスタイル（`getStyle()`）をそのまま差分で適用する
 * - `userTransform`: サンプルのスタイルを、レイヤーを 1 つ足す transformStyle 付きで、作り直しで適用する
 *
 * 待つ上限は 10 秒です。地図の読み込みの待ち（`waitForMapLoad` は最悪 15 秒 × 2）と足すとテストの既定の timeout（30 秒）を超えるので、
 * このファイルのテストの timeout は 45 秒にしています（`test.describe.configure`）。
 */
async function setStyleAndWait(
  page: Page,
  kind:
    | "full"
    | "urlDiff"
    | "object"
    | "styleGlobe"
    | "diff"
    | "same"
    | "userTransform",
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
        } else if (kind === "urlDiff") {
          map.setStyle("/sample-basic-style.json");
        } else if (kind === "object") {
          const { projection: _, ...style } = map.getStyle();
          map.setStyle(style, { diff: false });
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
  test.describe.configure({ timeout: 45000 });

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

  test("should prefer the option to the projection of a style given by URL", async ({
    page,
  }) => {
    // projection: globe を持つスタイルを URL で読み込む（地図を作るときの最初のスタイル）
    const errors = await openMap(
      page,
      "?style=/sample-globe-style.json&projection=mercator",
    );

    expect(await projectionOf(page)).toBe("mercator");
    expect(errors).toEqual([]);
  });

  test("should keep the projection of a style given by URL without the option", async ({
    page,
  }) => {
    const errors = await openMap(page, "?style=/sample-globe-style.json");

    expect(await projectionOf(page)).toBe("globe");
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

  test("should write the projection into a style given by URL after the current style has loaded", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=globe");

    await setStyleAndWait(page, "full");

    expect(await projectionOf(page)).toBe("globe");
    // 今のスタイルの読み込みが終わっているので、取得したスタイルに書き込んでから適用し、途中で mercator に切り替わらない
    expect(await transitionsOf(page)).not.toContain("mercator");
    expect(errors).toEqual([]);
  });

  test("should apply the projection to a style given by URL before the first style loads", async ({
    page,
  }) => {
    // 最初のスタイルの応答を止めておき、その読み込み中に、projection: globe を持つ別の URL のスタイルを渡す
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/sample-basic-style.json", async (route) => {
      await held;
      await route.continue().catch(() => {});
    });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/options.html?projection=mercator");
    await page.waitForFunction(
      () => (window as unknown as Partial<TestWindow>).map !== undefined,
    );
    await page.evaluate(() => {
      const map = (window as unknown as TestWindow).map;
      map.setStyle("/sample-globe-style.json");
    });
    release();
    await waitForMapLoad(page);

    // 読み込み中は書き込めないので、読み込んだ後にオプションの mercator を指定し直す
    expect(await projectionOf(page)).toBe("mercator");
    expect(errors).toEqual([]);
  });

  test("should set mercator even when the style has no projection", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=mercator");

    expect(await projectionOf(page)).toBe("mercator");
    expect(errors).toEqual([]);
  });

  test("should apply the projection again when the same URL is applied as a diff after setProjection", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=globe");
    await page.evaluate(() => {
      const w = window as unknown as TestWindow;
      w.map.setProjection({ type: "mercator" });
      w.transitions = [];
    });

    // 取得したスタイルに書き込むので、投影だけが今のスタイルと違う差分になり、オプションの値に戻る
    await setStyleAndWait(page, "urlDiff");

    expect(await projectionOf(page)).toBe("globe");
    expect(await transitionsOf(page)).toEqual(["globe"]);
    expect(errors).toEqual([]);
  });

  test("should write the projection into a style object, without switching to mercator on the way", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=globe");

    await setStyleAndWait(page, "object");

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
    // transformStyle の結果に投影を書き込むので、URL のスタイルでも途中で mercator に切り替わらない
    expect(await transitionsOf(page)).not.toContain("mercator");
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

    // 地図を作るときの transformStyle にも投影を書き込むので、URL の setStyle でも途中で mercator に切り替わらない
    await setStyleAndWait(page, "full");
    expect(await projectionOf(page)).toBe("globe");
    expect(await transitionsOf(page)).not.toContain("mercator");
    expect(errors).toEqual([]);
  });

  test("should apply the projection again after the WebGL context is restored", async ({
    page,
  }) => {
    const errors = await openMap(page, "?projection=globe");

    // 利用者が変えた投影も、コンテキストの復元でスタイルを作り直すとオプションの値に戻る
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const w = window as unknown as TestWindow;
          const map = w.map;
          map.setProjection({ type: "mercator" });
          // 復元のときの切り替えだけを見るため、ここまでの記録を捨てる
          w.transitions = [];
          const timer = setTimeout(
            () => reject(new Error("style.load timed out")),
            10000,
          );
          map.once("style.load", () => {
            clearTimeout(timer);
            resolve();
          });
          const canvas = document.querySelector(
            "canvas.maplibregl-canvas",
          ) as HTMLCanvasElement;
          const gl = canvas.getContext("webgl2");
          const lose = gl?.getExtension("WEBGL_lose_context");
          if (!lose) {
            reject(new Error("WEBGL_lose_context is not available"));
            return;
          }
          canvas.addEventListener(
            "webglcontextlost",
            () => setTimeout(() => lose.restoreContext(), 0),
            { once: true },
          );
          lose.loseContext();
        }),
    );

    expect(await projectionOf(page)).toBe("globe");
    // 作り直すスタイルに書き込んでから適用するので、復元したスタイルが利用者の投影（mercator）で読み込まれない
    expect(await transitionsOf(page)).not.toContain("mercator");
    expect(errors).toEqual([]);
  });

  for (const fallback of ["object", "url"] as const) {
    test(`should apply a fallback style after the first style fails to load (${fallback})`, async ({
      page,
    }) => {
      // 取得を止めておき、地図の error を待ち受けてから 404 を返す。失敗を確かめてから次の setStyle を呼ぶため
      let fail: () => void = () => {};
      const failed = new Promise<void>((resolve) => {
        fail = resolve;
      });
      await page.route("**/sample-basic-style.json", async (route) => {
        await failed;
        await route.fulfill({ status: 404, body: "not found" });
      });
      await page.goto("/options.html?projection=globe");
      await page.waitForFunction(
        () => (window as unknown as Partial<TestWindow>).map !== undefined,
      );
      const errored = page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const map = (window as unknown as TestWindow).map;
            map.once("error", () => resolve());
          }),
      );
      fail();
      await errored;

      // 最初のスタイルの取得に失敗しても、次の setStyle は前のスタイルの読み込みを待たずに適用される
      const projection = await page.evaluate(
        (fallback) =>
          new Promise<unknown>((resolve, reject) => {
            const map = (window as unknown as TestWindow).map;
            const timer = setTimeout(
              () => reject(new Error("style.load timed out")),
              10000,
            );
            map.once("style.load", () => {
              clearTimeout(timer);
              resolve(map.getProjection()?.type);
            });
            if (fallback === "url") {
              map.setStyle("/sample-globe-style.json");
              return;
            }
            map.setStyle(
              {
                version: 8,
                sources: {},
                layers: [
                  {
                    id: "fallback",
                    type: "background",
                    paint: { "background-color": "#cccccc" },
                  },
                ],
              },
              { diff: false },
            );
          }),
        fallback,
      );
      expect(projection).toBe("globe");
    });
  }

  test("should release the style when the map is removed before it loads", async ({
    page,
  }) => {
    // スタイルの応答を止めておき、読み込みの前に破棄する
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/sample-basic-style.json", async (route) => {
      await held;
      await route.continue().catch(() => {});
    });
    await page.goto("/options.html?projection=globe");
    await page.waitForFunction(
      () => (window as unknown as Partial<TestWindow>).map !== undefined,
    );

    const styleAfterRemove = await page.evaluate(() => {
      const map = (window as unknown as TestWindow).map as unknown as {
        style?: object;
        remove: () => void;
      };
      map.remove();
      return map.style;
    });
    release();

    expect(styleAfterRemove).toBeUndefined();
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
