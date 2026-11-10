/* global document, window */
// Run against the React renderer loaded from the downloadable ZIP, not the
// standalone design mockup: DRAWING_PREVIEW_URL can point at a prod-ZIP harness.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const base = process.env.DRAWING_PREVIEW_URL ?? 'http://localhost:8080/tools/drawing/preview.html?lesson=goldfish';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base); await page.locator('.drawing-card').first().waitFor();
  await page.clock.install();
  await page.evaluate(() => {
    const root = document.getElementById('root');
    document.querySelector('.preview-header').style.display = 'none';
    root.style.height = '100dvh'; root.style.display = 'flex';
    const session = document.createElement('div'); session.className = 'session-screen';
    session.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column';
    const header = document.createElement('div'); header.className = 'session-header-wrap'; header.textContent = 'Shared navigation';
    root.before(session); session.append(header, root);
  });
  assert.equal(await page.locator('.session-header-wrap').isVisible(), false);
  assert.equal(await page.locator('.drawing-card').count(), 4);
  const index = () => page.evaluate(() => JSON.parse(localStorage.getItem('drawing-progress:local:goldfish'))?.index ?? 0);
  const hold = async () => {
    const gear = page.locator('.drawing-adult');
    await gear.dispatchEvent('pointerdown', { button: 0, pointerType: 'touch', pointerId: 1 });
    await page.clock.runFor(1000); assert.equal(await page.locator('dialog[open]').count(), 0);
    await page.clock.runFor(250); await gear.dispatchEvent('pointerup', { button: 0, pointerId: 1 });
    assert.equal(await page.locator('dialog[open]').count(), 1);
  };
  for (const title of ['Компот', 'Нудик', 'Коржик']) {
    await page.locator('.drawing-card').filter({ hasText: title }).tap();
    assert.equal(await page.locator('.drawing-top h2').textContent(), title);
    assert.equal(await page.locator('.drawing-controls button').count(), 2);
    await hold(); await page.getByRole('button', { name: 'Другой рисунок', exact: true }).tap();
    assert.equal(await page.locator('.drawing-card').count(), 4);
  }
  await page.locator('.drawing-card').filter({ hasText: 'Золотая рыбка' }).tap();
  await page.locator('.drawing-adult').tap();
  assert.equal(await page.locator('dialog[open]').count(), 0, 'A short tap must not open adult controls');
  assert.equal(await page.locator('.drawing-shell progress').count(), 0);
  assert.equal(await page.locator('.drawing-controls button').allTextContents().then(x => x.join('|')), 'Ещё раз|Дальше');
  await page.locator('.drawing-board').tap(); await page.clock.runFor(1000);
  assert.equal(await index(), 0, 'Canvas taps are off by default');
  await page.locator('.drawing-next').tap(); await page.clock.runFor(16000); assert.equal(await index(), 1);
  await page.locator('.drawing-repeat').tap(); await page.clock.runFor(16000); assert.equal(await index(), 1);
  await hold();
  assert.equal(await page.getByText('показано 1 из 45', { exact: false }).count(), 1);
  const before = await page.locator('.drawing-next').boundingBox();
  await page.getByLabel('Слова на кнопках').uncheck();
  await page.getByRole('button', { name: 'Закрыть настройки' }).tap();
  assert.equal(await page.locator('.drawing-next .drawing-control-label').isVisible(), false);
  assert.deepEqual(await page.locator('.drawing-next').boundingBox(), before);
  await hold(); await page.getByLabel('Слова на кнопках').check(); await page.getByLabel('Темп анимации').selectOption('slow');
  await page.getByRole('button', { name: 'Вернуться на один шаг', exact: true }).tap(); assert.equal(await index(), 0);
  await page.locator('.drawing-next').tap(); await page.clock.runFor(100);
  await hold();
  assert.equal(await page.locator('.drawing-pause-curtain').count(), 1);
  await page.getByRole('button', { name: 'Закрыть настройки' }).tap(); await page.clock.runFor(10000);
  assert.equal(await index(), 0, 'Closing settings must leave drawing paused');
  await page.locator('.drawing-next').tap(); await page.clock.runFor(16000); assert.equal(await index(), 1);
  await hold(); await page.getByRole('button', { name: 'Начать рисунок сначала…', exact: true }).tap();
  await page.getByRole('button', { name: 'Оставить рисунок', exact: true }).tap(); assert.equal(await index(), 1);
  await page.getByRole('button', { name: 'Другой рисунок', exact: true }).tap();
  await page.locator('.drawing-card').filter({ hasText: 'Золотая рыбка' }).tap(); assert.equal(await index(), 1);
  await hold(); await page.getByRole('button', { name: 'Начать рисунок сначала…', exact: true }).tap();
  await page.getByRole('button', { name: 'Начать сначала', exact: true }).tap(); assert.equal(await index(), 0);
  let changes = 0;
  for (let i = 1; i <= 45; i++) {
    const oldTool = await page.locator('.drawing-pencil-space').getAttribute('aria-label');
    await page.locator('.drawing-next').tap();
    if (await page.locator('[role=status]').textContent() === 'Подготовьте следующий карандаш') {
      changes++; assert.equal(await index(), i-1);
      assert.notEqual(await page.locator('.drawing-pencil-space').getAttribute('aria-label'), oldTool);
      assert.equal(await page.locator('[data-pencil]').getAttribute('visibility'), 'hidden');
      await page.locator('.drawing-next').tap();
    }
    await page.clock.runFor(16000); assert.equal(await index(), i);
    assert.equal(await page.locator('[data-finale]').count(), 0, 'Wait for explicit finish');
  }
  assert.equal(changes, 4);
  await page.screenshot({ path: '/tmp/drawing-app-ux-finished.png' });
  await page.locator('.drawing-next').tap(); await page.clock.runFor(2300);
  assert.equal(await page.locator('[data-finale-bubble]').count(), 3);
  await page.clock.runFor(3000); assert.equal(await page.locator('[data-finale]').count(), 0);
  await page.getByRole('button', { name: 'Рисунки', exact: true }).tap();
  assert.equal(await page.locator('.drawing-card').count(), 4);
  await page.locator('.drawing-card').filter({ hasText: 'Золотая рыбка' }).tap();
  assert.equal(await page.locator('.drawing-top h2').textContent(), 'Рисунок готов');
  assert.equal(await page.locator('[data-finale]').count(), 0);
  await hold(); await page.getByRole('button', { name: 'Закончить занятие', exact: true }).tap();
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.equal(await page.evaluate(() => window.finishCount), 1);
  assert.deepEqual(errors, []);
  console.log('PASS app ZIP: 4 drawings, 2 child buttons, long-press settings, repeat/back, pause/resume, reset confirmation, retained progress, 4 pencil gates, all 45 fish steps, explicit finale, session exit');
} finally { await browser.close(); }
