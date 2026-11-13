/* global window, document, requestAnimationFrame */
// Actual imported ZIP + actual SessionScreen, with geometry independently mapped by SVG CTM.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { SHAPE_KINDS, shapeDefinition, partPoint, transformPoint } from '../../src/topics/renderers/drawing/firstLines/shapes.js';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const base = process.env.DRAWING_PREVIEW_URL || 'http://127.0.0.1:8080', failures = [];
const state = page => page.evaluate(() => window.previewStore.getState().activeSessionSnapshot?.sessionState);
async function settled(page) {
  await page.locator('.first-lines__board').waitFor(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function open(query, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: viewport.width < 600 });
  const page = await context.newPage(); page.on('pageerror', e => failures.push(e.message));
  await page.goto(`${base}/tools/drawing/first-lines-preview.html?fresh&${query}`); await settled(page); return { page, context };
}
async function currentTask(page) { const s=await state(page); return s.tasks[s.taskIndex]; }
async function screenPoints(page, task, part, fractions) {
  const points = fractions.map(f => transformPoint(partPoint(part,f),part.frame));
  return page.locator('.first-lines__active').evaluate((group, points) => points.map(p => {
    const point = group.ownerSVGElement.createSVGPoint(); point.x=p.x; point.y=p.y; const xy=point.matrixTransform(group.getScreenCTM()); return {x:xy.x,y:xy.y};
  }),points);
}
async function gesture(page, points) {
  await page.mouse.move(points[0].x,points[0].y); await page.mouse.down();
  for(const p of points.slice(1)) await page.mouse.move(p.x,p.y);
  await page.mouse.up();
}
async function draw(page, surface='single') {
  const before=await state(page),task=before.tasks[before.taskIndex],shape=shapeDefinition(task.exerciseKind,task.variant);
  for(const [i,part] of shape.parts.entries()) {
    await expect(page.locator('.first-lines__start')).toHaveCount(1);await expect(page.locator('.first-lines__goal')).toHaveCount(1);
    await expect(page.locator('.first-lines__goal')).toHaveAttribute('fill','none');await expect(page.locator('.first-lines__goal')).toHaveAttribute('stroke','#8153b5');
    await expect(page.locator('.first-lines__house')).toHaveCount(0);
    await expect(page.locator('.first-lines__sheet>path')).toHaveCount(0);
    const count=part.type==='line'?3:121;
    await gesture(page,await screenPoints(page,task,part,Array.from({length:count},(_,n)=>n/(count-1)),surface));
    if(i<shape.parts.length-1) expect((await state(page)).status).toBe('task_active');
  }
  try { await expect.poll(async()=>(await state(page)).status).toBe('answer_correct'); }
  catch(error) { console.error('Failed target',task,{status:(await state(page)).status,incorrectCount:(await state(page)).incorrectCount});await page.screenshot({path:'output/first-lines/shape-failure.png'});throw error; }
  expect((await state(page)).correctCount).toBe(before.correctCount+1);
  expect((await state(page)).incorrectCount).toBe(before.incorrectCount);
}
async function next(page) {
  const before=(await state(page)).taskIndex; await page.locator('.first-lines__footer button').click();
  await expect.poll(async()=>(await state(page)).taskIndex).toBe(before+1);
  const task=await currentTask(page);
  await expect(page.locator('.first-lines')).toHaveAttribute('data-task-id',task.id); await settled(page);
  await expect(page.locator('.first-lines__pause')).toHaveCount(0);
}
async function width(page) {
  return page.locator('.first-lines__track').first().evaluate(node => { const matrix=node.getScreenCTM();return parseFloat(window.getComputedStyle(node).strokeWidth)*Math.hypot(matrix.a,matrix.b); });
}
try {
  await mkdir('output/first-lines',{recursive:true});
  if(!process.env.DRAWING_PROFILE_CHECK_ONLY) {
  // Every form with a real random variant on a phone; selected complex ones also on a tablet.
  for(const kind of SHAPE_KINDS.filter(k=>!['vertical_line','diagonal_up','diagonal_down'].includes(k))) {
    const {page,context}=await open(`noVideo&exercises=${kind}`);
    expect((await currentTask(page)).exerciseKind).toBe(kind);
    if(['tilted_oval','rectangle','rhombus','arc','parallelepiped','zigzag_arc_zigzag'].includes(kind)) await page.screenshot({path:`output/first-lines/variety-phone-${kind}.png`});
    await draw(page); await context.close();
  }
  // A whole random worksheet session keeps real work, geometry, page placement and normal prizes.
  const sheet=await open('surface=sheet',{width:1180,height:1000}); const page=sheet.page;
  const tasks=(await state(page)).tasks; expect(new Set(tasks.map(t=>t.exerciseKind)).size).toBe(15);
  expect(new Set(tasks.map(t=>t.variant.size)).size).toBeGreaterThan(1);
  for(let i=0;i<15;i++) {
    if(i===3) {
      expect(await page.locator('.first-lines__sheet [data-shape]').count()).toBe(3);
      const work=await page.locator('.first-lines__sheet').innerHTML(),variant=(await currentTask(page)).variant;
      await page.reload();await settled(page);expect((await currentTask(page)).variant).toEqual(variant);
      expect(await page.locator('.first-lines__sheet').innerHTML()).toBe(work);
      await page.screenshot({path:'output/first-lines/variety-tablet-sheet.png'});
    }
    await draw(page,'sheet');
    if((i+1)%5===0) {
      await expect(page.locator('.reward-modal-overlay')).toBeVisible();expect((await state(page)).rewardEarnedCount).toBe((i+1)/5);
      await page.locator('.reward-modal__btn--continue').click();
    }
    if(i<14) { await next(page);if((i+1)%4===0)expect(await page.locator('.first-lines__sheet [data-shape]').count()).toBe(0); }
  }
  await sheet.context.close();
  }
  // Finger and passive stylus use real touch events, with clearly different road widths.
  const widths=[];
  for(const input of ['pen','touch','passive']) {
    const session=await open(`noVideo&surface=sheet&exercises=circle&${input}`),screen=session.page;
    widths.push(await width(screen));
    if(input!=='pen') {
      const task=await currentTask(screen),part=shapeDefinition(task.exerciseKind,task.variant).parts[0];
      const points=await screenPoints(screen,task,part,Array.from({length:121},(_,n)=>n/120),'sheet');
      const cdp=await session.context.newCDPSession(screen);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],radiusX:4,radiusY:4,force:.1}]});
      for(const p of points.slice(1)) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,radiusX:4,radiusY:4,force:.1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await expect.poll(async()=>(await state(screen)).correctCount).toBe(1);
    }
    await screen.screenshot({path:`output/first-lines/variety-${input}-road.png`});
    if(input==='touch') {
      await next(screen);await screen.getByRole('button',{name:'Весь лист',exact:true}).click();
      expect((await screen.locator('.first-lines__board').getAttribute('viewBox')).split(' ').map(Number).slice(2)).toEqual(await screen.locator('.first-lines__board').evaluate(el=>[Math.round(el.clientWidth)*2,Math.round(el.clientHeight)*2]));
      await screen.screenshot({path:'output/first-lines/variety-phone-overview.png'});
      await screen.getByRole('button',{name:'К заданию',exact:true}).click();
      await draw(screen,'sheet');
    }
    await session.context.close();
  }
  expect(widths[1]/widths[0]).toBeGreaterThan(3);expect(widths[0]).toBeCloseTo(10,1);expect(widths[1]).toBeCloseTo(56,1);expect(widths[2]).toBeCloseTo(24,1);
  expect(failures).toEqual([]);
  console.log(process.env.DRAWING_PROFILE_CHECK_ONLY ? 'Input profiles: 10 px active stylus, 24 px passive stylus, 56 px finger; real touch completion, overview and shared rewards passed.' : 'Variety: all 15 generated families on phone, full random worksheet on tablet, stable geometry/reload, preserved work, standard prizes, overview, real finger/passive input and distinct road widths passed.');
}finally{await browser.close();}
