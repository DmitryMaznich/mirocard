/* global window,document,requestAnimationFrame,DOMPoint */
import { chromium,expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { shapeDefinition,partPoint,transformPoint } from '../../src/topics/renderers/drawing/firstLines/shapes.js';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const base=process.env.DRAWING_PREVIEW_URL||'http://127.0.0.1:8080',errors=[];
const state=p=>p.evaluate(()=>window.previewStore.getState().activeSessionSnapshot.sessionState);
async function settle(p){await p.locator('.first-lines__board').waitFor();await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
try{
 await mkdir('output/first-lines',{recursive:true});
 for(const kind of ['short_line','wave','zigzag','fence','arc'])for(const test of [{viewport:{width:1180,height:900},input:'passive'},{viewport:{width:390,height:844},input:'pen'},{viewport:{width:844,height:390},input:'touch'}]){
  const context=await browser.newContext({viewport:test.viewport,hasTouch:true,isMobile:test.viewport.width<600}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  // Select the first candidate in each block, so the first real card exercises the wide renderer.
  await p.addInitScript(()=>{Math.random=()=>0;});
  await p.goto(`${base}/tools/drawing/first-lines-preview.html?fresh&noVideo&surface=sheet&exercises=${kind}&${test.input}`);await settle(p);
  const task=(await state(p)).tasks[0];expect(task.variant.schema).toBe(7);await expect(p.locator('.first-lines')).toHaveAttribute('data-movement','wide');
  const geometry=await p.locator('.first-lines__active .first-lines__track').evaluate(path=>{
   const board=path.ownerSVGElement.getBoundingClientRect(),length=path.getTotalLength(),matrix=path.getScreenCTM();
   const points=Array.from({length:2001},(_,i)=>{const q=path.getPointAtLength(length*i/2000);return new DOMPoint(q.x,q.y).matrixTransform(matrix);});
   const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
   return{width:right-left,left:left-board.left,right:board.right-right,top:top-board.top,bottom:board.bottom-bottom,boardWidth:board.width};
  });
  const pad=test.input==='touch'?41:30;expect(Math.abs(geometry.width-(geometry.boardWidth-2*pad))).toBeLessThan(2);expect(geometry.left).toBeGreaterThanOrEqual(pad-2);expect(geometry.right).toBeGreaterThanOrEqual(pad-2);expect(geometry.top).toBeGreaterThanOrEqual(0);expect(geometry.bottom).toBeGreaterThanOrEqual(0);
  await p.screenshot({path:`output/first-lines/wide-${kind}-${test.viewport.width}-${test.input}.png`});
  await p.clock.install();await p.getByRole('button',{name:'Показать движение',exact:true}).click();await p.clock.runFor(750);
  await expect(p.locator('.first-lines__demo-line')).toHaveCount(1);
  const model=await p.locator('.first-lines__demo').evaluate(g=>{const path=g.querySelector('path'),tip=g.querySelector('circle'),length=path.getTotalLength(),end=path.getPointAtLength(length);return {length,dash:window.getComputedStyle(path).strokeDasharray,pathLength:path.getAttribute('pathLength'),distance:Math.hypot(end.x-Number(tip.getAttribute('cx')),end.y-Number(tip.getAttribute('cy')))};});
  expect(model.length).toBeGreaterThan(0);expect(model.dash).toBe('none');expect(model.pathLength).toBeNull();expect(model.distance).toBeLessThan(.05);
  const shape=shapeDefinition(kind,task.variant),part=shape.parts[0],points=Array.from({length:161},(_,i)=>transformPoint(partPoint(part,i/160),part.frame));
  const xy=await p.locator('.first-lines__active').evaluate((g,points)=>points.map(q=>{const a=g.ownerSVGElement.createSVGPoint();a.x=q.x;a.y=q.y;const b=a.matrixTransform(g.getScreenCTM());return{x:b.x,y:b.y};}),points);
  await p.mouse.move(xy[0].x,xy[0].y);await p.mouse.down();for(const q of xy.slice(1))await p.mouse.move(q.x,q.y);await p.mouse.up();
  await expect.poll(async()=>(await state(p)).correctCount).toBe(1);expect((await state(p)).incorrectCount).toBe(0);expect((await state(p)).streakCount).toBe(1);
  await p.reload();await settle(p);expect((await state(p)).tasks[0].variant).toEqual(task.variant);expect((await state(p)).correctCount).toBe(1);
  await p.getByRole('button',{name:'Следующее задание'}).click();await settle(p);await expect(p.locator('.first-lines')).toHaveAttribute('data-movement','regular');await expect(p.locator('.first-lines__sheet [data-shape]')).toHaveCount(1);
  await context.close();
 }
 expect(errors).toEqual([]);console.log('Wide movements: five families across tablet, portrait phone and landscape phone; full CSS width, safe endpoints, model interruption, one credit, reload and sheet preservation passed.');
}finally{await browser.close();}
