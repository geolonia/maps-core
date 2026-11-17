import { expect, type Page, test } from "@playwright/test";
import { collectConsoleErrors, waitForMapLoad } from "./helper";

// setStyle とスタイルの作り直しのあとに、geojson（SimpleStyle）と simpleVector のソースとレイヤーが
// 1 組だけ揃っていることを確かめる（#175）

type TestMap = {
  getSource: (
    id: string,
  ) => { serialize: () => { data?: unknown } } | undefined;
  getLayer: (id: string) => unknown;
  loaded: () => boolean;
  isMoving: () => boolean;
  getStyle: () => {
    sources: Record<string, unknown>;
    layers: { id: string; source?: string }[];
  };
  setStyle: (style: unknown, options?: Record<string, unknown>) => void;
  setLayoutProperty: (layer: string, name: string, value: unknown) => void;
  on: (type: string, listener: (...args: unknown[]) => void) => void;
  once: (type: string, listener: () => void) => void;
};

type TestWindow = { map: TestMap; mapErrors: string[] };

const SIMPLE_STYLE_SOURCES = [
  "geolonia-simple-style",
  "geolonia-simple-style-points",
];
const SIMPLE_VECTOR_SOURCE = "vt-geolonia-simple-style";

// 地図の読み込み（最悪 15 秒 × 2）と、ここでの待ち（それぞれ最悪 10 秒）を足しても収まる値にする
test.describe.configure({ timeout: 90000 });

/** 地図の error イベントを集め始めます（GeoloniaMap が購読するのでコンソールには出ない）。 */
async function recordMapErrors(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as TestWindow;
    w.mapErrors = [];
    w.map.on("error", (event) => {
      const error = (event as { error?: { message?: string } }).error;
      w.mapErrors.push(String(error?.message ?? error));
    });
  });
}

/**
 * 集めた地図の error イベントです。example の simpleVector のタイル（`/tiles/...`）は配信していないので、
 * その解析の失敗は除きます。
 */
async function mapErrorsOf(page: Page): Promise<string[]> {
  const errors = await page.evaluate(
    () => (window as unknown as TestWindow).mapErrors,
  );
  return errors.filter(
    (message) => !message.startsWith("Unable to parse the tile at "),
  );
}

/** 指定した ID のソースが、今のスタイルにあるかどうかです。 */
async function sourcesPresent(page: Page, ids: string[]): Promise<boolean[]> {
  return page.evaluate(
    (sourceIds) =>
      sourceIds.map(
        (id) =>
          (window as unknown as TestWindow).map.getSource(id) !== undefined,
      ),
    ids,
  );
}

/** 指定したソースを使うレイヤーの ID です。 */
async function layersOf(page: Page, sourceIds: string[]): Promise<string[]> {
  return page.evaluate(
    (ids) =>
      (window as unknown as TestWindow).map
        .getStyle()
        .layers.filter((layer) => ids.includes(layer.source ?? ""))
        .map((layer) => layer.id),
    sourceIds,
  );
}

/**
 * 次の `style.load` の待ちを登録します。取得を進める前に登録を済ませ、取りこぼさないようにします。
 * 待つのは {@link styleLoadedAndIdle} です。
 */
async function armStyleLoad(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as TestWindow & { styleLoad?: Promise<void> };
    w.styleLoad = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("style.load timed out")),
        10000,
      );
      w.map.once("style.load", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  });
}

/**
 * {@link armStyleLoad} で登録した `style.load` を待ち、同じ `evaluate` の中で地図が落ち着く（idle）まで待ちます。
 * 別の `evaluate` で待つと、その間に `idle` が来て取りこぼすので、先に `loaded()` と `isMoving()` で確かめ、
 * 落ち着いていなければ `idle` を待ちます。
 */
async function styleLoadedAndIdle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window as unknown as TestWindow & { styleLoad?: Promise<void> };
    await w.styleLoad;
    if (w.map.loaded() && !w.map.isMoving()) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("idle timed out")),
        10000,
      );
      w.map.once("idle", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  });
}

/**
 * WebGL のコンテキストを失わせてから戻し、MapLibre にスナップショットからスタイルを作り直させて、落ち着く（idle）まで待ちます。
 * 戻った直後の同じ `evaluate` の中で `idle` を待つので、間に `idle` が来て取りこぼすことがありません。
 */
async function loseAndRestoreContext(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const w = window as unknown as TestWindow;
        const timer = setTimeout(
          () => reject(new Error("webglcontextrestored timed out")),
          10000,
        );
        w.map.once("webglcontextrestored", () => {
          clearTimeout(timer);
          const idleTimer = setTimeout(
            () => reject(new Error("idle timed out")),
            10000,
          );
          w.map.once("idle", () => {
            clearTimeout(idleTimer);
            resolve();
          });
        });
        const canvas = document.querySelector(
          "canvas.maplibregl-canvas",
        ) as HTMLCanvasElement;
        const lose = canvas
          .getContext("webgl2")
          ?.getExtension("WEBGL_lose_context");
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
}

test.describe("style extensions after a style change (#175)", () => {
  test("setStyle(URL) の差分の取得中に古いスタイルの styledata が来ても、geojson を作り直す", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/geojson.html");
    await waitForMapLoad(page);
    await recordMapErrors(page);
    const layersBefore = await layersOf(page, SIMPLE_STYLE_SOURCES);
    expect(layersBefore.length).toBeGreaterThan(0);

    // 新しいスタイルの取得を止めておく
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/sample-basic-style.json?v=held", async (route) => {
      await released;
      await route.continue();
    });

    // 差分（既定）で差し替え、取得中に古いスタイルを変えて styledata を出させる。
    // 取りこぼさないよう、変える前に styledata の待ちを登録しておく
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const w = window as unknown as TestWindow;
          const baseLayer = w.map
            .getStyle()
            .layers.find((layer) => !layer.id.includes("simple-style"));
          if (!baseLayer) {
            reject(new Error("no base layer"));
            return;
          }
          w.map.setStyle(
            new URL("/sample-basic-style.json?v=held", location.href).href,
          );
          const timer = setTimeout(
            () => reject(new Error("styledata timed out")),
            10000,
          );
          w.map.once("styledata", () => {
            clearTimeout(timer);
            resolve();
          });
          w.map.setLayoutProperty(baseLayer.id, "visibility", "visible");
        }),
    );

    // 取得を進め、差分が適用されて落ち着くまで待つ
    await armStyleLoad(page);
    release();
    await styleLoadedAndIdle(page);

    expect(await sourcesPresent(page, SIMPLE_STYLE_SOURCES)).toEqual([
      true,
      true,
    ]);
    expect(await layersOf(page, SIMPLE_STYLE_SOURCES)).toEqual(layersBefore);
    expect(await mapErrorsOf(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  for (const kind of ["geojson", "simpleVector"] as const) {
    test(`コンテキストを復元したあとも、${kind} のソースとレイヤーが 1 組だけ残り、エラーが出ない`, async ({
      page,
    }) => {
      const errors = collectConsoleErrors(page);
      await page.goto(
        kind === "geojson" ? "/geojson.html" : "/simple-vector.html",
      );
      await waitForMapLoad(page);
      await recordMapErrors(page);
      const sources =
        kind === "geojson" ? SIMPLE_STYLE_SOURCES : [SIMPLE_VECTOR_SOURCE];
      const layersBefore = await layersOf(page, sources);
      expect(layersBefore.length).toBeGreaterThan(0);

      await loseAndRestoreContext(page);

      expect(await sourcesPresent(page, sources)).toEqual(
        sources.map(() => true),
      );
      expect(await layersOf(page, sources)).toEqual(layersBefore);
      expect(await mapErrorsOf(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test("transformStyle で写した geojson のソースに、取得中だった GeoJSON が入る", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);

    // GeoJSON の取得を止めておく
    let releaseGeoJSON: () => void = () => {};
    const geojsonReleased = new Promise<void>((resolve) => {
      releaseGeoJSON = resolve;
    });
    await page.route("**/sample.geojson", async (route) => {
      await geojsonReleased;
      await route.continue();
    });

    await page.goto("/geojson.html?source=url");
    await waitForMapLoad(page);
    await recordMapErrors(page);
    const layersBefore = await layersOf(page, SIMPLE_STYLE_SOURCES);

    // 新しいスタイルの取得も止めておき、その間に GeoJSON の取得を終わらせる
    let releaseStyle: () => void = () => {};
    const styleReleased = new Promise<void>((resolve) => {
      releaseStyle = resolve;
    });
    let styleRequested: () => void = () => {};
    const styleRequestSeen = new Promise<void>((resolve) => {
      styleRequested = resolve;
    });
    await page.route("**/sample-basic-style.json?v=carry", async (route) => {
      styleRequested();
      await styleReleased;
      await route.continue();
    });

    // 前のスタイルの geojson のソースとレイヤーを、新しいスタイルに写す
    await page.evaluate(() => {
      const w = window as unknown as TestWindow;
      w.map.setStyle(
        new URL("/sample-basic-style.json?v=carry", location.href).href,
        {
          diff: false,
          transformStyle: (
            previous: {
              sources: Record<string, unknown>;
              layers: { id: string; source?: string }[];
            },
            next: {
              sources: Record<string, unknown>;
              layers: { id: string; source?: string }[];
            },
          ) => {
            const ids = [
              "geolonia-simple-style",
              "geolonia-simple-style-points",
            ];
            const sources = { ...next.sources };
            for (const id of ids) sources[id] = previous.sources[id];
            return {
              ...next,
              sources,
              layers: [
                ...next.layers,
                ...previous.layers.filter((layer) =>
                  ids.includes(layer.source ?? ""),
                ),
              ],
            };
          },
        },
      );
    });
    await Promise.race([
      styleRequestSeen,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("style request timed out")), 10000),
      ),
    ]);

    // 新しいスタイルを取得している間に GeoJSON が届く
    const geojsonDone = page.waitForResponse("**/sample.geojson", {
      timeout: 10000,
    });
    releaseGeoJSON();
    await geojsonDone;

    await armStyleLoad(page);
    releaseStyle();
    await styleLoadedAndIdle(page);

    const featureCount = await page.evaluate(() => {
      const w = window as unknown as TestWindow;
      const count = (id: string) =>
        (
          w.map.getSource(id)?.serialize().data as
            | { features?: unknown[] }
            | undefined
        )?.features?.length ?? 0;
      return (
        count("geolonia-simple-style") + count("geolonia-simple-style-points")
      );
    });
    expect(featureCount).toBeGreaterThan(0);
    expect(await layersOf(page, SIMPLE_STYLE_SOURCES)).toEqual(layersBefore);
    expect(await mapErrorsOf(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
