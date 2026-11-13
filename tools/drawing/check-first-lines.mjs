/* global window, HTMLMediaElement, requestAnimationFrame, document */
// Runs against `npm run dev`. Tests the installed ZIP in the actual SessionScreen.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { shapeDefinition, transformPoint } from '../../src/topics/renderers/drawing/firstLines/shapes.js';
import { SCREENSHOT_ZIGZAG } from '../../src/topics/renderers/drawing/firstLines/testPaths.js';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const base = process.env.DRAWING_PREVIEW_URL || 'http://127.0.0.1:8080';
await mkdir('output/first-lines', { recursive: true });
const failures = [];
async function open(query = '', viewport = { width: 1180, height: 900 }) {
  const mobile = Math.min(viewport.width, viewport.height) < 600;
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile });
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
  const options = new URLSearchParams(query); if (!options.has('exercises')) options.set('exercises','short_line');
  await page.goto(`${base}/tools/drawing/first-lines-preview.html?fresh&${options}`);
  await page.locator('.first-lines__board').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return { page, context };
}
const state = page => page.evaluate(() => window.previewStore.getState().activeSessionSnapshot?.sessionState);
async function coords(page, x, y = 500) {
  const session = await state(page), task = session.tasks[session.taskIndex];
  const world = transformPoint({ x, y }, shapeDefinition(task.exerciseKind,task.variant).parts[0].frame);
  return page.locator('.first-lines__board').evaluate((svg, p) => {
    const point = svg.createSVGPoint(); point.x = p.x; point.y = p.y;
    const screen = point.matrixTransform(svg.getScreenCTM());
    return { x: screen.x, y: screen.y };
  }, world);
}
async function anchor(page) {
  const task = (await state(page)).tasks[(await state(page)).taskIndex];
  return page.evaluate(id => {
    const key = Object.keys(localStorage).find(k => k.startsWith('drawing-first-lines:') && k.endsWith(':' + id));
    const saved = JSON.parse(localStorage.getItem(key)).attempt.parts[0].anchor; return [saved.x,saved.y];
  },task.id);
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
  const task = (await state(page)).tasks[before + 1];
  await expect(page.locator('.first-lines')).toHaveAttribute('data-task-id',task.id);
  if (task.breakBefore) await expect(page.locator('.first-lines__pause button')).toBeVisible();
  const pause = page.locator('.first-lines__pause button');
  if (await pause.isVisible()) await pause.click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
  await stroke(failed.page, [await anchor(failed.page), [680, 500]]);
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

  // Regression for the owner's screenshot: a zigzag inside the road is not a
  // completed straight line, including on a phone. Correction keeps the raw trail.
  for (const width of ['wide', 'normal', 'narrow']) {
    const crooked = await open(`noVideo&touch&width=${width}`, { width: 390, height: 844 });
    const screen = crooked.page;
    await stroke(screen, SCREENSHOT_ZIGZAG);
    await expect.poll(async () => (await state(screen)).incorrectCount).toBe(1);
    expect((await state(screen)).correctCount).toBe(0);
    expect((await state(screen)).status).toBe('task_active');
    expect((await state(screen)).rewardAttemptBlocked).toBe(true);
    await expect(screen.locator('.first-lines__footer button')).toHaveCount(0);
    await expect(screen.locator('.first-lines__cue')).toContainText('Повтори от точки');
    if (width === 'normal') await screen.screenshot({ path: 'output/first-lines/zigzag-rejected.png' });
    const failedTrail = await screen.locator('.first-lines__ink--error').getAttribute('points');
    if (width === 'normal') {
      await screen.reload(); await screen.locator('.first-lines__board').waitFor();
      await screen.evaluate(() => document.fonts.ready);
      await screen.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      expect((await state(screen)).rewardAttemptBlocked).toBe(true);
      await expect(screen.locator('.first-lines__footer button')).toHaveCount(0);
    }
    await complete(screen);
    expect((await state(screen)).streakCount).toBe(0);
    expect(await screen.locator('.first-lines__ink--error').getAttribute('points')).toBe(failedTrail);
    await next(screen); await complete(screen);
    expect((await state(screen)).streakCount).toBe(1);
    await crooked.context.close();
  }

  // Phones use a closer view of the same geometry, with no minimum-size blocker.
  // Coordinates come from the browser's SVG matrix independently of the renderer mapping.
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 568, height: 320 }, { width: 844, height: 390 }]) {
    const phone = await open('noVideo&touch', viewport);
    const screen = phone.page;
    await expect(screen.locator('.first-lines__size')).toHaveCount(0);
    const start = await coords(screen, 320), end = await coords(screen, 680);
    expect(end.x - start.x).toBeGreaterThan(70);
    expect(start.x).toBeGreaterThan(0); expect(end.x).toBeLessThan(viewport.width);
    const touch = await phone.context.newCDPSession(screen);
    const send = async (type, x, y = 500) => touch.send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' ? [] : [{ ...await coords(screen, x, y), radiusX: 4, radiusY: 4, force: .1 }],
    });
    await screen.screenshot({ path: `output/first-lines/phone-${viewport.width}.png` });
    await send('touchStart', 320); await send('touchMove', 680); await send('touchEnd');
    await expect.poll(async () => (await state(screen)).correctCount).toBe(1);
    expect((await state(screen)).incorrectCount).toBe(0);

    if (viewport.width === 390) {
      await next(screen);
      await send('touchStart', 320); await send('touchMove', 450);
      const work = await screen.locator('polyline').first().getAttribute('points');
      await screen.setViewportSize({ width: 844, height: 390 });
      await screen.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await send('touchEnd');
      expect(await screen.locator('polyline').first().getAttribute('points')).toBe(work);
      expect((await state(screen)).incorrectCount).toBe(0);
      await send('touchStart', 450); await send('touchMove', 680); await send('touchEnd');
      await expect.poll(async () => (await state(screen)).correctCount).toBe(2);
      await next(screen);
      await send('touchStart', 320); await send('touchMove', 450); await send('touchMove', 450, 650); await send('touchEnd');
      await expect.poll(async () => (await state(screen)).incorrectCount).toBe(1);
      await send('touchStart', ...await anchor(screen)); await send('touchMove', 680); await send('touchEnd');
      await expect.poll(async () => (await state(screen)).correctCount).toBe(3);
      expect((await state(screen)).streakCount).toBe(1);
    }
    await phone.context.close();
  }

  // The demonstration draws a real sample behind its tip; both use the same timing.
  // Width chosen before the session controls the visible track and the actual boundary check.
  for (const [width, size, mistakes] of [['wide', 140, 0], ['normal', 100, 0], ['narrow', 60, 1]]) {
    const sample = await open(`noVideo&touch&width=${width}`);
    await sample.page.clock.install();
    expect(await sample.page.locator('.first-lines__track').evaluate(node => { const a=node.getScreenCTM(), b=node.ownerSVGElement.getScreenCTM(); return parseFloat(window.getComputedStyle(node).strokeWidth)*Math.hypot(a.a,a.b)/Math.hypot(b.a,b.b); })).toBeCloseTo(size, 2);
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
    await sample.page.clock.runFor(2400);
    await expect(sample.page.locator('.first-lines__demo')).toHaveCount(0);
    const snapshot = await state(sample.page), scale = snapshot.tasks[snapshot.taskIndex].variant.scale;
    await stroke(sample.page, [[320, 500], [450, 500], [450, 500 + 60 / scale], [520, 500 + 60 / scale], [680, 500]]);
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
      const task=(await state(auto.page)).tasks[i+1];
      await expect(auto.page.locator('.first-lines')).toHaveAttribute('data-task-id',task.id);
      if(task.breakBefore) await expect(auto.page.locator('.first-lines__pause button')).toBeVisible();
      const pause = auto.page.locator('.first-lines__pause button');
      if (await pause.isVisible()) await pause.click();
    }
  }
  await expect.poll(() => auto.page.evaluate(() => window.previewStore.getState().screen)).toBe('summary');
  await auto.context.close();
  expect(failures).toEqual([]);
  console.log('First Lines: real ZIP, rewards, reload, phones in both orientations, touch correction/rotation, tablet pen/palm, demonstration and all widths passed.');
} finally { await browser.close(); }
