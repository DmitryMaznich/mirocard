import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:".", testMatch:"games.spec.mjs", workers:1,
  outputDir:"../../.cache/games-results",
  use:{baseURL:"http://127.0.0.1:4321",browserName:"chromium",headless:true,hasTouch:true,screenshot:"only-on-failure"},
  webServer:{command:"node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4321 --configLoader native",cwd:"../..",url:"http://127.0.0.1:4321",reuseExistingServer:true},
});
