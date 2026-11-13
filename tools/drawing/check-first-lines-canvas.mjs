/* global window,document,MutationObserver,getComputedStyle */
import { chromium,expect } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import { SHAPE_KINDS,shapeDefinition } from '../../src/topics/renderers/drawing/firstLines/shapes.js';
import { state,task,settle,points,draw,pixels,checkpoint,next } from './canvas-check-helpers.mjs';
const scope=process.env.DRAWING_CANVAS_CHECK||'all',base=process.env.DRAWING_PREVIEW_URL||'http://127.0.0.1:8080';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[],report=[];
async function open(query,viewport={width:820,height:1180},random=false){
 const context=await browser.newContext({viewport,hasTouch:true,isMobile:viewport.width<600,deviceScaleFactor:3}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 if(!random)await p.addInitScript(()=>{Math.random=()=>0;});
 await p.goto(`${base}/tools/drawing/first-lines-preview.html?fresh&${query}`);await settle(p);
 const image=await pixels(p);expect(image.attributes).toMatchObject({alpha:false,willReadFrequently:true,desynchronized:false});expect(image.width).toBeLessThanOrEqual(2048);expect(image.height).toBeLessThanOrEqual(2048);
 expect(await p.locator('.first-lines__board').evaluate(n=>n.tagName)).toBe('CANVAS');expect(await p.locator('.first-lines__board path,.first-lines__board polyline').count()).toBe(0);
 expect(image.green).toBeGreaterThan(20);expect(image.purple).toBeGreaterThan(20);return{context,p};
}
async function correctedCredit(p,before){await draw(p);await expect.poll(async()=>(await state(p)).correctCount).toBe(before+1);expect((await pixels(p)).blue).toBeGreaterThan(50);await expect.poll(async()=>(await pixels(p)).purple).toBe(0);}
async function failGesture(p){
 const t=await task(p),part=shapeDefinition(t.exerciseKind,t.variant).parts[0],xy=await points(p,part,[0,.2]);await p.mouse.move(xy[0].x,xy[0].y);await p.mouse.down();
 await p.mouse.move(xy[1].x,xy[1].y);await p.mouse.move(xy[1].x+110,xy[1].y+150,{steps:15});await p.mouse.move(xy[1].x+160,xy[1].y+190,{steps:8});await p.mouse.up();await settle(p);
}
try{
 await mkdir('output/first-lines',{recursive:true});
 if(['all','shapes','volumes','wide','profiles'].includes(scope)){
  const kinds=scope==='volumes'?['parallelepiped']:scope==='wide'?['short_line','wave','zigzag','fence','arc']:scope==='profiles'?['circle']:SHAPE_KINDS.filter(k=>!['vertical_line','diagonal_up','diagonal_down'].includes(k));
  for(const kind of kinds){
   const {context,p}=await open(`noVideo&surface=sheet&exercises=${kind}&passive`,{width:1180,height:900});const before=await state(p);
   await correctedCredit(p,0);expect((await state(p)).incorrectCount).toBe(0);expect((await state(p)).streakCount).toBe(1);
   if(['wave','parallelepiped','fence'].includes(kind))await p.screenshot({path:`output/first-lines/canvas-${kind}.png`});
   await p.reload();await settle(p);expect((await state(p)).correctCount).toBe(1);expect((await state(p)).tasks[0].variant).toEqual(before.tasks[0].variant);
   await next(p);expect(await p.locator('.first-lines__board').getAttribute('data-render-status')).toBe('ready');await context.close();
  }
  for(const input of ['touch','passive','pen'])for(const viewport of [{width:390,height:844},{width:844,height:390}]){
   const{context,p}=await open(`noVideo&surface=sheet&exercises=wave&${input}`,viewport);
   await draw(p,{touch:input!=='pen',context});await expect.poll(async()=>(await state(p)).correctCount).toBe(1);expect((await state(p)).incorrectCount).toBe(0);expect((await pixels(p)).blue).toBeGreaterThan(30);await context.close();
  }
  report.push('shapes, real touch, all profiles, whole cube, wide strokes, pixels, reload');
 }
 if(['all','session','shapes'].includes(scope)){
  const{context,p}=await open('surface=sheet&passive',{width:1180,height:1000},true);
  await p.evaluate(()=>{window.oldDrawingCanvases=[];window.canvasObserver=new MutationObserver(list=>{for(const m of list)for(const node of m.removedNodes)if(node.nodeType===1){if(node.tagName==='CANVAS')window.oldDrawingCanvases.push(node);window.oldDrawingCanvases.push(...node.querySelectorAll('canvas'));}});window.canvasObserver.observe(document.body,{childList:true,subtree:true});});
  for(let i=0;i<15;i++){
   await correctedCredit(p,i);expect((await state(p)).incorrectCount).toBe(0);
   // Repeated taps after a correct answer repaint the bitmap without changing ink or rewards.
   const saved=await checkpoint(p);if((i+1)%5!==0)for(let n=0;n<4;n++)await p.locator('.first-lines__board').click({position:{x:15+n*3,y:20}});
   expect(await checkpoint(p)).toEqual(saved);expect((await state(p)).correctCount).toBe(i+1);
   if(i===13){await p.screenshot({path:'output/first-lines/canvas-card14-after-taps.png'});const filter=await p.locator('.session-plan-tongue').evaluate(n=>({filter:getComputedStyle(n).filter,animation:getComputedStyle(n).animationName}));expect(filter).toEqual({filter:'none',animation:'none'});}
   if((i+1)%5===0){await expect(p.locator('.reward-modal-overlay')).toBeVisible();await p.locator('.reward-modal__btn--continue').click();}
   if(i<14)await next(p);
  }
  expect((await state(p)).rewardEarnedCount).toBe(3);
  expect(await p.evaluate(()=>window.oldDrawingCanvases.length)).toBeGreaterThan(10);
  expect(await p.evaluate(()=>window.oldDrawingCanvases.every(c=>c.width===1&&c.height===1))).toBe(true);
  await context.close();report.push('15 real tasks, three standard prizes, card14, repeated taps, released old bitmaps');
 }
 if(['all','recovery','recovery-short'].includes(scope)){
  for(const soft of [false,true]){
   const{context,p}=await open(`noVideo&exercises=short_line&surface=sheet&passive&${soft?'soft':''}`);
   await correctedCredit(p,0);await next(p);await failGesture(p);await expect.poll(async()=>(await state(p)).incorrectCount).toBe(1);await expect(p.locator('.first-lines')).toHaveAttribute('data-phase','retry');
   const failed=await checkpoint(p);await p.reload();await settle(p);expect((await checkpoint(p)).hadError).toBe(true);await correctedCredit(p,1);expect((await state(p)).streakCount).toBe(soft?1:0);expect((await checkpoint(p)).parts[0].history).toEqual(failed.parts[0].history);
   await next(p);await correctedCredit(p,2);expect((await state(p)).streakCount).toBe(soft?2:1);await context.close();
  }
  const{context,p}=await open('noVideo&exercises=short_line&passive');const t=await task(p),part=shapeDefinition(t.exerciseKind,t.variant).parts[0],xy=await points(p,part,[0,.3]);
  await p.mouse.move(xy[0].x,xy[0].y);await p.mouse.down();await p.mouse.move(xy[1].x,xy[1].y,{steps:10});
  await p.locator('.first-lines__board').evaluate(c=>c.dispatchEvent(new Event('contextlost',{cancelable:true})));expect((await checkpoint(p)).hadError).toBe(false);expect((await state(p)).incorrectCount).toBe(0);
  await p.mouse.up();await p.locator('.first-lines__board').evaluate(c=>c.dispatchEvent(new Event('contextrestored')));await settle(p);await correctedCredit(p,0);expect((await state(p)).incorrectCount).toBe(0);await context.close();report.push('strict/soft mistakes, blocked correction, next-card credit, context loss/restore without penalty');
 }
 if(['all','model'].includes(scope)){
  const{context,p}=await open('noVideo&exercises=wave&surface=sheet&passive');
  for(let i=0;i<3;i++){await p.getByRole('button',{name:'Показать движение',exact:true}).click();await expect(p.locator('.first-lines__board')).toHaveAttribute('data-demo','true');await expect.poll(async()=>(await pixels(p)).blue).toBeGreaterThan(30);await p.waitForTimeout(4000);expect((await state(p)).correctCount).toBe(0);expect((await state(p)).incorrectCount).toBe(0);}
  await p.getByRole('button',{name:'Показать движение',exact:true}).click();await correctedCredit(p,0);await expect(p.locator('.first-lines__board')).not.toHaveAttribute('data-demo','true');
  await p.setViewportSize({width:900,height:1180});await settle(p);await p.reload();await settle(p);expect((await state(p)).correctCount).toBe(1);expect((await pixels(p)).blue).toBeGreaterThan(30);await context.close();report.push('repeated show, raster model pixels, interruption, rotate/reload');
 }
 expect(errors).toEqual([]);await writeFile('output/first-lines/canvas-verification.json',JSON.stringify({scope,report},null,2));console.log('Canvas 2D: '+report.join('; ')+'.');
}finally{await browser.close();}
