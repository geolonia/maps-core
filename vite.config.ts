import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

export default defineConfig({
  root: "example",
  // maplibre-gl v6 は worker を `import.meta.url` 基準の実URLとして読みます。
  // 事前バンドルすると worker の兄弟ファイルが `.vite/deps/` に来ないため除外します。
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  server: {
    port: 5174,
  },
  define: {
    global: "globalThis",
    __PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
});
