/* global window, document, DOMPoint */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const lesson = JSON.parse(await readFile(new URL('./lessons/zebra_butterfly.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../../docs/mockups/drawing/lesson-ux.html', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 960 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setContent(html); await page.locator('.card').filter({ hasText: lesson.title }).click();
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  const seek = index => page.evaluate(index => window.__drawingUx.seek(index), index);
  const svg = page.locator('.board > svg');
  await seek(lesson.steps.length);
  assert.equal(await page.locator('[data-finale]').count(), 0, 'Wait until the child confirms completion');
  const original = await svg.innerHTML();
  const scenery = () => page.locator('[data-finish-part]:not([data-finish-actor])').evaluateAll(nodes => nodes.map(node => node.outerHTML));
  const still = await scenery();
  await page.locator('.next').click();
  const layer = page.locator('[data-finale=zebra-run]'); assert.equal(await layer.count(), 1);
  const follower = page.locator('[data-finale-follower=butterfly]'); assert.equal(await follower.count(), 1);
  for (const milliseconds of [800, 350, 650, 700]) {
    await page.clock.runFor(milliseconds);
    const direction = await layer.evaluate(node => {
      const matrix = node.transform.baseVal.consolidate().matrix;
      const front = node.querySelector('[data-finish-part=leg-front]');
      const tail = node.querySelector('[data-finish-part=tail]');
      const frontRoot = front.getPointAtLength(0).matrixTransform(front.getCTM());
      const tailRoot = tail.getPointAtLength(0).matrixTransform(tail.getCTM());
      return { unmirrored: matrix.a > 0 && matrix.d > 0 && matrix.b === 0 && matrix.c === 0,
        tailBehind: tailRoot.x > frontRoot.x, dx: matrix.e };
    });
    assert(direction.unmirrored, 'Keep the original horizontal and vertical orientation');
    assert(direction.tailBehind && direction.dx < 0, 'Move left with the front legs leading and the tail behind');
    assert.deepEqual(await scenery(), still, 'Flower and grass stay still');
    const chase = await follower.evaluate(node => ({ dx: node.transform.baseVal.consolidate().matrix.e,
      wings: ['butterfly-upper', 'butterfly-lower'].map(part => [...node.querySelectorAll(`[data-finish-part="${part}"]`)].map(wing=>wing.getAttribute('transform'))) }));
    assert(chase.dx > direction.dx && chase.dx <= 0, 'Butterfly follows with a delay, moving left behind the zebra');
    for (const pair of chase.wings) assert.equal(new Set(pair).size, 1, 'Wing outline and colour flap together');
    for (const leg of lesson.finale.legs) {
      const joined = await page.evaluate(({ part, hoof }) => {
        const outline = document.querySelector(`[data-finish-part="${part}"]`);
        const cap = document.querySelector(`path[data-finish-part="${hoof}"]`);
        const toLeg = outline.getCTM().inverse();
        return [0, cap.getTotalLength()].every(distance => {
          const point = cap.getPointAtLength(distance);
          const local = new DOMPoint(point.x, point.y).matrixTransform(cap.getCTM()).matrixTransform(toLeg);
          return outline.isPointInStroke(local);
        });
      }, leg);
      assert(joined, 'The hoof must remain joined to its bending leg: '+leg.part);
    }
  }
  await page.screenshot({ path: '/workspace/zebra-running-left.png' });
  await page.clock.runFor(1200);
  assert(await layer.evaluate(node => node.transform.baseVal.consolidate().matrix.e <= -640), 'Leave completely through the left edge');
  await page.clock.runFor(1500);
  assert.equal(await layer.count(), 0); assert((await svg.innerHTML()) === original, 'Restore every path, colour mask and layer position');
  assert.equal(await follower.count(), 0);
  await seek(lesson.steps.length); await page.locator('.next').click(); await page.clock.runFor(1000);
  await page.evaluate(() => window.__drawingUx.openSettings());
  assert.equal(await layer.count(), 0); assert((await svg.innerHTML()) === original, 'Settings cancel the run safely');
  await page.locator('.dialog-close').click(); await page.emulateMedia({ reducedMotion: 'reduce' });
  await seek(lesson.steps.length); await page.locator('.next').click(); assert.equal(await layer.count(), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seek(lesson.steps.length); await page.locator('.next').click(); await page.clock.runFor(900);
  await seek(lesson.steps.length-1); await page.clock.runFor(6000);
  assert.equal(await layer.count(), 0); assert.equal(await page.locator('[data-finish-actor=zebra]').count() > 0, true);
  assert.deepEqual(errors, []);
  console.log('PASS zebra finale: unmirrored leftward run, butterfly follows and flaps, 4 connected hooves, fixed flower/grass, restoration and cancellation');
} finally { await browser.close(); }
