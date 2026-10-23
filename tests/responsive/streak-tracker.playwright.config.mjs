import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "streak-tracker.spec.mjs", workers: 1,
  outputDir: "../../.cache/streak-tracker-results",
  use: { baseURL: "http://127.0.0.1:4318", browserName: "chromium", headless: true, hasTouch: true, screenshot: "only-on-failure" },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4318 --configLoader native",
    cwd: "../..", url: "http://127.0.0.1:4318", reuseExistingServer: true,
  },
});
