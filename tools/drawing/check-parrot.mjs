/* global document, window */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.DRAWING_PREVIEW_URL ?? 'http://localhost:8081/tools/drawing/preview.html?lesson=parrot');
  await page.locator('.drawing-card').filter({ hasText: 'Попугай' }).tap();
  await page.clock.install();
  await page.evaluate(() => {
    document.querySelector('.preview-header').style.display = 'none'; document.getElementById('root').style.height = '100dvh';
    document.documentElement.classList.add('app-ios-standalone');
    document.documentElement.style.setProperty('--app-safe-top', '59px');
    document.documentElement.style.setProperty('--app-safe-bottom', '34px');
  });
  const count = await page.evaluate(() => window.lesson.steps.length);
  const index = () => page.evaluate(() => JSON.parse(localStorage.getItem('drawing-progress:local:parrot'))?.index ?? 0);
  const next = async () => {
    await page.locator('.drawing-next').tap();
    if (await page.locator('[role=status]').textContent() === 'Подготовьте следующий карандаш') {
      await page.locator('.drawing-next').tap(); return 1;
    }
    return 0;
  };
  let switches = 0;
  for (let i = 1; i <= count; i++) {
    switches += await next();
    if (i === 1 || i === 20) {
      await page.clock.runFor(120);
      const detail = await page.evaluate(() => {
        const paths = [...document.querySelectorAll(iAmColour() ? '[data-layer=colors] [data-region]:last-child path[style]' : '[data-layer=drawing] path:last-child')];
        function iAmColour() { return !!document.querySelector('[data-layer=colors] [data-region]'); }
        return paths.some(p => p.style.strokeDasharray && p.style.strokeDashoffset !== '0');
      });
      assert(detail, 'Contour/colour must reveal progressively');
    }
    await page.clock.runFor(16000); assert.equal(await index(), i, 'Step '+i);
    if (i === 19) await page.screenshot({ path: '/workspace/parrot-outline.png' });
  }
  assert.equal(switches, 6);
  await page.screenshot({ path: '/workspace/parrot-complete-mobile.png' });
  await page.locator('.drawing-repeat').tap(); await page.clock.runFor(16000); assert.equal(await index(), count);
  await page.reload(); await page.locator('.drawing-card').filter({ hasText: 'Попугай' }).tap();
  assert.equal(await index(), count, 'Saved progress resumes');
  await page.locator('.drawing-next').tap();
  assert.equal(await page.locator('.drawing-top h2').textContent(), 'Рисунок готов');
  await page.locator('.drawing-board svg').screenshot({ path: '/workspace/parrot-finished.png' });
  await page.getByRole('button', { name: 'Рисунки', exact: true }).tap();
  assert.equal(await page.locator('.drawing-card').count(), 5);
  const boxes = await page.locator('.drawing-card').evaluateAll(nodes => nodes.map(n => { const r=n.getBoundingClientRect(); return { left:r.left, right:r.right, width:r.width }; }));
  assert(boxes.every(b => b.left >= 0 && b.right <= 390 && b.width > 100));
  assert.deepEqual(errors, []);
  console.log('PASS parrot:', { steps: count, pencilChanges: switches, checks: 'progressive outline/colour, all steps, repeat, saved resume, finish, five-card navigation, mobile safe areas' });
} finally { await browser.close(); }
