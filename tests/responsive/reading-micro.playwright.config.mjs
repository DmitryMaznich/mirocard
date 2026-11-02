import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
export default defineConfig({
  testDir: ".", testMatch: "reading-micro.spec.mjs", workers: 1,
  use: { browserName: "chromium", channel: process.env.RESPONSIVE_BROWSER || "chromium" },
  webServer: {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    command: "node tests/responsive/reading-micro.serve.mjs",
    url: "http://127.0.0.1:8099/tests/responsive/reading-micro.html", reuseExistingServer: true,
  },
});
