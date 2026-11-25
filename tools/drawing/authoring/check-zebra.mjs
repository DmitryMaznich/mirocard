/* global document, DOMPoint */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const lesson = JSON.parse(await readFile(new URL('../lessons/zebra_butterfly.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(lesson => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); document.body.append(svg);
    const path = d => {
      const node = document.createElementNS(svg.namespaceURI, 'path');
      node.setAttribute('d', d); node.setAttribute('fill-rule', 'evenodd'); svg.append(node); return node;
    };
    const colours = lesson.steps.filter(step => step.kind === 'color')
      .flatMap(step => step.regions?.map(region => ({ ...step, ...region })) ?? [step]);
    const body = path(lesson.geometry.body);
    const hooves = colours.filter(step => step.part.startsWith('hoof-')).map(step => path(step.d));
    const legs = lesson.geometry.legs.map(path);
    const grass = path(colours.find(step => step.part === 'grass').d);
    const eachPoint = (node, spacing, visit) => {
      const box = node.getBBox(); let count = 0;
      for (let y = box.y+.7; y < box.y+box.height; y += spacing) {
        for (let x = box.x+.7; x < box.x+box.width; x += spacing) {
          const point = new DOMPoint(x, y);
          if (node.isPointInFill(point)) { visit(point); count++; }
        }
      }
      if (!count) throw Error('Empty colour region');
      return count;
    };
    const hoofChecks = hooves.map((hoof, i) => {
      const box = hoof.getBBox();
      if (box.height > 25 || box.width < 20) throw Error('Hoof should be a short cap: '+i);
      const samples = eachPoint(hoof, 1.5, point => {
        if (!legs[i].isPointInFill(point)) throw Error('Hoof colour leaves its leg: '+i);
        if (grass.isPointInFill(point)) throw Error('Grass covers a hoof: '+i);
        if (hooves.some((other, j) => j !== i && other.isPointInFill(point))) throw Error('Hooves overlap');
      });
      return { hoof: i+1, samples };
    });
    const stripes = colours.filter(step => step.part.startsWith('stripe-')).map(step => path(step.d));
    stripes.forEach((stripe, i) => eachPoint(stripe, 3, point => {
      if (!body.isPointInFill(point)) throw Error('Stripe extends outside zebra: '+i);
      if (stripes.some((other, j) => j !== i && other.isPointInFill(point))) throw Error('Stripes overlap: '+i);
    }));
    for (const part of ['inner-ear-1', 'inner-ear-2', 'butterfly-upper', 'butterfly-lower', 'flower-petals', 'flower-centre']) {
      eachPoint(path(colours.find(step => step.part === part).d), 3, () => {});
    }
    return { hooves: hoofChecks, stripes: stripes.length };
  }, lesson);
  assert.equal(result.hooves.length, 4); assert.equal(result.stripes, 13);
  console.log('PASS zebra geometry:', result);
} finally { await browser.close(); }
