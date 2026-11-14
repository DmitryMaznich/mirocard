/* global document, Path2D */
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
    return { details: details.length, samples, gaps };
  }, lesson);
  assert.equal(result.gaps.length, 0, 'Unoutlined colour boundaries: ' + JSON.stringify(result.gaps));
  console.log('PASS small detail contours:', result);
} finally { await browser.close(); }
