/* global document, window */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const cardCount=JSON.parse(await readFile(new URL('./topic.json',import.meta.url),'utf8')).cards.filter(card => card.lessonFile).length;
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('drawing-progress:local:parrot')) localStorage.setItem('drawing-progress:local:parrot', JSON.stringify({ index: 41, revision: 1, phase: 'done' }));
    localStorage.setItem('drawing-progress:local:goldfish', JSON.stringify({ index: 44, phase: 'copy' }));
  });
  await page.goto(process.env.DRAWING_PREVIEW_URL ?? 'http://localhost:8081/tools/drawing/preview.html?lesson=parrot');
  const parrotCard = page.locator('.drawing-card').filter({ hasText: 'Попугай' });
  await parrotCard.waitFor();
  assert.equal(await parrotCard.locator('small').textContent(), '', 'Old geometry progress must not resume');
  assert.equal(await page.locator('.drawing-card').filter({ hasText: 'Золотая рыбка' }).locator('small').textContent(), 'Продолжить');
  await parrotCard.tap();
  assert.equal(await page.locator('.drawing-repeat').isDisabled(), true);
  await page.clock.install();
  await page.evaluate(() => {
    document.querySelector('.preview-header').style.display = 'none'; document.getElementById('root').style.height = '100dvh';
    document.documentElement.classList.add('app-ios-standalone');
    document.documentElement.style.setProperty('--app-safe-top', '59px');
    document.documentElement.style.setProperty('--app-safe-bottom', '34px');
  });
  const count = await page.evaluate(() => window.lesson.steps.length);
  const outlineEnd = await page.evaluate(() => window.lesson.steps.findIndex(step => step.tool !== 'black'));
  const leavesIndex = await page.evaluate(() => window.lesson.steps.findIndex(step => step.title === 'Листочки на веточке')+1);
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
    if (i === leavesIndex) {
      const inks = await page.locator('[data-layer=drawing] > path').evaluateAll(paths => paths.slice(-4).map(p => p.style.stroke));
      assert(inks.every(ink => ink === 'rgb(117, 216, 22)'), 'Leaves must use the green pencil');
    }
    if (i === outlineEnd) await page.screenshot({ path: '/workspace/parrot-outline.png' });
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
  assert.equal(await page.locator('.drawing-card').count(), cardCount);
  const boxes = await page.locator('.drawing-card').evaluateAll(nodes => nodes.map(n => { const r=n.getBoundingClientRect(); return { left:r.left, right:r.right, width:r.width }; }));
  assert(boxes.every(b => b.left >= 0 && b.right <= 390 && b.width > 100));
  assert.deepEqual(errors, []);
  console.log('PASS parrot:', { steps: count, pencilChanges: switches, checks: 'progressive outline/colour, all steps, repeat, saved resume, finish, picker navigation, mobile safe areas' });
} finally { await browser.close(); }
