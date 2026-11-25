/* global document, Image, XMLSerializer */
// End-to-end verification for any authored lesson in the actual downloadable ZIP.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { chromium } from '@playwright/test';
const id=process.argv[2]??'donkey';
const descriptor=JSON.parse(await readFile(new URL('./topic.json',import.meta.url),'utf8'));
const zip=await JSZip.loadAsync(await readFile(new URL(`../../public/decks/drawing_v${descriptor.meta.version}.zip`,import.meta.url)));
const manifest=JSON.parse(await zip.file('topic.json').async('string'));
manifest.cards=manifest.cards.filter(card=>card.lesson?.steps?.length);
const card=manifest.cards.find(c=>c.id===id);assert(card,'Unknown lesson');
const lesson=card.lesson,blackEnd=lesson.steps.findIndex(s=>s.tool!=='black');
const firstColour=lesson.steps.findIndex(s=>s.kind==='color'&&s.tool!=='black');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(lesson.progressRevision>1)await page.addInitScript(({id,revision})=>{
  const key='drawing-progress:local:'+id;
  if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({index:37,phase:'done',revision:revision-1}));
 },{id,revision:lesson.progressRevision});
 await page.goto(process.env.DRAWING_PREVIEW_URL??`http://localhost:8081/tools/drawing/preview.html?lesson=${id}`);
 await page.locator('.drawing-card').filter({hasText:card.label}).tap();
 if(lesson.paperOrientation==='landscape')await page.getByRole('button',{name:'Начать рисовать',exact:true}).tap();
 assert.equal(await page.locator('.drawing-show').count(),0,'Start without legacy progress');
 await page.clock.install();
 await page.evaluate(()=>{document.querySelector('.preview-header').style.display='none';document.getElementById('root').style.height='100dvh';document.documentElement.style.setProperty('--app-safe-top','59px');document.documentElement.style.setProperty('--app-safe-bottom','34px');});
 const index=()=>page.evaluate(id=>JSON.parse(localStorage.getItem('drawing-progress:local:'+id))?.index??0,id);
 let changes=0;
 for(let i=1;i<=lesson.steps.length;i++){
  await page.locator('.drawing-primary[aria-label="Дальше"]').tap();
  // A new pencil: no extra tap — it wiggles in the header and the step starts by itself after a short pause.
  if(await page.locator('[role=status]').textContent()==='Подготовьте следующий карандаш'){changes++;await page.clock.runFor(1150);}
  const currentStep=lesson.steps[i-1];
  if(currentStep.kind==='stroke'&&currentStep.paths.length>1){
   const previousPaths=lesson.steps.slice(0,i-1).filter(s=>s.kind==='stroke'&&Boolean(s.background)===Boolean(currentStep.background)).reduce((sum,s)=>sum+s.paths.length,0);
   await page.clock.runFor(120);
   const paths=page.locator(`[data-layer=${currentStep.background?'background-drawing':'drawing'}] > path`);
   assert.equal(await paths.count(),previousPaths+1,'Later strokes in a combined step must wait for the pencil');
   assert(Number(await paths.last().evaluate(p=>p.style.strokeDashoffset))>0,'Combined step must animate its first stroke');
  }
  if(i===1){
   await page.clock.runFor(120);
   const path=page.locator('[data-layer=drawing] path').last();assert(Number(await path.evaluate(p=>p.style.strokeDashoffset))>0,'Contour must be progressive');
   await page.locator('.drawing-adult').focus();await page.keyboard.press('Enter');
   const before=await path.evaluate(p=>p.style.strokeDashoffset);await page.clock.runFor(1000);assert.equal(await path.evaluate(p=>p.style.strokeDashoffset),before,'Pause must freeze drawing');
   await page.getByRole('button',{name:'Закрыть настройки'}).tap();await page.clock.runFor(1000);assert.equal(await path.evaluate(p=>p.style.strokeDashoffset),before);
   await page.locator('.drawing-primary[aria-label="Дальше"]').tap();
  }
  if(i===firstColour+1||lesson.steps[i-1].title==='Зелёная травка'){
   await page.clock.runFor(120);assert.equal(await index(),i-1,'Colour index advances only after animation');
   assert(await page.locator(`[data-layer=${currentStep.background?'background-colors':'colors'}] [data-region="${i-1}"] g[visibility=hidden]`).count()>0,'Future pencil lines must remain hidden');
  }
  await page.clock.runFor(16000);assert.equal(await index(),i,'Step '+i);
  assert.deepEqual(await page.locator('[data-layer=labels] text[visibility=visible]').allTextContents(),(lesson.labels??[]).filter(label=>i>=(label.afterStep??0)).map(label=>label.text),'Labels must follow their object outlines');
  if(lesson.steps[i-1].title==='Зелёный контур травки'){
   assert.equal(await page.locator(`[data-layer=colors] [data-region="${i}"]`).count(),0,'Grass must still be uncoloured');
   await page.locator('.drawing-board > svg').screenshot({path:`/workspace/${id}-grass-outline.png`});
  }
  if(lesson.steps[i-1].title==='Контур лепестков цветка'){
   const width=await page.locator('[data-layer=drawing] > path').last().evaluate(p=>p.getBoundingClientRect().width);
   assert(width>=36,'Flower contour should be readable on a phone');
  }
  if(i===blackEnd)await page.locator('.drawing-board > svg').screenshot({path:`/workspace/${id}-outline.png`});
  const step=lesson.steps[i-1];
  if(step.kind==='stroke'&&step.tool!=='black'){
   const expected=await page.evaluate(colour=>{const e=document.createElement('div');e.style.color=colour;return e.style.color;},lesson.palette.find(t=>t.id===step.tool).color);
   const inks=await page.locator(`[data-layer=${step.background?'background-drawing':'drawing'}] > path`).evaluateAll((ps,n)=>ps.slice(-n).map(p=>p.style.stroke),step.paths.length);
   assert(inks.every(ink=>ink===expected),'Wrong pencil for '+step.title);
  }
 }
 assert.equal(changes,lesson.steps.filter((step,i)=>i>0&&step.tool!==lesson.steps[i-1].tool).length);
 await page.locator('.drawing-show').tap();await page.clock.runFor(16000);assert.equal(await index(),lesson.steps.length);
 assert.equal(await page.locator('.drawing-top h2').textContent(),card.label,'Explicit finish required');await page.locator('.drawing-primary[aria-label="Дальше"]').tap();
 assert.equal(await page.locator('.drawing-top h2').textContent(),'Рисунок готов');await page.locator('.drawing-board > svg').screenshot({path:`/workspace/${id}-finished.png`});
 if(lesson.labels?.length){
  assert.deepEqual(await page.locator('[data-layer=labels] text[visibility=visible]').allTextContents(),lesson.labels.map(label=>label.text),'Labels survive repeat, saved resume and finish');
  const layout=await page.evaluate(async()=>{
   const svg=document.querySelector('.drawing-board > svg'),view=svg.viewBox.baseVal;
   const boxes=[...svg.querySelectorAll('[data-layer=labels] text')].map(node=>{const b=node.getBBox();return {text:node.textContent,x:b.x,y:b.y,width:b.width,height:b.height,screenHeight:node.getBoundingClientRect().height};});
   const clone=svg.cloneNode(true);clone.querySelector('[data-layer=labels]')?.remove();clone.setAttribute('width',view.width);clone.setAttribute('height',view.height);
   const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));
   const img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});}finally{URL.revokeObjectURL(url);}
   const canvas=document.createElement('canvas');canvas.width=view.width;canvas.height=view.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   for(const box of boxes){
    if(box.x<8||box.y<8||box.x+box.width>view.width-8||box.y+box.height>view.height-8)throw Error('Label leaves sheet: '+box.text);
    if(box.screenHeight<11)throw Error('Label too small on phone: '+box.text);
    for(let y=Math.floor(box.y)-4;y<box.y+box.height+4;y++)for(let x=Math.floor(box.x)-4;x<box.x+box.width+4;x++)if(data[(y*canvas.width+x)*4+3]>40)throw Error('Label overlaps drawing: '+box.text);
   }
   return boxes.map(box=>({text:box.text,screenHeight:Math.round(box.screenHeight)}));
  });
  console.log('PASS labels:',layout);
 }
 await page.getByRole('button',{name:'Другой рисунок',exact:true}).tap();assert.equal(await page.locator('.drawing-card').count(),manifest.cards.length);
 const bounds=await page.locator('.drawing-card').evaluateAll(ns=>ns.map(n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right};}));assert(bounds.every(b=>b.left>=0&&b.right<=390));
 assert.deepEqual(errors,[]);console.log('PASS lesson:',{id,steps:lesson.steps.length,pencilChanges:changes,cards:manifest.cards.length,checks:'progressive contour/colour, pause, repeat, coloured outlines, saved resume, explicit finish, picker, mobile safe areas'});
}finally{await browser.close();}
