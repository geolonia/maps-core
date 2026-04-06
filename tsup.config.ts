import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  external: ["maplibre-gl"],
  outDir: "dist/npm",
  define: {
    global: "globalThis",
  },
});
