/* global document */
// End-to-end verification for any authored lesson in the actual downloadable ZIP.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { chromium } from '@playwright/test';
const id=process.argv[2]??'donkey';
const descriptor=JSON.parse(await readFile(new URL('./topic.json',import.meta.url),'utf8'));
const zip=await JSZip.loadAsync(await readFile(new URL(`../../public/decks/drawing_v${descriptor.meta.version}.zip`,import.meta.url)));
const manifest=JSON.parse(await zip.file('topic.json').async('string'));
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
 assert.equal(await page.locator('.drawing-repeat').isDisabled(),true,'Start without legacy progress');
 await page.clock.install();
 await page.evaluate(()=>{document.querySelector('.preview-header').style.display='none';document.getElementById('root').style.height='100dvh';document.documentElement.style.setProperty('--app-safe-top','59px');document.documentElement.style.setProperty('--app-safe-bottom','34px');});
 const index=()=>page.evaluate(id=>JSON.parse(localStorage.getItem('drawing-progress:local:'+id))?.index??0,id);
 let changes=0;
 for(let i=1;i<=lesson.steps.length;i++){
  await page.locator('.drawing-next').tap();
  if(await page.locator('[role=status]').textContent()==='Подготовьте следующий карандаш'){changes++;await page.locator('.drawing-next').tap();}
  if(i===1){
   await page.clock.runFor(120);
   const path=page.locator('[data-layer=drawing] path').last();assert(Number(await path.evaluate(p=>p.style.strokeDashoffset))>0,'Contour must be progressive');
   await page.locator('.drawing-adult').focus();await page.keyboard.press('Enter');
   const before=await path.evaluate(p=>p.style.strokeDashoffset);await page.clock.runFor(1000);assert.equal(await path.evaluate(p=>p.style.strokeDashoffset),before,'Pause must freeze drawing');
   await page.getByRole('button',{name:'Закрыть настройки'}).tap();await page.clock.runFor(1000);assert.equal(await path.evaluate(p=>p.style.strokeDashoffset),before);
   await page.locator('.drawing-next').tap();
  }
  if(i===firstColour+1||lesson.steps[i-1].title==='Зелёная травка'){
   await page.clock.runFor(120);assert.equal(await index(),i-1,'Colour index advances only after animation');
   assert(await page.locator(`[data-layer=colors] [data-region="${i-1}"] g[visibility=hidden]`).count()>0,'Future pencil lines must remain hidden');
  }
  await page.clock.runFor(16000);assert.equal(await index(),i,'Step '+i);
  if(lesson.steps[i-1].title==='Зелёный контур травки'){
   assert.equal(await page.locator(`[data-layer=colors] [data-region="${i}"]`).count(),0,'Grass must still be uncoloured');
   await page.locator('.drawing-board svg').screenshot({path:`/workspace/${id}-grass-outline.png`});
  }
  if(lesson.steps[i-1].title==='Контур лепестков цветка'){
   const width=await page.locator('[data-layer=drawing] > path').last().evaluate(p=>p.getBoundingClientRect().width);
   assert(width>=36,'Flower contour should be readable on a phone');
  }
  if(i===blackEnd)await page.locator('.drawing-board svg').screenshot({path:`/workspace/${id}-outline.png`});
  const step=lesson.steps[i-1];
  if(step.kind==='stroke'&&step.tool!=='black'){
   const expected=await page.evaluate(colour=>{const e=document.createElement('div');e.style.color=colour;return e.style.color;},lesson.palette.find(t=>t.id===step.tool).color);
   const inks=await page.locator('[data-layer=drawing] > path').evaluateAll((ps,n)=>ps.slice(-n).map(p=>p.style.stroke),step.paths.length);
   assert(inks.every(ink=>ink===expected),'Wrong pencil for '+step.title);
  }
 }
 assert.equal(changes,lesson.palette.length-1);
 await page.locator('.drawing-repeat').tap();await page.clock.runFor(16000);assert.equal(await index(),lesson.steps.length);
 await page.reload();await page.locator('.drawing-card').filter({hasText:card.label}).tap();assert.equal(await index(),lesson.steps.length,'Saved progress');
 assert.equal(await page.locator('.drawing-top h2').textContent(),card.label,'Explicit finish required');await page.locator('.drawing-next').tap();
 assert.equal(await page.locator('.drawing-top h2').textContent(),'Рисунок готов');await page.locator('.drawing-board svg').screenshot({path:`/workspace/${id}-finished.png`});
 await page.getByRole('button',{name:'Рисунки',exact:true}).tap();assert.equal(await page.locator('.drawing-card').count(),manifest.cards.length);
 const bounds=await page.locator('.drawing-card').evaluateAll(ns=>ns.map(n=>{const b=n.getBoundingClientRect();return {left:b.left,right:b.right};}));assert(bounds.every(b=>b.left>=0&&b.right<=390));
 assert.deepEqual(errors,[]);console.log('PASS lesson:',{id,steps:lesson.steps.length,pencilChanges:changes,cards:manifest.cards.length,checks:'progressive contour/colour, pause, repeat, coloured outlines, saved resume, explicit finish, picker, mobile safe areas'});
}finally{await browser.close();}
