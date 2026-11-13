/* global window,document,requestAnimationFrame */
// Real ZIP/SessionScreen; Chromium tablet and phone frames, including repeated model clicks.
import { chromium,expect } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import { SHAPE_KINDS,shapeDefinition,partPoint,transformPoint } from '../../src/topics/renderers/drawing/firstLines/shapes.js';
const base=process.env.DRAWING_PREVIEW_URL||'http://127.0.0.1:8080';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[],frames=[];
const state=p=>p.evaluate(()=>window.previewStore.getState().activeSessionSnapshot.sessionState);
async function settle(p){await p.locator('.first-lines__board').waitFor();await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function open(kind,viewport,surface='single'){
 const context=await browser.newContext({viewport,hasTouch:true,isMobile:viewport.width<600}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/tools/drawing/first-lines-preview.html?fresh&noVideo&passive&exercises=${kind}&surface=${surface}`);await settle(page);await page.clock.install();return{context,page};
}
async function inspect(p,part){
 const result=await p.locator('.first-lines__demo').evaluate(g=>{
  const path=g.querySelector('path'),tip=g.querySelector('circle'),length=path.getTotalLength(),end=path.getPointAtLength(length);
  return{length,pathLength:path.getAttribute('pathLength'),offset:path.getAttribute('stroke-dashoffset'),dash:window.getComputedStyle(path).strokeDasharray,
   tip:tip?{x:Number(tip.getAttribute('cx')),y:Number(tip.getAttribute('cy'))}:null,end:{x:end.x,y:end.y}};
 });
 expect(result.pathLength).toBeNull();expect(result.offset).toBeNull();expect(result.dash).toBe('none');
 expect(result.length).toBeGreaterThanOrEqual(0);expect(result.length).toBeLessThanOrEqual(part.length+.2);
 if(result.tip&&result.length>0)expect(Math.hypot(result.tip.x-result.end.x,result.tip.y-result.end.y)).toBeLessThan(.05);
 return result.length;
}
async function capture(p,name){
 const boxes=await p.locator('.first-lines__track,.first-lines__sheet .first-lines__ink').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return{x:b.x-36,y:b.y-36,width:b.width+72,height:b.height+72};}));
 const file=`output/first-lines/demo-${name}.png`;await p.screenshot({path:file});frames.push({file,boxes});
}
async function draw(p,task){
 for(const part of shapeDefinition(task.exerciseKind,task.variant).parts){
  const points=Array.from({length:121},(_,i)=>transformPoint(partPoint(part,i/120),part.frame));
  const xy=await p.locator('.first-lines__active').evaluate((g,points)=>points.map(p=>{const a=g.ownerSVGElement.createSVGPoint();a.x=p.x;a.y=p.y;const b=a.matrixTransform(g.getScreenCTM());return{x:b.x,y:b.y};}),points);
  await p.mouse.move(xy[0].x,xy[0].y);await p.mouse.down();for(const q of xy.slice(1))await p.mouse.move(q.x,q.y);await p.mouse.up();
 }
}
try{
 await mkdir('output/first-lines',{recursive:true});
 for(const kind of SHAPE_KINDS.filter(k=>!['vertical_line','diagonal_up','diagonal_down'].includes(k))){
  const{page:p,context}=await open(kind,{width:900,height:1200});
  const task=(await state(p)).tasks[0],part=shapeDefinition(kind,task.variant).parts[0],duration=part.type==='line'?1200:Math.max(800,Math.min(2400,part.length*2));
  for(let repeat=0;repeat<2;repeat++){
   await p.getByRole('button',{name:'Показать движение',exact:true}).click();let previous=0;
   for(let i=0;i<8;i++){
    await p.clock.runFor((duration+200)/8);const length=await inspect(p,part);expect(length+.01).toBeGreaterThanOrEqual(previous);previous=length;
    if(i===4&&repeat===1&&['wave','fence','zigzag','arc','zigzag_arc_zigzag'].includes(kind))await capture(p,`${kind}-tablet`);
   }
   await p.clock.runFor(1300);await expect(p.locator('.first-lines__demo')).toHaveCount(0);
  }
  expect((await state(p)).incorrectCount).toBe(0);expect((await state(p)).correctCount).toBe(0);
  await context.close();
 }
 // Reach card 14 through real completions, then repeat Show and rotate mid-animation.
 const{page:p,context}=await open('wave',{width:900,height:1200},'sheet');
 for(let i=0;i<13;i++){
  const task=(await state(p)).tasks[i];await draw(p,task);await expect.poll(async()=>(await state(p)).correctCount).toBe(i+1);
  await p.getByRole('button',{name:'Следующее задание'}).click();await settle(p);
 }
 const before=await state(p),task=before.tasks[13],part=shapeDefinition('wave',task.variant).parts[0];
 for(let i=0;i<3;i++){
  await p.getByRole('button',{name:'Показать движение',exact:true}).click();await p.clock.runFor(900);await inspect(p,part);await capture(p,`wave-card14-${i}`);
  if(i===1){await p.setViewportSize({width:1200,height:900});await settle(p);await p.clock.runFor(450);await inspect(p,part);}
  await p.clock.runFor(5000);
 }
 expect((await state(p)).incorrectCount).toBe(before.incorrectCount);expect((await state(p)).correctCount).toBe(before.correctCount);
 await draw(p,task);await expect.poll(async()=>(await state(p)).correctCount).toBe(14);await context.close();
 const phone=await open('wave',{width:390,height:844});await phone.page.getByRole('button',{name:'Показать движение',exact:true}).click();await phone.page.clock.runFor(900);await capture(phone.page,'wave-phone');await phone.context.close();
 await writeFile('output/first-lines/demo-frames.json',JSON.stringify(frames,null,2));expect(errors).toEqual([]);
 console.log('Demo: all 16 families, 256 tablet animation frames, repeated Show, card 14, rotation, phone, no normalized dashes and synchronized path/tip passed.');
}finally{await browser.close();}
