/* global window */
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const html = await readFile(new URL('../../docs/mockups/drawing/lesson-ux.html', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setContent(html); await page.locator('.card').nth(3).tap();
  await page.clock.install();
  // Draw from scratch: restoring all steps alone misses missing part tags in
  // the player's normal next() path.
  for (let i = 1; i <= 45; i++) {
    await page.locator('.next').tap();
    if (await page.evaluate(() => window.__drawingUx.get().phase === 'tool')) await page.locator('.next').tap();
    await page.clock.runFor(16000);
    assert.equal(await page.evaluate(() => window.__drawingUx.get().index), i);
  }
  assert.equal(await page.locator('[data-finale]').count(), 0, 'Wait for the child to finish copying');
  assert.equal(await page.locator('[data-finish-part]').count(), 5, 'Outline and colouring must move together');
  await page.locator('.next').tap(); await page.clock.runFor(2300);
  assert.equal(await page.locator('[data-finale]').count(), 1);
  assert.equal(await page.locator('[data-finale-bubble]').count(), 3);
  assert.notEqual(await page.locator('[data-finish-part=pupil]').getAttribute('transform'), null);
  assert.equal(await page.locator('[data-finish-part=upper-lip]').first().getAttribute('transform'),
    await page.locator('[data-finish-part=upper-lip]').last().getAttribute('transform'));
  await page.clock.runFor(3000);
  assert.equal(await page.locator('[data-finale]').count(), 0);
  for (const part of await page.locator('[data-finish-part]').all()) assert.equal(await part.getAttribute('transform'), null);
  assert.equal(await page.evaluate(() => window.__drawingUx.get().index), 45);
  assert.equal(await page.locator('.done-action').count(), 1);
  // Returning to a completed lesson must not trigger another celebration.
  await page.locator('.done-action').tap(); await page.locator('.card').nth(3).tap();
  assert.equal(await page.locator('[data-finale]').count(), 0);
  await page.evaluate(() => window.__drawingUx.seek(45));
  await page.locator('.next').tap(); await page.clock.runFor(1400);
  await page.evaluate(() => window.__drawingUx.openSettings());
  assert.equal(await page.locator('[data-finale]').count(), 0, 'Adult settings stop the finale');
  await page.locator('.dialog-close').tap();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.__drawingUx.seek(45)); await page.locator('.next').tap();
  assert.equal(await page.locator('[data-finale]').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS 45 steps from scratch; explicit finite finale, gaze, matching lip strokes/fills, 3 bubbles, settings cancellation and reduced motion');
} finally { await browser.close(); }
