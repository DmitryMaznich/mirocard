/* global document, DOMPoint */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const lesson = JSON.parse(await readFile(new URL('../lessons/green_car.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(lesson => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); document.body.append(svg);
    const path = d => {
      const node = document.createElementNS(ns, 'path');
      node.setAttribute('d', d); node.setAttribute('fill-rule', 'evenodd'); svg.append(node); return node;
    };
    const steps = lesson.steps;
    const body = path(steps.find(step => step.part === 'body' && step.kind === 'color').d);
    const windows = [];
    for (const name of ['rear', 'middle', 'front']) {
      const frame = path(steps.find(step => step.part === 'window-'+name && step.kind === 'stroke').paths[0]);
      const patch = path(steps.find(step => step.part === 'window-'+name && step.kind === 'color').d);
      if (patch.getAttribute('d') !== frame.getAttribute('d')) throw Error('Window colour must reach its exact frame: '+name);
      const box = frame.getBBox(); let samples = 0;
      for (let y = box.y+2; y < box.y+box.height; y += 4) {
        for (let x = box.x+2; x < box.x+box.width; x += 4) {
          const point = new DOMPoint(x, y);
          if (!frame.isPointInFill(point)) continue;
          if (!patch.isPointInFill(point) || body.isPointInFill(point)) throw Error('Window colour overlaps body or misses glass: '+name);
          samples++;
        }
      }
      if (!samples) throw Error('Empty window: '+name);
      windows.push({ name, samples });
    }
    const roadStep = steps.find(step => step.part === 'road' && step.kind === 'color');
    const road = path(roadStep.d), roadOuter = path(roadStep.d.split(' Z ')[0]+' Z');
    const markings = steps.find(step => step.part === 'road-marks').paths;
    for (const d of markings) {
      const mark = path(d), box = mark.getBBox();
      if (road.isPointInFill(new DOMPoint(box.x+box.width/2, box.y+box.height/2))) throw Error('Road markings are not left white');
      for (let i = 0; i <= 30; i++) if (!roadOuter.isPointInFill(mark.getPointAtLength(mark.getTotalLength()*i/30))) throw Error('Marking leaves the road');
    }
    const stones = steps.find(step => step.part === 'roadside-stones' && step.kind === 'stroke').paths;
    for (const d of stones) {
      const stone = path(d);
      for (let i = 0; i <= 60; i++) {
        const point = stone.getPointAtLength(stone.getTotalLength()*i/60);
        if (roadOuter.isPointInFill(point) || body.isPointInFill(point)) throw Error('Roadside stone overlaps road or car');
      }
    }
    const sun = path(steps.find(step => step.part === 'sun' && step.kind === 'color').d).getBBox();
    if (sun.x < 640 || sun.y+sun.height > 160) throw Error('Sun should sit in the clear sky to the right');
    return { windows, whiteMarkings: markings.length, roadsideStones: stones.length };
  }, lesson);
  assert.equal(result.windows.length, 3); assert.equal(result.whiteMarkings, 7);
  assert.equal(result.roadsideStones, 4);
  console.log('PASS green car geometry:', result);
} finally { await browser.close(); }
