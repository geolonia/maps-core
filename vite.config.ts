import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const pkg = JSON.parse(readFileSync("./package.json", "utf8"));

export default defineConfig({
  root: "example",
  server: {
    port: 5174,
  },
  define: {
    global: "globalThis",
    __PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
});
