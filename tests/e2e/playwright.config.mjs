import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  outputDir: "../../output/test-results",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "../../output/e2e-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4310",
    headless: process.env.HEADLESS === "1",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/test-env/run-prod-like.mjs",
    cwd: "../..",
    url: "http://127.0.0.1:4310/api/healthz",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    // iPhone viewport/UA/touch on Chrome: Smart App Control blocks WebKit's
    // unsigned DLLs on this machine. Real Safari is covered by docs/testing/device-checklist.md.
    { name: "iphone", use: { ...devices["iPhone 13"], browserName: "chromium", channel: "chrome" } },
    // channel "chrome": the installed, signed Google Chrome. Windows Smart App
    // Control blocks Playwright's freshly downloaded unsigned chromium build.
    { name: "android", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
});
