/* global window, document, DOMPoint, OfflineAudioContext */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const lesson = JSON.parse(await readFile(new URL('./lessons/green_car.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../../docs/mockups/drawing/lesson-ux.html', import.meta.url), 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setContent(html);
  await page.locator('.card').filter({ hasText: lesson.title }).click();
  await page.evaluate(index=>window.__drawingUx.seek(index), lesson.steps.length);
  const run = async () => { await page.evaluate(index=>window.__drawingUx.seek(index), lesson.steps.length); await page.locator('.next').click(); };
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  const svg = page.locator('.board > svg');
  const original = await svg.innerHTML();
  assert.equal(await page.locator('[data-finale]').count(), 0, 'No motion or horn until explicit completion');
  const scenery = () => page.locator('[data-finish-part]:not([data-finish-actor])').evaluateAll(nodes => nodes.map(node => node.outerHTML));
  const still = await scenery();
  await run();
  const layer = page.locator('[data-finale=car-drive]');
  await page.clock.runFor(400);
  const start = await layer.getAttribute('transform'); assert(start.startsWith('translate(0 0)'), 'Honk before moving');
  assert.equal(await page.locator('[data-car-honk]').getAttribute('opacity'), '1');
  await page.screenshot({ path: '/workspace/car-honking.png' });
  let previous = 0, roadSamples = 0;
  for (const ms of [650, 400, 400, 400, 400]) {
    await page.clock.runFor(ms);
    const state = await layer.evaluate((node, lesson) => {
      const m = node.transform.baseVal.consolidate().matrix;
      const road = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      road.setAttribute('d', lesson.steps.find(step=>step.kind==='color'&&step.part==='road').d.split(' Z ')[0]+' Z');
      road.setAttribute('visibility', 'hidden'); node.ownerSVGElement.append(road);
      const points = lesson.finale.wheels.map(wheel => {
        const point = new DOMPoint(wheel.centre[0], wheel.centre[1]+wheel.radius).matrixTransform(m);
        return { x: point.x, y: point.y, onRoad: road.isPointInFill(point) };
      }).filter(point=>point.x>25&&point.x<775);
      const wheels = lesson.finale.wheels.map(wheel => {
        const parts = [...node.querySelectorAll(`[data-finish-part="${wheel.rim}"], [data-finish-part="${wheel.hub}"], [data-car-spokes="${wheel.rim}"]`)];
        return new Set(parts.map(part=>part.getAttribute('transform'))).size===1;
      });
      road.remove();
      return { dx: m.e, unmirrored: m.a>0&&m.d>0, points, wheels };
    }, lesson);
    assert(state.unmirrored && state.dx>previous, 'Travel right, front first'); previous = state.dx;
    for (const point of state.points) { assert(point.onRoad, 'Wheel must stay on the road: '+JSON.stringify(point)); roadSamples++; }
    assert(state.wheels.every(Boolean), 'Hub, rim and spokes rotate together');
    assert.deepEqual(await scenery(), still, 'Scenery stays still');
  }
  await page.screenshot({ path: '/workspace/car-driving-right.png' });
  await page.clock.runFor(1450);
  assert(await layer.evaluate(node=>{ const b=node.getBBox(), m=node.transform.baseVal.consolidate().matrix; return [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].every(([x,y])=>new DOMPoint(x,y).matrixTransform(m).x>=800); }), 'Leave completely to the right');
  await page.clock.runFor(1700);
  assert.equal(await layer.count(), 0); assert.equal(await svg.innerHTML(), original, 'Restore exact drawing for replay');
  await run(); await page.clock.runFor(1100);
  await page.evaluate(()=>window.__drawingUx.openSettings());
  assert.equal(await layer.count(), 0); assert.equal(await svg.innerHTML(), original, 'Settings stop sound and motion');
  await page.locator('.dialog-close').click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await run(); await page.clock.runFor(1000);
  assert.equal(await layer.count(), 0, 'Reduced motion keeps drawing still');
  assert.deepEqual(errors, []);
  const audioSource = await readFile(new URL('../../src/topics/renderers/drawing/hornSound.js', import.meta.url), 'utf8');
  const audio = await page.evaluate(async source => {
    const { createCarHorn } = await import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
    const context = new OfflineAudioContext(1, 44100, 44100);
    const horn = createCarHorn({ contextFactory:()=>context, visibilityTarget:{hidden:false} });
    const played = horn.play(); const buffer = await context.startRendering();
    const samples = buffer.getChannelData(0);
    const rms = (a,b) => { let sum=0; for(let i=Math.floor(a*44100);i<b*44100;i++)sum+=samples[i]**2;return Math.sqrt(sum/((b-a)*44100)); };
    horn.dispose(); return { played, first:rms(.04,.14), gap:rms(.23,.26), second:rms(.31,.41), tail:rms(.6,.9) };
  }, audioSource);
  assert(audio.played && audio.first>.01 && audio.second>.01, 'Two audible horn pulses');
  assert(audio.gap<.0001 && audio.tail<.0001, 'Silence between pulses and after the horn');
  console.log(JSON.stringify({ roadSamples, audio, errors }));
} finally { await browser.close(); }
