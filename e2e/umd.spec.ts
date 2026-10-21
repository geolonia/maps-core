import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { collectConsoleErrors, waitForMapLoad } from "./helper";

// UMD バンドル (dist/umd/maps-core.umd.cjs) をブラウザで読み込んで動くことを確認する e2e。
//
// UMD では maplibre-gl の worker をバンドルへ埋め込んでいる (vite.umd.config.ts, src/umd.ts)。
// worker が動かなくても例外もコンソールエラーも出ず、build:umd も成功し、地図だけが出ない。
// GeoJSON のパースは worker 内で行われるため、GeoJSON ソースの feature が描画されることで
// worker が動いていることを確かめる。
//
// 他の e2e と違い、Vite dev server が配信する src ではなくビルド成果物を読み込む。
// Vite を経由すると .cjs がモジュールとして変換されうるため、ページ・スタイル・バンドルは
// page.route でディスクから直接返す。CI では build ジョブの成果物を e2e ジョブに渡している。

const UMD_PATH = resolve("dist/umd/maps-core.umd.cjs");

const STYLE = {
  version: 8,
  sources: {
    points: {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Tokyo Station" },
            geometry: { type: "Point", coordinates: [139.7671, 35.6812] },
          },
        ],
      },
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#ffffff" },
    },
    {
      id: "points",
      type: "circle",
      source: "points",
      paint: { "circle-radius": 20, "circle-color": "#e4402f" },
    },
  ],
};

const PAGE = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>UMD E2E</title>
  <style>#map { width: 100%; height: 400px; }</style>
</head>
<body>
  <div id="map"></div>
  <script src="/__umd__/maps-core.umd.cjs"></script>
  <script>
    window.map = new GeoloniaMapsCore.GeoloniaMap({
      container: "#map",
      style: "/__umd__/style.json",
      center: [139.7671, 35.6812],
      zoom: 14,
      marker: false,
      gestureHandling: false,
      loader: false,
    });
  </script>
</body>
</html>`;

test.describe("UMD bundle", () => {
  test.beforeAll(() => {
    if (!existsSync(UMD_PATH)) {
      throw new Error(
        `${UMD_PATH} がありません。先に \`npm run build:umd\` を実行してください。`,
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.route("**/__umd__/index.html", (route) =>
      route.fulfill({ contentType: "text/html", body: PAGE }),
    );
    await page.route("**/__umd__/style.json", (route) =>
      route.fulfill({ json: STYLE }),
    );
    await page.route("**/__umd__/maps-core.umd.cjs", (route) =>
      route.fulfill({
        contentType: "text/javascript",
        body: readFileSync(UMD_PATH),
      }),
    );
  });

  test("renders GeoJSON features parsed by the embedded worker", async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/__umd__/index.html");
    await waitForMapLoad(page);

    // idle を待ってから描画済みの feature を数える
    const count = await page.evaluate(
      () =>
        new Promise<number>((resolveCount) => {
          const map = (
            window as unknown as {
              map: {
                once: (type: string, cb: () => void) => void;
                triggerRepaint: () => void;
                queryRenderedFeatures: (options: {
                  layers: string[];
                }) => unknown[];
              };
            }
          ).map;
          map.once("idle", () =>
            resolveCount(
              map.queryRenderedFeatures({ layers: ["points"] }).length,
            ),
          );
          map.triggerRepaint();
        }),
    );
    expect(count).toBeGreaterThan(0);
    expect(errors).toHaveLength(0);
  });
});
