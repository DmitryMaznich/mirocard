/* global window, document, requestAnimationFrame, HTMLMediaElement */
import { chromium, expect } from '@playwright/test';
import { shapeDefinition, partPoint, transformPoint } from '../../src/topics/renderers/drawing/firstLines/shapes.js';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const base=process.env.DRAWING_PREVIEW_URL||'http://127.0.0.1:8080',errors=[];
const state=p=>p.evaluate(()=>window.previewStore.getState().activeSessionSnapshot.sessionState);
async function settle(p){await p.locator('.first-lines__board').waitFor();await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function open(kind,input,soft=false,surface=false){
 const context=await browser.newContext({viewport:surface?{width:320,height:568}:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.wrongSounds=0;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(...args){if(!this.muted&&this.src.endsWith('incorrect.wav'))window.wrongSounds++;return play.apply(this,args);};});
 await page.goto(`${base}/tools/drawing/first-lines-preview.html?fresh&noVideo&exercises=${kind}&${input==='touch'?'touch':''}&${soft?'soft':''}&${surface?'surface=sheet':''}`);await settle(page);return{page,context};
}
async function coords(p,task,part,point){const world=transformPoint(point,part.frame);
 return p.locator('.first-lines__active').evaluate((group,p)=>{const a=group.ownerSVGElement.createSVGPoint();a.x=p.x;a.y=p.y;const b=a.matrixTransform(group.getScreenCTM());return{x:b.x,y:b.y};},world);}
async function gesture(p,task,part,from=0,to=1){const start=await coords(p,task,part,partPoint(part,from));await p.mouse.move(start.x,start.y);await p.mouse.down();for(let i=1;i<=100;i++){const q=await coords(p,task,part,partPoint(part,from+(to-from)*i/100));await p.mouse.move(q.x,q.y);}await p.mouse.up();}
async function fail(p,task,part){const a=await coords(p,task,part,partPoint(part,0));await p.mouse.move(a.x,a.y);await p.mouse.down();const bad=await coords(p,task,part,part.type==='line'?{x:450,y:650}:{x:500,y:800});await p.mouse.move(bad.x,bad.y,{steps:12});
 await expect(p.locator('.first-lines')).toHaveAttribute('data-phase','error');const ink=await p.locator('.first-lines__board').innerHTML();await p.mouse.move(bad.x+20,bad.y-20,{steps:10});expect(await p.locator('.first-lines__board').innerHTML()).toBe(ink);
 await p.screenshot({path:'output/first-lines/recovery-stop.png'});await p.mouse.up();await expect(p.locator('.first-lines')).toHaveAttribute('data-phase','retry');await expect(p.locator('.first-lines__cue')).toContainText('Повтори от точки');}
try{
 for(const kind of process.env.DRAWING_RECOVERY_QUICK?[]:['short_line','circle','square','zigzag_arc_zigzag'])for(const input of ['pen','touch']){
  const {page:p,context}=await open(kind,input);const task=(await state(p)).tasks[0],shape=shapeDefinition(kind,task.variant),failedPart=kind==='square'?Math.min(1,shape.parts.length-1):0;
  if(failedPart)await gesture(p,task,shape.parts[0]);
  await fail(p,task,shape.parts[failedPart]);expect((await state(p)).incorrectCount).toBe(1);
  await fail(p,task,shape.parts[failedPart]);expect((await state(p)).incorrectCount).toBe(1);await expect.poll(()=>p.evaluate(()=>window.wrongSounds)).toBe(2);
  await p.reload();await settle(p);await expect(p.locator('.first-lines')).toHaveAttribute('data-phase','retry');
  for(let i=failedPart;i<shape.parts.length;i++){
   await p.getByRole('button',{name:'Показать движение',exact:true}).click();await expect(p.locator('.first-lines__demo-line')).toHaveCount(1);await expect(p.locator('.first-lines__demo').locator('..')).toHaveAttribute('data-part',String(i));
   await gesture(p,task,shape.parts[i]);await expect(p.locator('.first-lines__demo')).toHaveCount(0);
  }
  await expect.poll(async()=>(await state(p)).correctCount).toBe(1);expect((await state(p)).streakCount).toBe(0);expect((await state(p)).incorrectCount).toBe(1);
  await expect(p.getByRole('button',{name:'Следующее задание'})).toBeVisible();await p.screenshot({path:`output/first-lines/recovery-${kind}-${input}.png`});
  await p.getByRole('button',{name:'Следующее задание'}).click();await expect.poll(async()=>(await state(p)).taskIndex).toBe(1);await settle(p);
  const next=(await state(p)).tasks[1],nextShape=shapeDefinition(kind,next.variant);for(const part of nextShape.parts)await gesture(p,next,part);
  await expect.poll(async()=>(await state(p)).streakCount).toBe(1);await context.close();
 }
 // The model is copyable after a harmless partial stroke on the smallest phone.
 const sample=await open('short_line','pen',true,true),p=sample.page,task=(await state(p)).tasks[0],part=shapeDefinition('short_line',task.variant).parts[0];
 await gesture(p,task,part,0,.4);await expect(p.locator('.first-lines')).toHaveAttribute('data-phase','resume');
 await p.getByRole('button',{name:'Показать движение',exact:true}).click();await gesture(p,task,part);await expect.poll(async()=>(await state(p)).correctCount).toBe(1);expect((await state(p)).incorrectCount).toBe(0);
 await expect(p.getByRole('button',{name:/бумаг/})).toHaveCount(0);await expect(p.locator('.first-lines__pause')).toHaveCount(0);
 await p.getByRole('button',{name:'Следующее задание'}).click();await expect.poll(async()=>(await state(p)).taskIndex).toBe(1);await settle(p);
 await p.screenshot({path:'output/first-lines/recovery-screen-320.png'});await sample.context.close();
 expect(errors).toEqual([]);console.log('Recovery: stop/lift/retry, frozen failed ink, per-gesture sound with one reward penalty, all four path families, reload, copyable current model, drawing during model, next-card rewards and screen-only controls passed.');
}finally{await browser.close();}
