import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: process.env.CI ? 2 : 1,
  use: {
    baseURL: "http://localhost:5174",
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader"],
    },
  },
  webServer: {
    command: "npx vite --config vite.config.ts",
    port: 5174,
    reuseExistingServer: !process.env.CI,
  },
});
