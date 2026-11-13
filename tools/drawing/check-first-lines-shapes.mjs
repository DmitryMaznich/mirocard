/* global window, document, requestAnimationFrame */
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { SHAPE_KINDS, shapeDefinition, partPoint, transformPoint, sheetCell } from '../../src/topics/renderers/drawing/firstLines/shapes.js';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const base = process.env.DRAWING_PREVIEW_URL || 'http://127.0.0.1:8080';
const failures = [];
const state = page => page.evaluate(() => window.previewStore.getState().activeSessionSnapshot?.sessionState);
async function settled(page) {
  await page.locator('.first-lines__board').waitFor(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function open(surface, viewport, extra = '') {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 600, isMobile: viewport.width < 600 });
  const page = await context.newPage(); page.on('pageerror', e => failures.push(e.message));
  await page.goto(`${base}/tools/drawing/first-lines-preview.html?fresh&surface=${surface}&exercises=${SHAPE_KINDS.join(',')}${extra}`);
  await settled(page); return { page, context };
}
async function draw(page, surface) {
  const snapshot = await state(page), task = snapshot.tasks[snapshot.taskIndex];
  const shape = shapeDefinition(task.exerciseKind), cell = sheetCell(task.sheetSlot);
  for (const [i, part] of shape.parts.entries()) {
    const count = part.type === 'line' ? 3 : 81;
    const points = Array.from({ length: count }, (_, n) => {
      const p = transformPoint(partPoint(part, n / (count - 1)), part.frame);
      return surface === 'sheet' ? { x: cell.tx + p.x * cell.scale, y: cell.ty + p.y * cell.scale } : p;
    });
    const coords = await page.locator('.first-lines__board').evaluate((svg, points) => points.map(p => {
      const point = svg.createSVGPoint(); point.x = p.x; point.y = p.y; const screen = point.matrixTransform(svg.getScreenCTM());
      return { x: screen.x, y: screen.y };
    }), points);
    await page.mouse.move(coords[0].x, coords[0].y); await page.mouse.down();
    for (const p of coords.slice(1)) await page.mouse.move(p.x, p.y);
    await page.mouse.up();
    if (i < shape.parts.length - 1) expect((await state(page)).status).toBe('task_active');
  }
  try { await expect.poll(async () => (await state(page)).status).toBe('answer_correct'); }
  catch (error) {
    console.error('Failed shape', surface, task, await page.locator('.first-lines__board').getAttribute('viewBox'), { taskIndex: (await state(page)).taskIndex, incorrectCount: (await state(page)).incorrectCount });
    await page.screenshot({ path: 'output/first-lines/shape-failure.png' }); throw error;
  }
  expect((await state(page)).incorrectCount).toBe(0);
}
try {
  await mkdir('output/first-lines', { recursive: true });
  for (const surface of ['single', 'sheet']) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1180, height: 1000 }]) {
      const { page, context } = await open(surface, viewport);
      for (let i = 0; i < 15; i++) {
        if (i === 3 && surface === 'sheet') {
          expect(await page.locator('.first-lines__sheet [data-shape]').count()).toBe(3);
          await page.reload(); await settled(page);
          expect(await page.locator('.first-lines__sheet [data-shape]').count()).toBe(3);
          if (viewport.width === 390) {
            await page.getByRole('button', { name: 'Весь лист', exact: true }).click();
            await expect(page.locator('.first-lines__board')).toHaveAttribute('viewBox', '0 0 1000 1000');
            await page.screenshot({ path: 'output/first-lines/sheet-overview.png' });
            await page.getByRole('button', { name: 'К заданию', exact: true }).click();
          }
        }
        if ([2,4,5,6].includes(i)) await page.screenshot({ path: `output/first-lines/${surface}-${viewport.width}-${SHAPE_KINDS[i]}.png` });
        await draw(page, surface);
        if ((i + 1) % 5 === 0) {
          await expect(page.locator('.reward-modal-overlay')).toBeVisible();
          expect((await state(page)).rewardEarnedCount).toBe((i + 1) / 5);
          await page.locator('.reward-modal__btn--continue').click();
        }
        if (i < 14) {
          await page.locator('.first-lines__footer button').click();
          await expect.poll(async () => (await state(page)).taskIndex).toBe(i + 1);
          const pause = page.locator('.first-lines__pause button'); if (await pause.isVisible()) await pause.click();
          if (surface === 'sheet' && (i + 1) % 4 === 0) expect(await page.locator('.first-lines__sheet [data-shape]').count()).toBe(0);
        }
      }
      await context.close();
    }
  }
  // Small phone + rotation keep the current figure visible, and overview cannot draw.
  const phone = await open('sheet', { width: 320, height: 568 }, '&noVideo');
  await phone.page.getByRole('button', { name: 'Весь лист', exact: true }).click();
  await phone.page.locator('.first-lines__board').dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'pen', button: 0, clientX: 70, clientY: 150 });
  expect(await phone.page.locator('.first-lines__board polyline').count()).toBe(0);
  await phone.page.getByRole('button', { name: 'К заданию', exact: true }).click();
  await phone.page.setViewportSize({ width: 568, height: 320 }); await settled(phone.page);
  await draw(phone.page, 'sheet'); await phone.context.close();
  expect(failures).toEqual([]);
  console.log('Shapes: seven forms, separate cards and sheets on phone/tablet, real ZIP, one credit per figure, standard prizes, preserved work/reload, page transitions, overview and rotation passed.');
} finally { await browser.close(); }
