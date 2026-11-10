/* global document, DOMPoint */
// Verify real SVG junctions/occlusion, not just equality of authoring numbers.
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const lesson = JSON.parse(await readFile(new URL('../lessons/korzhik.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  console.log(await page.evaluate(lesson => {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); document.body.append(svg);
    let checks = 0;
    const check = (ok, message) => { if (!ok) throw new Error(message); checks++; };
    const node = d => { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); p.setAttribute('fill-rule', 'evenodd'); svg.append(p); return p; };
    const contours = new Map(lesson.steps.filter(s => s.kind === 'stroke').map(s => [s.title, s.paths.map(node)]));
    const colours = new Map(lesson.steps.filter(s => s.kind === 'color').map(s => [s.title, node(s.d)]));
    const get = (title, part = 0) => { const p = contours.get(title)?.[part]; if (!p) throw new Error(title); return p; };
    const start = p => p.getPointAtLength(0), end = p => p.getPointAtLength(p.getTotalLength());
    const distance = (a, b) => Math.hypot(a.x-b.x, a.y-b.y);
    const onCurve = (q, p, name) => {
      const length = p.getTotalLength(); let best = 0, min = Infinity;
      for (let i = 0; i <= 300; i++) { const d = distance(q, p.getPointAtLength(length*i/300)); if (d < min) { best = i; min = d; } }
      let lo = Math.max(0, (best-1)*length/300), hi = Math.min(length, (best+1)*length/300);
      for (let i = 0; i < 30; i++) { const a = lo+(hi-lo)/3, b = hi-(hi-lo)/3; if (distance(q, p.getPointAtLength(a)) < distance(q, p.getPointAtLength(b))) hi = b; else lo = a; }
      check(distance(q, p.getPointAtLength((lo+hi)/2)) < .03, 'Disconnected '+name);
    };
    const head = get('Контур головы'), brim = get('Овальный верх бескозырки');
    for (const band of contours.get('Боковины и полоска бескозырки')) {
      onCurve(start(band), brim, 'band upper edge'); onCurve(end(band), head, 'band lower edge');
    }
    onCurve(start(get('Помпон бескозырки')), brim, 'pompon left'); onCurve(end(get('Помпон бескозырки')), brim, 'pompon right');
    const front = colours.get('Голубая передняя часть бескозырки');
    for (const name of ['Левое ушко', 'Правое ушко']) for (const p of contours.get(name)) {
      const left = name.startsWith('Левое');
      onCurve(left ? start(p) : end(p), head, name+' head');
      onCurve(left ? end(p) : start(p), brim, name+' cap');
      // The hat was already drawn: no future ear stroke may run through it.
      const length = p.getTotalLength();
      for (let t = .05; t < .96; t += .05) {
        const q = p.getPointAtLength(length*t);
        check(!brim.isPointInFill(q) && !front.isPointInFill(q), name+' crosses the cap');
      }
    }
    const shirt = get('Тельняшка');
    onCurve(start(shirt), head, 'shirt left'); onCurve(end(shirt), head, 'shirt right');
    for (const side of ['Левый', 'Правый']) {
      const p = get(side+' рукав'); onCurve(start(p), head, side+' sleeve head'); onCurve(end(p), shirt, side+' sleeve shirt');
    }
    for (const side of ['Левая', 'Правая']) {
      const leg = get(side+' штанина'); onCurve(start(leg), shirt, side+' leg left'); onCurve(end(leg), shirt, side+' leg right');
      const foot = get(side+' ступня'); onCurve(start(foot), leg, side+' ankle left'); onCurve(end(foot), leg, side+' ankle right');
      const hand = get(side+' лапка'), sleeve = get(side === 'Левая' ? 'Левый рукав' : 'Правый рукав');
      onCurve(start(hand), sleeve, side+' wrist upper'); onCurve(end(hand), sleeve, side+' wrist lower');
    }
    const tail = get('Хвост'); onCurve(start(tail), shirt, 'tail upper'); onCurve(end(tail), get('Левая штанина'), 'tail lower');
    const ribbon1 = get('Верхняя ленточка'), ribbon2 = get('Нижняя ленточка');
    for (const q of [start(ribbon1), end(ribbon1)]) onCurve(q, get('Левое ушко'), 'ribbon at ear');
    for (const q of [start(ribbon2), end(ribbon2)]) onCurve(q, head, 'ribbon at head');
    const inside = (name, x, y) => colours.get(name).isPointInFill(new DOMPoint(x, y));
    for (const [x,y] of [[617,275],[712,245],[689,322],[690,390]]) check(!inside('Оранжевая мордочка', x, y), 'Face paints over eye/nose/mouth');
    check(inside('Оранжевое левое ушко', 519, 180), 'Missing left ear frame');
    check(inside('Середина левого ушка', 550, 230), 'Missing left inner ear');
    check(inside('Оранжевое правое ушко', 660, 126), 'Missing right ear frame');
    check(inside('Середина правого ушка', 650, 153), 'Missing right inner ear');
    for (const ear of ['Оранжевое левое ушко','Оранжевое правое ушко','Середина левого ушка','Середина правого ушка']) {
      check(!inside(ear,610,185), 'Ear paints the cap'); check(!inside(ear,617,275), 'Ear paints the face');
    }
    check(inside('Голубая передняя часть бескозырки', 610, 185), 'Missing cap front');
    check(!inside('Голубой край бескозырки', 588, 158), 'Cap centre must remain white');
    return { checks, message: 'Korzhik head/cap/ear occlusion, clothing junctions and colour cutouts verified' };
  }, lesson));
} finally { await browser.close(); }
