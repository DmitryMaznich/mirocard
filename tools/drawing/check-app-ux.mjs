/* global document, window */
// Run against the React renderer loaded from the downloadable ZIP, not the
// standalone design mockup: DRAWING_PREVIEW_URL can point at a prod-ZIP harness.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const cardCount = JSON.parse(await readFile(new URL('./topic.json', import.meta.url), 'utf8')).cards.filter(card => card.lessonFile).length;
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
  // One navigation style (2026-11-16): the shared header (✕ with confirmation) stays visible in drawing.
  assert.equal(await page.locator('.session-header-wrap').isVisible(), true);
  assert.equal(await page.locator('.drawing-card').count(), cardCount);
  const index = () => page.evaluate(() => JSON.parse(localStorage.getItem('drawing-progress:local:goldfish'))?.index ?? 0);
  // The adult's menu opens with an ordinary tap, as everywhere else in the app (no long press).
  const hold = async () => { await page.locator('.drawing-adult').tap(); assert.equal(await page.locator('dialog[open]').count(), 1); };
  const next = () => page.locator('.drawing-primary[aria-label="Дальше"]');
  for (const title of ['Компот', 'Нудик', 'Коржик']) {
    await page.locator('.drawing-card').filter({ hasText: title }).tap();
    assert.equal(await page.locator('.drawing-top h2').textContent(), title);
    assert.equal(await page.locator('.drawing-primary').count(), 1); assert.equal(await page.locator('.drawing-show').count(), 0);
    await hold(); await page.getByRole('button', { name: 'Другой рисунок', exact: true }).tap();
    assert.equal(await page.locator('.drawing-card').count(), cardCount);
  }
  await page.locator('.drawing-card').filter({ hasText: 'Золотая рыбка' }).tap();
  assert.equal(await page.locator('.drawing-shell progress').count(), 0);
  // No words on the child's buttons: one round primary action, «show again» only after a step.
  assert.equal(await page.locator('.drawing-primary').textContent(), '');
  await page.locator('.drawing-board').tap(); await page.clock.runFor(1000);
  assert.equal(await index(), 0, 'Canvas taps are off by default');
  await next().tap(); await page.clock.runFor(16000); assert.equal(await index(), 1);
  await page.locator('.drawing-show').tap(); await page.clock.runFor(16000); assert.equal(await index(), 1);
  await hold();
  assert.equal(await page.getByText('показано 1 из 45', { exact: false }).count(), 1);
  assert.equal(await page.getByLabel('Слова на кнопках').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Закончить занятие', exact: true }).count(), 0, 'Leaving is the header ✕ only');
  await page.getByLabel('Темп анимации').selectOption('slow');
  await page.getByRole('button', { name: 'Вернуться на один шаг', exact: true }).tap(); assert.equal(await index(), 0);
  await next().tap(); await page.clock.runFor(100);
  await hold();
  assert.equal(await page.locator('.drawing-pause-curtain').count(), 1);
  await page.getByRole('button', { name: 'Закрыть настройки' }).tap(); await page.clock.runFor(10000);
  assert.equal(await index(), 0, 'Closing settings must leave drawing paused');
  await next().tap(); await page.clock.runFor(16000); assert.equal(await index(), 1);
  await hold(); await page.getByRole('button', { name: 'Начать рисунок сначала…', exact: true }).tap();
  await page.getByRole('button', { name: 'Оставить рисунок', exact: true }).tap(); assert.equal(await index(), 1);
  await page.getByRole('button', { name: 'Другой рисунок', exact: true }).tap();
  await page.locator('.drawing-card').filter({ hasText: 'Золотая рыбка' }).tap(); assert.equal(await index(), 1);
  await hold(); await page.getByRole('button', { name: 'Начать рисунок сначала…', exact: true }).tap();
  await page.getByRole('button', { name: 'Начать сначала', exact: true }).tap(); assert.equal(await index(), 0);
  let changes = 0;
  for (let i = 1; i <= 45; i++) {
    const oldTool = await page.locator('.drawing-pencil-space').getAttribute('aria-label');
    await next().tap();
    if (await page.locator('[role=status]').textContent() === 'Подготовьте следующий карандаш') {
      changes++; assert.equal(await index(), i-1);
      assert.notEqual(await page.locator('.drawing-pencil-space').getAttribute('aria-label'), oldTool);
      assert.equal(await page.locator('[data-pencil]').getAttribute('visibility'), 'hidden');
      await next().tap();
    }
    await page.clock.runFor(16000); assert.equal(await index(), i);
    assert.equal(await page.locator('[data-finale]').count(), 0, 'Wait for explicit finish');
  }
  assert.equal(changes, 4);
  await page.screenshot({ path: '/tmp/drawing-app-ux-finished.png' });
  await next().tap(); await page.clock.runFor(2300);
  assert.equal(await page.locator('[data-finale-bubble]').count(), 3);
  await page.clock.runFor(3000); assert.equal(await page.locator('[data-finale]').count(), 0);
  await page.getByRole('button', { name: 'Другой рисунок', exact: true }).tap();
  assert.equal(await page.locator('.drawing-card').count(), cardCount);
  await page.locator('.drawing-card').filter({ hasText: 'Золотая рыбка' }).tap();
  assert.equal(await page.locator('.drawing-top h2').textContent(), 'Рисунок готов');
  assert.equal(await page.locator('[data-finale]').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS app ZIP: 4 drawings, shared header, one primary + show-again, tap settings, repeat/back, pause/resume, reset confirmation, retained progress, 4 pencil gates, all 45 fish steps, explicit finale');
} finally { await browser.close(); }
