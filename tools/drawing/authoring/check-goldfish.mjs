/* global document, DOMPoint */
// Real SVG geometry checks for the junctions that failed in the first lesson.
// CHROMIUM_PATH=/usr/bin/chromium node tools/drawing/authoring/check-goldfish.mjs
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const lesson = JSON.parse(await readFile(new URL('../lessons/goldfish.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  const result = await page.evaluate(lesson => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    document.body.append(svg);
    let checks = 0;
    const check = (ok, message) => { if (!ok) throw new Error(message); checks++; };
    const node = (d, rule = 'nonzero') => {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d); p.setAttribute('fill-rule', rule); svg.append(p); return p;
    };
    const strokes = new Map(lesson.steps.filter(s => s.kind === 'stroke').map(s => [s.title, node(s.paths[0])]));
    const get = name => { const p = strokes.get(name); if (!p) throw new Error(name); return p; };
    const start = p => p.getPointAtLength(0);
    const end = p => p.getPointAtLength(p.getTotalLength());
    const distance = (a, b) => Math.hypot(a.x-b.x, a.y-b.y);
    const join = (a, b) => check(distance(a, b) < .002, 'Disconnected stroke junction');
    const onCurve = (q, p) => {
      const length = p.getTotalLength(); let best = 0, min = Infinity;
      for (let i = 0; i <= 200; i++) {
        const d = distance(q, p.getPointAtLength(length*i/200));
        if (d < min) { best = i; min = d; }
      }
      let lo = Math.max(0, (best-1)*length/200), hi = Math.min(length, (best+1)*length/200);
      for (let i = 0; i < 28; i++) {
        const a = lo+(hi-lo)/3, b = hi-(hi-lo)/3;
        if (distance(q, p.getPointAtLength(a)) < distance(q, p.getPointAtLength(b))) hi = b; else lo = a;
      }
      check(distance(q, p.getPointAtLength((lo+hi)/2)) < .02, 'Fin or mask detached from body');
    };
    const top = get('Верхняя дуга тела'), bottom = get('Нижняя дуга тела');
    const tailTop = get('Верхняя лопасть хвоста'), tailBottom = get('Нижняя лопасть хвоста');
    const divider = get('Дуга за глазом');
    join(end(top), start(bottom)); join(end(bottom), start(top));
    onCurve(start(tailTop), top); onCurve(end(tailBottom), bottom); join(end(tailTop), start(tailBottom));
    onCurve(start(divider), top); onCurve(end(divider), bottom);
    for (let i = 1; i <= 5; i++) {
      const fin = get(`Дуга верхнего плавника ${i}`);
      onCurve(start(fin), top); onCurve(end(fin), top);
      check(!fin.getAttribute('d').includes('Z'), 'Visible fin base closing line');
      if (i < 5) join(end(fin), start(get(`Дуга верхнего плавника ${i+1}`)));
    }
    const front = get('Верхняя дуга нижнего плавника');
    onCurve(start(front), divider); onCurve(end(front), bottom);
    let previous = end(front);
    for (let i = 1; i <= 4; i++) {
      const p = get(`Закругление нижнего плавника ${i}`); join(previous, start(p)); previous = end(p);
    }
    join(previous, end(divider));
    const small1 = get('Первое закругление маленького плавника');
    const small2 = get('Второе закругление маленького плавника');
    onCurve(start(small1), bottom); join(end(small1), start(small2)); onCurve(end(small2), bottom);
    for (let column = 1; column <= 4; column++) {
      const count = column === 4 ? 3 : 4;
      for (let n = 1; n < count; n++) join(end(get(`Чешуйка ${n} в ряду ${column}`)), start(get(`Чешуйка ${n+1} в ряду ${column}`)));
    }
    const colors = new Map(lesson.steps.filter(s => s.kind === 'color').map(s => [s.title, node(s.d, 'evenodd')]));
    const inside = (name, x, y) => colors.get(name).isPointInFill(new DOMPoint(x*2, y*2));
    check(!inside('Оранжевая голова', 279, 182), 'Orange paints over white eye');
    check(inside('Оранжевая голова', 267, 200), 'Head mask leaves an internal gap');
    check(!inside('Жёлтое тело', 279, 182), 'Yellow paints the head');
    check(!inside('Жёлтое тело', 328, 228), 'Yellow paints the front fin');
    check(inside('Жёлтое тело', 350, 175), 'Empty body colour mask');
    check(!inside('Чёрный зрачок с белым бликом', 276, 179), 'Black paints the eye highlight');
    return { checks, outlineSteps: strokes.size, message: 'SVG junctions and colour cutouts verified' };
  }, lesson);
  console.log(result);
} finally {
  await browser.close();
}
