/* global window,document,requestAnimationFrame */
import { chromium,expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { shapeDefinition,partPoint,transformPoint } from '../../src/topics/renderers/drawing/firstLines/shapes.js';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const base=process.env.DRAWING_PREVIEW_URL||'http://127.0.0.1:8080',errors=[];
const state=p=>p.evaluate(()=>window.previewStore.getState().activeSessionSnapshot.sessionState);
async function settled(p){await p.locator('.first-lines__board').waitFor();await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function stroke(p,part){
 const points=[partPoint(part,0),partPoint(part,1)].map(q=>transformPoint(q,part.frame));
 const xy=await p.locator('.first-lines__active').evaluate((g,points)=>points.map(q=>{const s=g.ownerSVGElement.createSVGPoint();s.x=q.x;s.y=q.y;const p=s.matrixTransform(g.getScreenCTM());return{x:p.x,y:p.y};}),points);
 await p.mouse.move(xy[0].x,xy[0].y);await p.mouse.down();await p.mouse.move(xy[1].x,xy[1].y,{steps:10});await p.mouse.up();
}
try{
 await mkdir('output/first-lines',{recursive:true});
 for(const viewport of [{width:820,height:1180},{width:1180,height:900},{width:390,height:844}])for(const input of ['pen','passive','touch']){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:viewport.width<600}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(`${base}/tools/drawing/first-lines-preview.html?fresh&noVideo&surface=sheet&exercises=parallelepiped&${input}`);await settled(p);
  await expect(p.locator('.first-lines__room')).toHaveCount(0);await expect(p.locator('.first-lines__active .first-lines__track')).toHaveCount(9);
  const task=(await state(p)).tasks[0],shape=shapeDefinition(task.exerciseKind,task.variant);expect(task.variant.schema).toBe(6);expect(shape.parts).toHaveLength(9);
  const geometry=await p.locator('.first-lines__active').evaluate(g=>{
   const paths=[...g.querySelectorAll('.first-lines__track')],rects=paths.map(n=>n.getBoundingClientRect()),p=paths[0],m=p.getScreenCTM(),scale=Math.hypot(m.a,m.b);
   const board=g.ownerSVGElement.getBoundingClientRect();
   return {width:Math.max(...rects.map(r=>r.right))-Math.min(...rects.map(r=>r.left)),height:Math.max(...rects.map(r=>r.bottom))-Math.min(...rects.map(r=>r.top)),road:parseFloat(window.getComputedStyle(p).strokeWidth)*scale,edge:p.getTotalLength()*scale,opacities:paths.map(p=>p.getAttribute('opacity')),inside:rects.every(r=>r.left>=board.left&&r.right<=board.right&&r.top>=board.top&&r.bottom<=board.bottom)};
  });
  const minimum=input==='pen'?160:input==='passive'?200:240;
  expect(Math.min(geometry.width,geometry.height)).toBeGreaterThanOrEqual(minimum-.1);expect(geometry.edge*Math.sqrt(3)/2-geometry.road).toBeGreaterThanOrEqual(12-.1);expect(geometry.inside).toBe(true);expect(geometry.opacities.every(o=>o==='1')).toBe(true);
  await p.screenshot({path:`output/first-lines/volume-${viewport.width}-${input}.png`});
  await p.getByRole('button',{name:'Показать движение',exact:true}).click();await expect(p.locator('.first-lines__demo-line')).toHaveCount(1);
  for(const [i,part] of shape.parts.entries()){
   await stroke(p,part);await expect.poll(async()=>(await state(p)).correctCount).toBe(i===8?1:0);expect((await state(p)).incorrectCount).toBe(0);
  }
  expect((await state(p)).streakCount).toBe(1);
  await p.reload();await settled(p);await expect(p.getByRole('button',{name:'Следующее задание'})).toBeVisible();expect((await state(p)).correctCount).toBe(1);
  await p.getByRole('button',{name:'Следующее задание'}).click();await settled(p);
  await expect(p.locator('.first-lines__sheet [data-shape="parallelepiped"]')).toHaveCount(1);await expect(p.locator('.first-lines__sheet .first-lines__ink')).toHaveCount(9);
  await context.close();
 }
 expect(errors).toEqual([]);console.log('Whole cube: nine opaque equal edges, readable CSS dimensions, separated roads, current-part model, nine edges/one credit, reload and preserved whole cube on the sheet, pen/passive/finger on tablet and phone passed.');
}finally{await browser.close();}
