import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { defineConfig, type Plugin } from "vite";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

const WORKER_MODULE_ID = "virtual:maplibre-worker-source";

/**
 * maplibre-gl の worker を、依存する `maplibre-gl-shared.mjs` ごと自己完結する
 * 1 ファイルへ束ね、その中身を文字列として返す仮想モジュールを提供する。
 *
 * v6 の worker は `import.meta.url` からの相対解決を前提にしているが、UMD 出力では
 * `import.meta` が `{}` へ潰れて解決できない。UMD の利点である単一ファイル配布を
 * 保つため、別ファイルを配るのではなくバンドルへ埋め込む（`src/umd.ts` を参照）。
 */
function inlineMaplibreWorker(): Plugin {
  return {
    name: "geolonia:inline-maplibre-worker",
    resolveId(id) {
      return id === WORKER_MODULE_ID ? `\0${WORKER_MODULE_ID}` : null;
    },
    async load(id) {
      if (id !== `\0${WORKER_MODULE_ID}`) return null;

      const require = createRequire(import.meta.url);
      const entry = require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs");

      const result = await build({
        entryPoints: [entry],
        bundle: true,
        format: "esm",
        minify: true,
        write: false,
      });

      return `export default ${JSON.stringify(result.outputFiles[0].text)};`;
    },
  };
}

export default defineConfig({
  plugins: [inlineMaplibreWorker()],
  build: {
    lib: {
      entry: "src/umd.ts",
      name: "GeoloniaMapsCore",
      fileName: "maps-core",
      formats: ["umd"],
    },
    outDir: "dist/umd",
    sourcemap: true,
    minify: "esbuild",
  },
  define: {
    global: "globalThis",
    __PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
});
