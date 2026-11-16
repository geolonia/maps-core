import { expect, type Page, test } from "@playwright/test";
import { collectConsoleErrors, waitForMapLoad } from "./helper";

// 1x1 の赤い PNG。タイルの大きさに引き伸ばされて描かれる。
const RED_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

type MapLike = {
  getSource: (id: string) => { type: string; tileSize: number } | undefined;
  getStyle: () => { layers: { id: string; type: string }[] };
  setStyle: (style: unknown) => void;
  once: (event: string, cb: () => void) => void;
};

function layerIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const map = (window as unknown as { map: MapLike }).map;
    return map.getStyle().layers.map((l) => l.id);
  });
}

/** キャンバスの中央の画素の色を読む。 */
function centerPixel(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const canvas = document.querySelector(
      "canvas.maplibregl-canvas",
    ) as HTMLCanvasElement;
    const gl = (canvas.getContext("webgl2") ||
      canvas.getContext("webgl")) as WebGLRenderingContext;
    const px = new Uint8Array(4);
    gl.readPixels(
      Math.floor(gl.drawingBufferWidth / 2),
      Math.floor(gl.drawingBufferHeight / 2),
      1,
      1,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      px,
    );
    return Array.from(px);
  });
}

test.describe("rasterTiles", () => {
  let tileUrls: string[];
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    tileUrls = [];
    errors = collectConsoleErrors(page);
    await page.route("https://raster.example.com/tiles/**", (route) => {
      tileUrls.push(route.request().url());
      route.fulfill({ status: 200, contentType: "image/png", body: RED_PNG });
    });
  });

  test.afterEach(() => {
    expect(errors).toEqual([]);
  });

  test("テンプレートの {z}/{x}/{y} を埋めてタイルを読み込み、地図に描く", async ({
    page,
  }) => {
    await page.goto("/raster-tiles.html");
    await waitForMapLoad(page);

    expect(tileUrls.length).toBeGreaterThan(0);
    for (const url of tileUrls) {
      expect(url).toMatch(/\/tiles\/\d+\/\d+\/\d+\.png$/);
    }

    const source = await page.evaluate(() => {
      const map = (window as unknown as { map: MapLike }).map;
      const s = map.getSource("geolonia-raster-tiles");
      return s && { type: s.type, tileSize: s.tileSize };
    });
    expect(source).toEqual({ type: "raster", tileSize: 256 });

    // 背景は #cccccc。赤いタイルが描かれていれば中央は赤になる。
    await expect
      .poll(() => centerPixel(page), { timeout: 10000 })
      .toEqual([255, 0, 0, 255]);
  });

  test("opacity で背景の地図を透かす", async ({ page }) => {
    await page.goto("/raster-tiles.html?opacity=0.5");
    await waitForMapLoad(page);

    // 赤 (255, 0, 0) と背景 #cccccc (204, 204, 204) を半々に混ぜた色になる。
    await expect
      .poll(
        async () => {
          const [r, g, b] = await centerPixel(page);
          return (
            Math.abs(r - 230) <= 3 &&
            Math.abs(g - 102) <= 3 &&
            Math.abs(b - 102) <= 3
          );
        },
        { timeout: 10000 },
      )
      .toBe(true);
  });

  test("出典を地図の出典表示に加える", async ({ page }) => {
    await page.goto("/raster-tiles.html");
    await waitForMapLoad(page);

    await expect
      .poll(() =>
        page.evaluate(() => {
          for (const el of Array.from(
            document.querySelectorAll(".maplibregl-ctrl-bottom-right > div"),
          )) {
            const inner = el.shadowRoot?.querySelector(
              ".maplibregl-ctrl-attrib-inner",
            );
            if (inner) return inner.textContent ?? "";
          }
          return "";
        }),
      )
      .toContain("Raster fixture");
  });

  test("setStyle で差し替えた後も、最初の symbol レイヤの下に重ね直す", async ({
    page,
  }) => {
    await page.goto("/raster-tiles.html");
    await waitForMapLoad(page);

    // symbol レイヤの無いスタイルでは一番上に重ねる。
    expect(await layerIds(page)).toEqual([
      "background",
      "fixture",
      "geolonia-raster-tiles",
    ]);

    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const map = (window as unknown as { map: MapLike }).map;
          map.once("idle", () => resolve());
          map.setStyle({
            version: 8,
            sources: {
              points: {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
              },
            },
            layers: [
              {
                id: "background",
                type: "background",
                paint: { "background-color": "#eeeeee" },
              },
              { id: "label", type: "symbol", source: "points" },
              { id: "label-2", type: "symbol", source: "points" },
            ],
          });
        }),
    );

    expect(await layerIds(page)).toEqual([
      "background",
      "geolonia-raster-tiles",
      "label",
      "label-2",
    ]);
  });

  test("{z}/{x}/{y} を含まない URL は警告して重ねない", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "warning") warnings.push(msg.text());
    });

    await page.goto(
      `/raster-tiles.html?url=${encodeURIComponent("https://raster.example.com/tiles.json")}`,
    );
    await waitForMapLoad(page);

    expect(await layerIds(page)).not.toContain("geolonia-raster-tiles");
    expect(warnings.some((w) => w.includes("rasterTiles.url"))).toBe(true);
  });
});
