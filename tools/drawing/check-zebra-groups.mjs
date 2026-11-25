/* global window */
// Real SVG playback of the self-contained preview, including grouped colour
// completion, pausing, repetition, rewinding and cancellation while awaiting RAF.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const lesson = JSON.parse(await readFile(new URL('./lessons/zebra_butterfly.json', import.meta.url), 'utf8'));
const stripeIndex = lesson.steps.findIndex(step => step.kind === 'color' && step.part === 'zebra-stripes');
const hoofIndex = lesson.steps.findIndex(step => step.kind === 'color' && step.part === 'zebra-hooves');
assert.equal(hoofIndex, stripeIndex+1);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 960 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setContent(await readFile(new URL('../../docs/mockups/drawing/lesson-ux.html', import.meta.url), 'utf8'));
  await page.locator('.card').filter({ hasText: lesson.title }).click(); await page.clock.install();
  const state = () => page.evaluate(() => window.__drawingUx.get());
  const seek = index => page.evaluate(index => window.__drawingUx.seek(index), index);
  const stripes = page.locator('g[data-finish-part^="stripe-"]');
  const hooves = page.locator('g[data-finish-part^="hoof-"]');
  await seek(stripeIndex); await page.locator('.next').click(); await page.clock.runFor(120);
  assert.equal(await stripes.count(), 1, 'Only the first region is created initially');
  assert.equal((await state()).index, stripeIndex);
  await page.clock.runFor(1800);
  assert((await stripes.count()) > 1 && (await stripes.count()) < 13, 'Colour progresses from stripe to stripe');
  await page.evaluate(() => window.__drawingUx.openSettings());
  const paused = await page.locator('[data-layer=colors]').innerHTML();
  await page.clock.runFor(5000);
  assert((await page.locator('[data-layer=colors]').innerHTML()) === paused, 'Pause freezes all grouped regions');
  await page.locator('.dialog-close').click(); await page.locator('.next').click();
  await page.clock.runFor(120000);
  assert.equal(await stripes.count(), 13); assert.equal((await state()).index, stripeIndex+1);
  await page.locator('.next').click(); await page.clock.runFor(120);
  assert.equal(await hooves.count(), 1); assert.equal((await state()).index, hoofIndex);
  await page.clock.runFor(40000);
  assert.equal(await hooves.count(), 4); assert.equal((await state()).index, hoofIndex+1);
  await page.locator('.repeat').click(); await page.clock.runFor(120);
  assert.equal(await hooves.count(), 1, 'Repeat restarts the whole hoof step');
  await page.clock.runFor(40000); assert.equal(await hooves.count(), 4);
  await page.evaluate(() => window.__drawingUx.openSettings()); await page.locator('#previous').click();
  assert.equal((await state()).index, hoofIndex); assert.equal(await hooves.count(), 0);
  assert.equal(await stripes.count(), 13, 'Rewinding hooves keeps the previous stripe group');
  await seek(stripeIndex); await page.locator('.next').click(); await page.clock.runFor(120);
  await seek(stripeIndex); await page.clock.runFor(120000);
  assert.equal(await stripes.count(), 0, 'Cancelled promises must not create later regions');
  assert.equal((await state()).index, stripeIndex); assert.equal((await state()).busy, false);
  await seek(lesson.steps.length);
  assert.equal(await stripes.count(), 13); assert.equal(await hooves.count(), 4);
  await page.screenshot({ path: '/workspace/zebra-grouped-preview.png' });
  assert.deepEqual(errors, []);
  console.log('PASS zebra groups: one click for 13 stripes, one for 4 hooves; sequential colour, pause, repeat, back, cancellation and restore');
} finally { await browser.close(); }
