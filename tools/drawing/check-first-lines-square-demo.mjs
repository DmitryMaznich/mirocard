/* global window, document, requestAnimationFrame */
import { chromium, expect } from '@playwright/test';
import { shapeDefinition, partPoint, transformPoint } from '../../src/topics/renderers/drawing/firstLines/shapes.js';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const base = process.env.DRAWING_PREVIEW_URL || 'http://127.0.0.1:8080';
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/tools/drawing/first-lines-preview.html?fresh&exercises=square&noVideo`);
  await page.locator('.first-lines__board').waitFor(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.clock.install();
  await page.getByRole('button', { name: 'Показать движение' }).click();
  await page.clock.runFor(1100);
  await expect(page.locator('.first-lines__demo-lift')).toHaveCount(1);
  await expect(page.locator('.first-lines__cue')).toContainText('Подними стилус');
  const offset = await page.locator('[data-part="0"] .first-lines__demo-line').getAttribute('stroke-dashoffset');
  expect(Number(offset)).toBe(0);
  await page.screenshot({ path: 'output/first-lines/square-lift-demo.png' });
  await page.clock.runFor(600);
  await expect(page.locator('.first-lines__demo-lift')).toHaveCount(0);
  const second = Number(await page.locator('[data-part="1"] .first-lines__demo-line').getAttribute('stroke-dashoffset'));
  expect(second).toBeGreaterThan(0); expect(second).toBeLessThan(1);
  await page.clock.runFor(4500);
  await expect(page.locator('.first-lines__demo')).toHaveCount(0);
  expect(await page.locator('.first-lines__ink').count()).toBe(0);
  const task = await page.evaluate(() => window.previewStore.getState().activeSessionSnapshot.sessionState.tasks[0]);
  for (const [i, part] of shapeDefinition('square', task.variant).parts.entries()) {
    const points = [partPoint(part, 0), partPoint(part, 1)].map(p => transformPoint(p, part.frame));
    const screen = await page.locator('.first-lines__board').evaluate((svg, points) => points.map(p => {
      const point = svg.createSVGPoint(); point.x = p.x; point.y = p.y; const xy = point.matrixTransform(svg.getScreenCTM()); return { x: xy.x, y: xy.y };
    }), points);
    await page.mouse.move(screen[0].x, screen[0].y); await page.mouse.down(); await page.mouse.move(screen[1].x, screen[1].y, { steps: 8 });
    await expect(page.locator('.first-lines__cue')).toContainText('Подними стилус');
    await page.mouse.up();
    const snapshot = await page.evaluate(() => window.previewStore.getState().activeSessionSnapshot.sessionState);
    expect(snapshot.incorrectCount).toBe(0); expect(snapshot.correctCount).toBe(i === 3 ? 1 : 0);
  }
  expect(errors).toEqual([]);
  console.log('Square: animated corner pauses and lift cues, no credit for demonstration, four sides/one credit, no errors passed.');
} finally { await browser.close(); }
