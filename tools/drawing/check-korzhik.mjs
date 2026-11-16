import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    // Legacy progress cannot be replayed against a changed drawing sequence.
    localStorage.setItem('drawing-progress:local:korzhik', JSON.stringify({ index: 54, phase: 'done', bonusGiven: true }));
    localStorage.setItem('drawing-progress:local:goldfish', JSON.stringify({ index: 44, phase: 'copy' }));
  });
  await page.goto(process.env.DRAWING_PREVIEW_URL ?? 'http://localhost:8080/tools/drawing/preview.html?lesson=korzhik');
  const card = page.locator('.drawing-card').filter({ hasText: 'Коржик' });
  await card.waitFor(); assert.equal(await page.locator('.drawing-card small').count(), 0);
  await card.tap(); await page.clock.install();
  assert.equal(await page.locator('.drawing-show').count(), 0);
  assert.equal(await page.locator('[data-layer=drawing] path').count(), 0);
  const index = () => page.evaluate(() => JSON.parse(localStorage.getItem('drawing-progress:local:korzhik'))?.index);
  let switches = 0;
  for (let i = 1; i <= 58; i++) {
    await page.locator('.drawing-primary[aria-label="Дальше"]').tap();
    // A new pencil needs no extra tap: it wiggles in the header and the step starts by itself.
    if (await page.locator('[role=status]').textContent() === 'Подготовьте следующий карандаш') switches++;
    await page.clock.runFor(16000); assert.equal(await index(), i);
    if (i === 8) await page.screenshot({ path: '/tmp/korzhik-head-hat-ears.png' });
    if (i % 10 === 0) console.log('Korzhik step', i);
  }
  assert.equal(switches, 4);
  const before = await index(); await page.locator('.drawing-show').tap(); await page.clock.runFor(16000); assert.equal(await index(), before);
  await page.screenshot({ path: '/tmp/korzhik-new-finished.png' });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('drawing-progress:local:korzhik')).revision), 2);
  await page.locator('.drawing-primary[aria-label="Дальше"]').tap(); await page.getByRole('button', { name: 'Другой рисунок', exact: true }).tap();
  await page.locator('.drawing-card').filter({ hasText: 'Коржик' }).tap();
  assert.equal(await page.locator('.drawing-top h2').textContent(), 'Коржик', 'Reopened drawing starts afresh');
  await page.locator('.drawing-adult').tap(); await page.getByRole('button', { name: 'Другой рисунок', exact: true }).tap();
  const fish = page.locator('.drawing-card').filter({ hasText: 'Золотая рыбка' });
  await fish.tap();
  assert.equal(await page.locator('[data-layer=drawing] path').count(), 0, 'Saved fish progress is not resumed');
  assert.deepEqual(errors, []);
  console.log('PASS all 58 Korzhik steps, 5 pencils, repeat/finish/reopen, drawings start afresh on reopen (no resume)');
} finally { await browser.close(); }
