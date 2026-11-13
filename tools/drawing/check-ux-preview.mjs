/* global window */
// Exercise real origin storage: setContent() cannot reproduce saved-progress
// failures because its about:blank document has no usable localStorage.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import JSZip from 'jszip';

const root = new URL('../../', import.meta.url);
const html = await readFile(new URL('docs/mockups/drawing/lesson-ux.html', root), 'utf8');
const manifest = JSON.parse(await readFile(new URL('tools/drawing/topic.json', root), 'utf8'));
const zip = await JSZip.loadAsync(await readFile(new URL(`public/decks/drawing_v${manifest.meta.version}.zip`, root)));
const cards = JSON.parse(await zip.file('topic.json').async('string')).cards.filter(card => card.lesson?.steps?.length);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let passed = 0;
try {
  for (const scenario of ['fresh', 'colour', 'done', 'unavailable-storage']) {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://drawing-preview.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
    if (scenario === 'unavailable-storage') await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
    });
    await page.goto('http://drawing-preview.test/');
    const indexes = cards.map(card => scenario === 'done' ? card.lesson.steps.length
      : scenario === 'colour' ? card.lesson.steps.findIndex(s => s.tool !== 'black')+2 : 0);
    if (scenario === 'colour' || scenario === 'done') {
      await page.evaluate(({ cards, indexes, scenario }) => {
        cards.forEach((card, i) => localStorage.setItem('drawing-ux:'+card.id,
          JSON.stringify({ index: indexes[i], revision: card.lesson.progressRevision ?? 0, phase: scenario === 'done' ? 'done' : 'copy' })));
      }, { cards, indexes, scenario });
      await page.reload();
    }
    await page.clock.install();
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      await page.locator('.card').nth(i).tap();
      assert.equal(await page.locator('.board > svg').count(), 1, scenario+': '+card.id);
      assert.equal(await page.evaluate(() => window.__drawingUx.get().index), indexes[i]);
      if (scenario === 'done') {
        assert.equal(await page.locator('h1').textContent(), 'Рисунок готов');
        await page.locator('.done-action').tap();
      } else {
        assert.equal(await page.locator('h1').textContent(), card.label);
        await page.locator('.next').tap();
        if (await page.evaluate(() => window.__drawingUx.get().phase === 'tool')) await page.locator('.next').tap();
        await page.clock.runFor(16000);
        assert.equal(await page.evaluate(() => window.__drawingUx.get().index), indexes[i]+1);
        // Return and reopen the cached lesson, as well as a fresh page load.
        await page.locator('.adult').focus(); await page.keyboard.press('Enter');
        await page.locator('#drawings').tap();
        await page.locator('.card').nth(i).tap();
        assert.equal(await page.evaluate(() => window.__drawingUx.get().index), indexes[i]+1);
        await page.locator('.adult').focus(); await page.keyboard.press('Enter');
        await page.locator('#drawings').tap();
      }
      passed++;
    }
    assert.deepEqual(errors, [], scenario);
    await context.close();
  }
  console.log(`PASS ${passed} lesson selections: all ${cards.length} drawings, fresh/coloured/completed progress, unavailable storage, next step and reopen`);
} finally {
  await browser.close();
}
