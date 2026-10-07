import { defineConfig } from '@playwright/test';
export default defineConfig({
  globalSetup: './setup.mjs',
  testDir: '.', testMatch: 'word-formation.spec.mjs', workers: 1,
  use: { browserName: 'chromium', channel: process.env.RESPONSIVE_BROWSER || 'chromium', launchOptions: { args: ['--allow-file-access-from-files'] } },
});

