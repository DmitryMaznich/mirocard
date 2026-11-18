/* global document */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const lesson = JSON.parse(await readFile(new URL('../lessons/snowman_glasses.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  const checked = await page.evaluate(lesson => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    document.body.append(svg);
    const prior = [], checked = [];
    const anchored = new Set([
      'Большой снежный ком', 'Голова над шарфом — от края до края',
      'Целый отворот шапки на голове', 'Верхняя часть шапки', 'Круглый помпон',
    ]);
    for (const step of lesson.steps) {
      if (step.kind !== 'stroke') continue;
      const current = step.paths.map(d => {
        if ((d.match(/M /g) ?? []).length !== 1) throw Error('Disconnected movement: ' + step.title);
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'black');
        path.setAttribute('stroke-width', '0.6');
        svg.append(path);
        return path;
      });
      if (anchored.has(step.title)) {
        if (current.length !== 1) throw Error('Fragmented contour: ' + step.title);
        const path = current[0];
        const ends = [path.getPointAtLength(0), path.getPointAtLength(path.getTotalLength())];
        if (!ends.every(point => prior.some(old => old.isPointInStroke(point)))) {
          throw Error('Contour must join existing lines at both ends: ' + step.title);
        }
        checked.push(step.title);
      }
      prior.push(...current);
    }
    svg.remove();
    return checked;
  }, lesson);
  assert.equal(checked.length, 5);
  console.log('PASS snowman: all five main contours use one movement and join existing lines within 0.3 SVG units', checked);
} finally {
  await browser.close();
}
