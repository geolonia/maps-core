import { defineConfig } from "vite";

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
  },
});
