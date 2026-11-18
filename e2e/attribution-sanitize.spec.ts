import { expect, test } from "@playwright/test";
import { collectConsoleErrors, waitForMapLoad } from "./helper";

// 出典（ソースの attribution）はサニタイズしてから挿入する（#190）

type TestMap = {
  addSource: (id: string, source: unknown) => void;
  addLayer: (layer: unknown) => void;
  once: (type: string, listener: () => void) => void;
};
type TestWindow = { map: TestMap; __xss?: number };

test("ソースの attribution に書いたスクリプトは実行されず、リンクは残る", async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/geojson.html");
  await waitForMapLoad(page);

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const w = window as unknown as TestWindow;
        const timer = setTimeout(
          () => reject(new Error("idle timed out")),
          10000,
        );
        w.map.addSource("attribution-probe", {
          type: "raster",
          tiles: [`${location.origin}/none/{z}/{x}/{y}.png`],
          tileSize: 256,
          attribution:
            '<a href="https://example.com/" onclick="window.__xss=1" onfocus="window.__xss=1">ok</a>' +
            '<img src="x" onerror="window.__xss=(window.__xss||0)+1">' +
            '<a href="javascript:window.__xss=1">js</a>',
        });
        w.map.addLayer({
          id: "attribution-probe",
          type: "raster",
          source: "attribution-probe",
        });
        w.map.once("idle", () => {
          clearTimeout(timer);
          resolve();
        });
      }),
  );
  // onerror は画像の読み込みの失敗で非同期に呼ばれるので、少し待つ
  await page.waitForTimeout(500);

  expect(
    await page.evaluate(() => (window as unknown as TestWindow).__xss),
  ).toBeUndefined();

  const info = await page.evaluate(() => {
    for (const el of Array.from(
      document.querySelectorAll(".maplibregl-ctrl-bottom-right > div"),
    )) {
      const inner = el.shadowRoot?.querySelector(
        ".maplibregl-ctrl-attrib-inner",
      );
      if (inner) {
        return {
          links: Array.from(inner.querySelectorAll("a")).map((a) => ({
            text: a.textContent,
            href: a.getAttribute("href"),
            onclick: a.hasAttribute("onclick"),
            onfocus: a.hasAttribute("onfocus"),
          })),
          img: inner.querySelector("img")?.hasAttribute("onerror") ?? false,
        };
      }
    }
    return null;
  });
  // ページ自身の出典のリンクもあるので、足したリンクは文字で選ぶ
  expect(info?.links.find((a) => a.text === "ok")).toEqual({
    text: "ok",
    href: "https://example.com/",
    onclick: false,
    onfocus: false,
  });
  expect(info?.links.find((a) => a.text === "js")?.href).toBeNull();
  expect(info?.img).toBe(false);
  expect(errors.filter((e) => !e.includes("/none/"))).toEqual([]);
});
