import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: ["statistics.spec.mjs", "home-statistics.spec.mjs"], workers: 1,
  globalSetup: "./statistics.setup.mjs",
  outputDir: "../../.cache/statistics-test-results",
  use: { browserName: "chromium", channel: process.env.RESPONSIVE_BROWSER || "chrome", headless: true, launchOptions: { args: ["--allow-file-access-from-files"] } },
});
