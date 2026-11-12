/* global document, DOMPoint */
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const lesson = JSON.parse(await readFile(new URL('../lessons/parrot.json', import.meta.url), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  console.log(await page.evaluate(lesson => {
    const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg'); document.body.append(svg);
    const node = (d, rule = 'nonzero') => { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); p.setAttribute('fill-rule', rule); svg.append(p); return p; };
    let checks = 0; const check = (ok, why) => { if (!ok) throw Error(why); checks++; };
    const colours = lesson.steps.filter(s => s.kind === 'color').map(s => ({ ...s, shape: node(s.d, 'evenodd'), outer: s.clip ? node(s.clip) : null }));
    const inside = (s, x, y) => { const p = new DOMPoint(x*2, y*2); return s.shape.isPointInFill(p) && (!s.outer || s.outer.isPointInFill(p)); };
    const colour = title => colours.find(s => s.title === title);
    const yellow = colour('Жёлтая голова и грудка'), pink = colour('Розовая верхняя часть крыла');
    const outline = title => lesson.steps.find(s => s.title === title).paths.map(d => node(d));
    const end = p => p.getPointAtLength(p.getTotalLength());
    const head = outline('Спинка и округлая голова')[0];
    const beak = outline('Загнутый клюв');
    const cap = beak[2];
    check(Boolean(cap), 'Missing right cere/beak connection');
    check(Math.hypot(end(head).x-cap.getPointAtLength(0).x,end(head).y-cap.getPointAtLength(0).y)<.01, 'Cere cap detached from forehead');
    const q=end(cap), length=beak[0].getTotalLength(); let closest=Infinity;
    for(let t=0;t<=length;t+=.01){const p=beak[0].getPointAtLength(t);closest=Math.min(closest,Math.hypot(q.x-p.x,q.y-p.y));}
    check(closest<.02, 'Cere cap detached from beak');
    check(!inside(yellow, 380, 122), 'Yellow covers eye');
    check(!inside(pink, 380, 122), 'Pink covers eye');
    check(!inside(colour('Розовая макушка'), 380, 122), 'Crown covers eye');
    check(inside(pink, 354, 159), 'Missing pink wing');
    check(inside(colour('Жёлтые длинные перья крыла'), 333, 201), 'Missing yellow wing');
    check(inside(colour('Жёлтый клюв'), 419, 141), 'Missing beak');
    check(inside(colour('Левая жёлтая лапка'), 315, 255), 'Missing toe');
    check(!inside(colour('Коричневая веточка'), 315, 255), 'Branch paints toes');
    const body = yellow.outer; const gaps = [];
    for (let y = 90; y < 282; y += 2) for (let x = 204; x < 435; x += 2) {
      if (!body.isPointInFill(new DOMPoint(x*2, y*2))) continue;
      if (x >= 373 && x <= 387 && y >= 113 && y <= 131) continue; // white eye + highlight
      if (x >= 400 && y <= 164) continue; // overlapping cere/beak outlines
      if (!colours.some(s => inside(s,x,y))) gaps.push([x,y]);
    }
    check(gaps.length === 0, 'Uncoloured gaps in body/wing/tail: '+JSON.stringify(gaps.slice(0,8)));
    const strokes = lesson.steps.filter(s => s.kind === 'stroke');
    for (const s of strokes) for (const d of s.paths) {
      const p = node(d); check(p.getTotalLength() > 2, 'Empty stroke '+s.title);
      check(d.match(/M /g).length === 1, 'Separate movements hidden in one path '+s.title);
    }
    for (const s of colours) {
      const b = s.shape.getBBox(); let hit = false;
      for (let i=0; i<=40 && !hit; i++) for(let j=0;j<=40 && !hit;j++) hit=inside(s,(b.x+b.width*i/40)/2,(b.y+b.height*j/40)/2);
      check(hit, 'Empty clipped colour region '+s.title);
    }
    return { checks, result: 'No body/wing gaps; eye cutouts, toe occlusion, all contours and colour clips verified' };
  }, lesson));
} finally { await browser.close(); }
