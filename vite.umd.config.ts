import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
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
