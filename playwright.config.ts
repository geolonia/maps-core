import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  // Retry flaky tests on CI. Local runs keep retries off so debugging stays
  // honest. This is a stopgap; the real fix is replacing external style
  // dependencies with a local fixture (see #80).
  retries: process.env.CI ? 2 : 0,
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
