/* global window, document */
// Live AudioContext verification against the renderer loaded from the ZIP.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await context.addInitScript(() => {
    const Native = window.AudioContext;
    window.__pencilAudioGraphs = [];
    window.AudioContext = class extends Native {
      constructor(...args) { super(...args); this.recordings = []; window.__pencilAudioGraphs.push(this); }
      createGain() { const gain = super.createGain(), analyser = this.createAnalyser(); analyser.fftSize = 2048; gain.connect(analyser); this.analyser = analyser; return gain; }
      createBuffer(channels, length, rate) { this.recordings.push({ channels, length, rate }); return super.createBuffer(channels, length, rate); }
    };
  });
  const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
  page.on('pageerror', error => console.error(error.message));
  page.setDefaultTimeout(10000);
  await page.goto(process.env.DRAWING_PREVIEW_URL ?? 'http://localhost:8080/tools/drawing/preview.html?lesson=goldfish');
  await page.locator('.drawing-card').first().waitFor();
  const render = muted => page.evaluate(muted => {
    document.querySelector('.preview-header').style.display = 'none'; document.getElementById('root').style.height = '100dvh';
    const R = window.__MirocardRenderer.default ?? window.__MirocardRenderer;
    window.root.render(window.__Mirocard.React.createElement(R, { task: { lesson: window.lesson }, sessionParams: { speed: 'slow' }, soundEnabled: !muted }));
  }, muted);
  await render(false); await page.locator('.drawing-next').waitFor();
  assert.equal(await page.evaluate(() => window.__pencilAudioGraphs.length), 0);
  const rms = () => page.evaluate(() => {
    const a = window.__pencilAudioGraphs.at(-1)?.analyser; if (!a) return 0;
    const data = new Float32Array(a.fftSize); a.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((sum, v) => sum+v*v, 0)/data.length);
  });
  const silent = async why => { await page.waitForTimeout(180); assert(await rms() < 1e-7, why); };
  const audible = async why => { await page.waitForTimeout(250); const value = await rms(); assert(value > 1e-5 && value < .03, why+': '+value); return value; };
  const settings = async () => { await page.locator('.drawing-adult').focus(); await page.keyboard.press('Enter'); };
  const close = () => page.getByRole('button', { name: 'Закрыть настройки' }).tap();
  await page.locator('.drawing-next').tap(); const level = await audible('Contour must play the recording');
  assert.deepEqual(await page.evaluate(() => window.__pencilAudioGraphs[0].recordings), [{ channels: 1, length: 26160, rate: 24000 }]);
  await settings(); await silent('Adult menu pauses audio'); await close(); await silent('Closing menu does not resume');
  await page.locator('.drawing-next').tap(); await audible('Resume');
  await settings(); await page.getByLabel('Шуршание карандаша').uncheck(); await close();
  await page.locator('.drawing-next').tap(); await silent('Adult sound toggle');
  await settings(); await page.getByLabel('Шуршание карандаша').check(); await close();
  await page.locator('.drawing-next').tap(); await audible('Sound re-enabled');
  await render(true); await silent('Global app mute'); await render(false); await audible('Global app unmute');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await silent('Hidden page');
  await settings(); await page.getByRole('button', { name: 'Начать рисунок сначала…', exact: true }).tap();
  await page.getByRole('button', { name: 'Начать сначала', exact: true }).tap();
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await silent('Reset and idle');
  await page.locator('.drawing-next').tap(); await audible('Fresh stroke after reset');
  await page.evaluate(() => window.root.unmount()); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__pencilAudioGraphs.at(-1).state), 'closed');
  assert.deepEqual(errors, []);
  console.log('PASS recorded pencil audio:', { level, source: '24 kHz PCM, 1.09 s', checks: 'gesture, contour, pause/resume, adult mute, global mute, hidden, reset/idle, disposal' });
} finally { await browser.close(); }
