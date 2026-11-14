/* global document, Path2D, DOMPoint */
// Check visible colour boundaries against the actual SVG contours, independently
// of the Python author's curve/junction calculations.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const lesson = JSON.parse(await readFile(new URL('../lessons/peppa_george.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(lesson => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); document.body.append(svg);
    const path = d => { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); svg.append(p); return p; };
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    // Much narrower than the displayed 3.5-unit line, so small gaps do not hide
    // behind a thick stroke. Every edge must have a real authored contour.
    ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const contours = lesson.steps.filter(s => s.kind === 'stroke').flatMap(s => s.paths).map(d => new Path2D(d));
    // Grass intentionally reaches the open sheet edges. Every character region
    // (including eyes, shoes and clothing cutouts) must be outlined beforehand.
    const details = lesson.steps.filter(s => s.kind === 'color' && s.tool !== 'green');
    const gaps = []; let samples = 0;
    for (const detail of details) {
      const edge = path(detail.d), length = edge.getTotalLength();
      let missing = 0; const examples = [];
      for (let d = 0; d <= length; d += .5) {
        const q = edge.getPointAtLength(d); samples++;
        if (!contours.some(p => ctx.isPointInStroke(p, q.x, q.y))) {
          missing++; if (examples.length < 3) examples.push([q.x / 2, q.y / 2]);
        }
      }
      if (missing) gaps.push({ title: detail.title, missing, examples });
    }
    const region = title => {
      const step = lesson.steps.find(s => s.title === title);
      const shape = path(step.d); shape.setAttribute('fill-rule', 'evenodd');
      const clip = step.clip ? path(step.clip) : null;
      return { shape, inside: q => shape.isPointInFill(q) && (!clip || clip.isPointInFill(q)) };
    };
    const pairs = [
      ['Розовый цвет: Ручка Джорджа', 'Розовый цвет: Вторая ручка Джорджа'],
      ['Розовый цвет: Первая ножка Джорджа', 'Закрасим первый ботинок Джорджа'],
      ['Розовый цвет: Вторая ножка Джорджа', 'Закрасим второй ботинок Джорджа'],
      ['Розовый цвет: Первая ножка Пеппы', 'Закрасим первый ботинок Пеппы'],
      ['Розовый цвет: Вторая ножка Пеппы', 'Закрасим второй ботинок Пеппы'],
    ];
    const overlaps = [];
    for (const [a, b] of pairs) {
      const first = region(a), second = region(b), box = first.shape.getBBox();
      let count = 0; const examples = [];
      for (let x = box.x + .2; x < box.x + box.width; x += .5) {
        for (let y = box.y + .2; y < box.y + box.height; y += .5) {
          const q = new DOMPoint(x, y);
          if (first.inside(q) && second.inside(q)) {
            count++; if (examples.length < 3) examples.push([x / 2, y / 2]);
          }
        }
      }
      if (count) overlaps.push({ a, b, count, examples });
    }
    const firstArm = region(pairs[0][0]), secondArm = region(pairs[0][1]);
    const secondArmPath = new Path2D(secondArm.shape.getAttribute('d'));
    ctx.lineWidth = 7;
    for(let d=0;d<firstArm.shape.getTotalLength();d+=.5){
      const q=firstArm.shape.getPointAtLength(d);
      if(ctx.isPointInStroke(secondArmPath,q.x,q.y))throw Error('The displayed black hand outlines touch or overlap');
    }
    const sourcePoints = [[304,254,firstArm],[300,275,firstArm],[262,289,secondArm],[284,280,secondArm]];
    for (const [x,y,arm] of sourcePoints) {
      if (!arm.inside(new DOMPoint(x*2,y*2))) throw Error(`Missing arm at original reference point ${x},${y}`);
    }
    const grass = region('Зелёная горка'), grassOverlaps = [];
    ctx.lineWidth = 3.5;
    for (const title of [...new Set(pairs.slice(1).flat())]) {
      const part = region(title), box = part.shape.getBBox(); let count = 0;
      for (let x=box.x+.3;x<box.x+box.width;x+=1) for(let y=box.y+.3;y<box.y+box.height;y+=1) {
        const q=new DOMPoint(x,y);
        if (part.inside(q)&&grass.inside(q)&&!contours.some(p=>ctx.isPointInStroke(p,x,y))) count++;
      }
      if(count)grassOverlaps.push({title,count});
    }
    return { details: details.length, samples, gaps, overlaps, grassOverlaps };
  }, lesson);
  assert.equal(result.gaps.length, 0, 'Unoutlined colour boundaries: ' + JSON.stringify(result.gaps));
  assert.equal(result.overlaps.length, 0, 'Overlapping limbs: ' + JSON.stringify(result.overlaps));
  assert.equal(result.grassOverlaps.length, 0, 'Grass paints feet: ' + JSON.stringify(result.grassOverlaps));
  console.log('PASS small detail contours:', result);
} finally { await browser.close(); }
