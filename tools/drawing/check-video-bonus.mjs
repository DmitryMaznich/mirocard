/* global window, document */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const base = process.env.DRAWING_PREVIEW_URL ?? 'http://localhost:8080/tools/drawing/preview.html';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const scenario of ['off', 'enabled', 'no-videos']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    // Keep the test offline: real PIN component/crypto and real video modal,
    // but no external YouTube request or real video-view writes.
    await page.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: '' }));
    await page.addInitScript(() => {
      if (window.top !== window) return;
      localStorage.setItem('drawing-progress:drawing-preview:goldfish', JSON.stringify({ index: 44, phase: 'copy' }));
      window.YT = { Player: class {
        constructor(_iframe, options) { queueMicrotask(() => options.events.onReady({ target: this })); }
        destroy() {} unMute() {} loadVideoById() {} getDuration() { return 60; }
      } };
    });
    await page.goto(`${base}?lesson=goldfish&bonus=1&enabled=${scenario === 'off' ? 0 : 1}${scenario === 'no-videos' ? '&noVideos=1' : ''}`);
    await page.locator('.drawing-card').first().waitFor();
    await page.evaluate(() => { document.querySelector('.preview-header').style.display = 'none'; document.getElementById('root').style.height = '100dvh'; });
    await page.locator('.drawing-card').filter({ hasText: 'Золотая рыбка' }).tap();
    await page.clock.install();
    assert.equal(await page.getByRole('button', { name: 'Дальше — бонус', exact: true }).count(), 0);
    await page.locator('.drawing-next').tap(); await page.clock.runFor(16000);
    assert.equal(await page.locator('.pin-gate-overlay').count(), 0);
    await page.locator('.drawing-next').tap(); await page.clock.runFor(5000);
    if (scenario === 'no-videos') {
      assert.equal(await page.getByRole('button', { name: 'Рисунки', exact: true }).count(), 1);
      await page.locator('.drawing-adult').focus(); await page.keyboard.press('Enter');
      assert.equal(await page.getByLabel('Видеобонус в конце', { exact: true }).isDisabled(), true);
      assert.equal(await page.locator('.pin-gate-overlay').count(), 0);
    } else {
      const settings = async () => { await page.locator('.drawing-adult').focus(); await page.keyboard.press('Enter'); };
      await settings();
      assert.equal(await page.getByLabel('Видеобонус в конце', { exact: true }).isChecked(), scenario === 'enabled');
      await page.getByLabel('Видеобонус в конце', { exact: true }).uncheck();
      await page.getByRole('button', { name: 'Закрыть настройки' }).tap();
      assert.equal(await page.getByRole('button', { name: 'Рисунки', exact: true }).count(), 1);
      await settings(); await page.getByLabel('Видеобонус в конце', { exact: true }).check();
      await page.getByRole('button', { name: 'Закрыть настройки' }).tap();
      const bonusButton = () => page.getByRole('button', { name: 'Дальше — бонус', exact: true });
      await bonusButton().tap();
      assert.equal(await page.locator('.pin-gate-overlay').count(), 1);
      assert.equal(await page.locator('.reward-modal-overlay').count(), 0);
      for (const digit of ['1', '1', '1', '1']) await page.getByRole('button', { name: digit, exact: true }).tap();
      await page.locator('.pin-gate__error').filter({ hasText: /./ }).waitFor();
      assert.equal(await page.locator('.reward-modal-overlay').count(), 0);
      await page.locator('.pin-gate__cancel').tap();
      assert.equal(await bonusButton().isEnabled(), true);
      await bonusButton().tap();
      for (const digit of ['1', '2', '3', '4']) await page.getByRole('button', { name: digit, exact: true }).tap();
      await page.locator('.reward-modal-overlay').waitFor();
      assert.equal(await page.locator('.pin-gate-overlay').count(), 0);
      assert.equal(await page.locator('.reward-modal__title').textContent(), 'Рисунок готов — молодец!');
      assert.equal(await page.locator('.reward-modal__btn--watch').isEnabled(), true);
      await page.locator('.reward-modal__btn--continue').tap();
      assert.equal(await page.locator('.drawing-card').count(), 4);
      await page.locator('.drawing-card').filter({ hasText: 'Золотая рыбка' }).tap();
      assert.equal(await page.getByRole('button', { name: 'Рисунки', exact: true }).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Дальше — бонус', exact: true }).count(), 0);
    }
    assert.deepEqual(errors, []);
    console.log('PASS adult video bonus:', scenario);
    await page.close();
  }
} finally { await browser.close(); }
