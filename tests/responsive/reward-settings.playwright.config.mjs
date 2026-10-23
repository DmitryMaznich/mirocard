import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "reward-settings.spec.mjs", workers: 1,
  outputDir: "../../.cache/reward-settings-results",
  use: { baseURL: "http://127.0.0.1:4319", browserName: "chromium", headless: true, hasTouch: true, screenshot: "only-on-failure" },
  webServer: { command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4319 --configLoader native", cwd: "../..", url: "http://127.0.0.1:4319", reuseExistingServer: true },
});
