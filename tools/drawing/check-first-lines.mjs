/* global window, HTMLMediaElement, requestAnimationFrame, document */
// Runs against `npm run dev`. Tests the installed ZIP in the actual SessionScreen.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const base = process.env.DRAWING_PREVIEW_URL || 'http://127.0.0.1:8080';
await mkdir('output/first-lines', { recursive: true });
const failures = [];
async function open(query = '', viewport = { width: 1180, height: 900 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', error => failures.push(error.message));
  await page.addInitScript(() => {
    window.feedbackCalls = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (!this.muted) window.feedbackCalls.push(this.src);
      return play.apply(this, args);
    };
  });
  await page.goto(`${base}/tools/drawing/first-lines-preview.html?fresh&${query}`);
  await page.locator('.first-lines__board').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return { page, context };
}
const state = page => page.evaluate(() => window.previewStore.getState().activeSessionSnapshot?.sessionState);
async function coords(page, x, y = 500) {
  const r = await page.locator('.first-lines__board').boundingBox(), size = Math.min(r.width, r.height);
  return { x: r.x + (r.width - size) / 2 + x * size / 1000, y: r.y + (r.height - size) / 2 + y * size / 1000 };
}
async function stroke(page, points) {
  const start = await coords(page, ...points[0]);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  for (const p of points.slice(1)) { const next = await coords(page, ...p); await page.mouse.move(next.x, next.y, { steps: 5 }); }
  await page.mouse.up();
}
async function complete(page) {
  await stroke(page, [[320, 500], [680, 500]]);
  await expect(page.locator('.first-lines__footer button')).toBeVisible();
  await expect.poll(async () => (await state(page)).status).toBe('answer_correct');
}
async function next(page) {
  const before = (await state(page)).taskIndex;
  await page.locator('.first-lines__footer button').click();
  await expect.poll(async () => (await state(page))?.taskIndex).toBe(before + 1);
  const pause = page.locator('.first-lines__pause button');
  if (await pause.isVisible()) await pause.click();
}

try {
  // Normal prize in the middle and on the last card, including offline use of the installed renderer.
  const { page, context } = await open();
  await page.screenshot({ path: 'output/first-lines/start.png' });
  expect((await state(page)).tasks).toHaveLength(15);
  for (let i = 0; i < 15; i++) {
    await complete(page);
    if ((i + 1) % 5 === 0) {
      const modal = page.locator('.reward-modal-overlay');
      await expect(modal).toBeVisible();
      expect((await state(page)).rewardEarnedCount).toBe((i + 1) / 5);
      const before = await page.locator('polyline').count();
      // Even a stray pointer targeted under the modal cannot add strokes.
      await page.locator('.first-lines__board').dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'pen', button: 0, clientX: 400, clientY: 400 });
      expect(await page.locator('polyline').count()).toBe(before);
      if (i === 4) await page.screenshot({ path: 'output/first-lines/standard-prize.png' });
      await page.locator('.reward-modal__btn--continue').click();
    }
    if (i < 14) await next(page);
  }
  await page.locator('.first-lines__footer button').click();
  await expect.poll(() => page.evaluate(() => window.previewStore.getState().screen)).toBe('summary');
  expect(await page.evaluate(() => window.previewStore.getState().sessions.at(-1).correctCount)).toBe(15);
  await context.close();

  // Failed attempt is not made rewardable by a reload, correction, repeated exit or a palm.
  const failed = await open('noVideo');
  await complete(failed.page); await next(failed.page);
  await stroke(failed.page, [[320, 500], [450, 500], [450, 700]]);
  await expect.poll(async () => (await state(failed.page)).incorrectCount).toBe(1);
  expect((await state(failed.page)).streakCount).toBe(0);
  expect(await failed.page.evaluate(() => window.feedbackCalls.filter(src => src.endsWith('incorrect.wav')).length)).toBe(1);
  await failed.page.screenshot({ path: 'output/first-lines/return.png' });
  const trail = await failed.page.locator('polyline').count();
  await failed.page.reload(); await failed.page.locator('.first-lines__board').waitFor();
  await failed.page.evaluate(() => document.fonts.ready);
  await failed.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await failed.page.locator('polyline').count()).toBe(trail);
  expect((await state(failed.page)).rewardAttemptBlocked).toBe(true);
  await failed.context.setOffline(true);
  await stroke(failed.page, [[450, 540], [680, 500]]);
  await expect.poll(async () => (await state(failed.page)).status).toBe('answer_correct');
  expect((await state(failed.page)).streakCount).toBe(0);
  await next(failed.page); await complete(failed.page);
  expect((await state(failed.page)).streakCount).toBe(1);
  await failed.context.close();

  // Portrait tablet with real pen events through CDP; touch remains ignored in pen mode.
  const tablet = await open('noVideo&perStar=3', { width: 820, height: 1180 });
  expect((await state(tablet.page)).answersPerStar).toBe(3);
  await tablet.page.locator('.first-lines__board').dispatchEvent('pointerdown', { pointerId: 4, pointerType: 'touch', button: 0, clientX: 400, clientY: 400 });
  expect(await tablet.page.locator('polyline').count()).toBe(0);
  const cdp = await tablet.context.newCDPSession(tablet.page);
  const from = await coords(tablet.page, 320), to = await coords(tablet.page, 680);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...from, button: 'left', buttons: 1, pointerType: 'pen', force: 0 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...to, button: 'left', buttons: 1, pointerType: 'pen', force: 0 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...to, button: 'left', buttons: 0, pointerType: 'pen' });
  await expect.poll(async () => (await state(tablet.page)).correctCount).toBe(1);
  await tablet.page.screenshot({ path: 'output/first-lines/tablet.png' });
  await tablet.context.close();

  // The demonstration draws a real sample behind its tip; both use the same timing.
  // Width chosen before the session controls the visible track and the actual boundary check.
  for (const [width, size, mistakes] of [['wide', 140, 0], ['normal', 100, 0], ['narrow', 60, 1]]) {
    const sample = await open(`noVideo&width=${width}`);
    await sample.page.clock.install();
    expect(await sample.page.locator('.first-lines__track').evaluate(node => parseFloat(window.getComputedStyle(node).strokeWidth))).toBe(size);
    await sample.page.getByRole('button', { name: 'Показать движение' }).click();
    await sample.page.clock.runFor(750);
    const animation = await sample.page.locator('.first-lines__demo').evaluate(group => {
      return {
        offset: parseFloat(window.getComputedStyle(group.querySelector('path')).strokeDashoffset),
        tip: Number(group.querySelector('circle').getAttribute('cx')) - 320,
      };
    });
    expect(animation.offset).toBeGreaterThan(0); expect(animation.offset).toBeLessThan(1);
    expect(Math.abs(animation.tip - 360 * (1 - animation.offset))).toBeLessThan(.5);
    if (width === 'wide') await sample.page.screenshot({ path: 'output/first-lines/demo-line.png' });
    await stroke(sample.page, [[320, 500], [680, 500]]);
    expect((await state(sample.page)).correctCount).toBe(0);
    await sample.page.clock.runFor(2400);
    await expect(sample.page.locator('.first-lines__demo')).toHaveCount(0);
    await stroke(sample.page, [[320, 500], [450, 500], [450, 560], [520, 560], [680, 500]]);
    expect((await state(sample.page)).incorrectCount).toBe(mistakes);
    expect((await state(sample.page)).correctCount).toBe(mistakes ? 0 : 1);
    await sample.context.close();
  }

  // Automatic pacing must not finish the session underneath its final video prize.
  const auto = await open('auto');
  await auto.page.clock.install();
  for (let i = 0; i < 15; i++) {
    await complete(auto.page);
    await auto.page.clock.runFor(1200);
    if ((i + 1) % 5 === 0) {
      await expect(auto.page.locator('.reward-modal-overlay')).toBeVisible();
      expect((await state(auto.page)).taskIndex).toBe(i);
      expect(await auto.page.evaluate(() => window.previewStore.getState().screen)).toBe('session');
      await auto.page.locator('.reward-modal__btn--continue').click();
    }
    if (i < 14) {
      await expect.poll(async () => (await state(auto.page)).taskIndex).toBe(i + 1);
      const pause = auto.page.locator('.first-lines__pause button');
      if (await pause.isVisible()) await pause.click();
    }
  }
  await expect.poll(() => auto.page.evaluate(() => window.previewStore.getState().screen)).toBe('summary');
  await auto.context.close();
  expect(failures).toEqual([]);
  console.log('First Lines: real ZIP, 15 cards, standard prizes, reload, offline correction, tablet pen/palm, line demonstration and all three widths passed.');
} finally { await browser.close(); }
