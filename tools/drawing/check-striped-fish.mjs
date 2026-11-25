/* global document */
// Exercise the real ZIP renderer, including its completion and cancellation UX.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.DRAWING_PREVIEW_URL ?? 'http://localhost:8081/tools/drawing/preview.html?lesson=striped_fish');
  const open = async () => {
    await page.getByRole('button', { name: 'Полосатая рыбка', exact: true }).tap();
    await page.getByRole('button', { name: 'Начать рисовать', exact: true }).tap();
  };
  await open(); await page.clock.install();
  await page.evaluate(() => { document.querySelector('.preview-header').style.display = 'none'; document.getElementById('root').style.height = '100dvh'; });
  const next = () => page.getByRole('button', { name: 'Дальше', exact: true }).tap();
  const parts = page.locator('[data-finish-part]');
  const assertRestored = async () => {
    assert.equal(await page.locator('[data-finale]').count(), 0);
    assert((await parts.evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')))).every(value => value === null));
  };
  for (let i = 1; i <= 7; i++) {
    await next(); await page.clock.runFor(16000);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('drawing-progress:local:striped_fish')).index), i);
    await assertRestored();
  }
  assert.equal(await page.locator('[data-finish-part=stripes]').count(), 13);
  assert.equal(await page.locator('[data-finish-part=head]').count(), 3, 'Head fill, contour and eye move together');
  assert.equal(await page.locator('[data-finish-part=tail]').count(), 3);
  await page.screenshot({ path: '/workspace/striped-fish-ready.png' });
  await page.locator('.drawing-show').tap(); await page.clock.runFor(16000); await assertRestored();
  await next(); await page.clock.runFor(900);
  assert.equal(await page.locator('[data-finale=striped-fish]').count(), 1);
  const bars = await page.locator('[data-finish-part=stripes]').evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')));
  assert.equal(new Set(bars).size, 13, 'The ripple has a different phase on each stripe');
  const heads = await page.locator('[data-finish-part=head]').evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')));
  const tails = await page.locator('[data-finish-part=tail]').evaluateAll(nodes => nodes.map(node => node.getAttribute('transform')));
  assert.equal(new Set(heads).size, 1); assert.equal(new Set(tails).size, 1);
  await page.screenshot({ path: '/workspace/striped-fish-alive.png' });
  await page.clock.runFor(6500); await assertRestored();
  assert.equal(await page.locator('.drawing-top h2').textContent(), 'Рисунок готов');
  // Reopening starts a fresh paper lesson, even when completion was recorded.
  await page.getByRole('button', { name: 'Другой рисунок', exact: true }).tap(); await open();
  await page.clock.runFor(1200); await assertRestored();
  assert.equal(await parts.count(), 0);
  for (let i = 0; i < 7; i++) { await next(); await page.clock.runFor(16000); }
  await next(); await page.clock.runFor(7400); await assertRestored();
  const replayFinish = async () => {
    await page.getByRole('button', { name: 'Назад на шаг', exact: true }).tap();
    await next(); await page.clock.runFor(16000); await next(); await page.clock.runFor(700);
  };
  await replayFinish(); assert.equal(await page.locator('[data-finale]').count(), 1);
  await page.locator('.drawing-adult').focus(); await page.keyboard.press('Enter'); await assertRestored();
  await page.getByRole('button', { name: 'Закрыть настройки', exact: true }).tap();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await replayFinish(); await assertRestored();
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await replayFinish();
  await page.getByRole('button', { name: 'Другой рисунок', exact: true }).tap();
  assert.equal(await page.locator('[data-finale]').count(), 0); await page.clock.runFor(8000);
  assert.deepEqual(errors, []);
  console.log('PASS striped fish: 13 stripes, progressive 7 steps, explicit finite finale, grouped part motion, repeat, fresh reopen, settings, reduced motion, leave during swim');
} finally { await browser.close(); }
