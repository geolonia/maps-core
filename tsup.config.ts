import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  // ESM-only へ移行したので、過去の CJS 成果物を残さない。
  clean: true,
  external: ["maplibre-gl"],
  outDir: "dist/npm",
  define: {
    global: "globalThis",
    __PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
});
