/* global document, DOMPoint */
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const lesson=JSON.parse(await readFile(new URL('../lessons/donkey.json',import.meta.url),'utf8'));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try{
 const page=await browser.newPage();
 console.log(await page.evaluate(lesson=>{
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');document.body.append(svg);
  let checks=0;const check=(ok,why)=>{if(!ok)throw Error(why);checks++;};
  const path=(d,rule='nonzero')=>{const p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('fill-rule',rule);svg.append(p);return p;};
  const stroke=title=>lesson.steps.find(s=>s.title===title).paths.map(d=>path(d));
  const head=stroke('Голова ослика')[0],body=stroke('Овальное туловище')[0];
  const start=p=>p.getPointAtLength(0),end=p=>p.getPointAtLength(p.getTotalLength());
  const on=(q,p,title)=>{let best=Infinity;const length=p.getTotalLength();for(let d=0;d<=length;d+=.05){const r=p.getPointAtLength(d);best=Math.min(best,Math.hypot(q.x-r.x,q.y-r.y));}check(best<.035,title);};
  for(const p of stroke('Две линии шеи')){on(start(p),head,'Neck/head junction');on(end(p),body,'Neck/body junction');}
  for(const title of ['Верхнее длинное ухо','Второе длинное ухо','Линия мордочки']){const p=stroke(title)[0];on(start(p),head,title+' start');on(end(p),head,title+' end');}
  const legs=['Левая дальняя ножка','Левая ближняя ножка','Правая ближняя ножка','Правая дальняя ножка'].map(title=>stroke(title)[0]);
  for(const p of legs){on(start(p),body,'Leg/body start');on(end(p),body,'Leg/body end');}
  stroke('Четыре копытца').forEach((p,i)=>{on(start(p),legs[i],'Hoof left boundary');on(end(p),legs[i],'Hoof right boundary');});
  on(start(stroke('Хвост с кисточкой')[0]),body,'Tail/body junction');
  const colours=lesson.steps.filter(s=>s.kind==='color').map(s=>({...s,shape:path(s.d,'evenodd'),clipShape:s.clip?path(s.clip):null}));
  const inside=(s,x,y)=>{const q=new DOMPoint(x*2,y*2);return s.shape.isPointInFill(q)&&(!s.clipShape||s.clipShape.isPointInFill(q));};
  const get=t=>colours.find(s=>s.title===t);
  check(!inside(get('Серая часть головы'),297,115),'Eye must stay white');
  check(!inside(get('Серая часть головы'),254,144),'Gray covers muzzle');
  check(inside(get('Жёлтая мордочка'),254,144),'Missing yellow muzzle');
  check(!inside(get('Жёлтая мордочка'),251,133),'Muzzle paints nostril');
  check(inside(get('Серая шея'),313,159),'Missing neck');
  check(inside(get('Серое ухо 1'),340,75),'Missing upper ear');check(inside(get('Серое ухо 2'),365,109),'Missing rear ear');
  const greys=[[294,245],[319,247],[373,250],[399,235]],hooves=[[293,264],[319,267],[374,266],[401,250]];
  for(let i=0;i<4;i++){
   check(inside(get('Серая ножка '+(i+1)),...greys[i]),'Missing upper leg '+i);
   check(inside(get('Коричневое копытце '+(i+1)),...hooves[i]),'Missing hoof '+i);
   check(!inside(get('Зелёная травка'),...hooves[i]),'Grass paints hoof '+i);
  }
  for(const s of colours){const b=s.shape.getBBox();let hit=false;for(let i=0;i<=35&&!hit;i++)for(let j=0;j<=35&&!hit;j++)hit=inside(s,(b.x+b.width*i/35)/2,(b.y+b.height*j/35)/2);check(hit,'Empty colour region '+s.title);}
  for(const s of lesson.steps.filter(s=>s.kind==='stroke'))for(const d of s.paths){check(d.match(/M /g).length===1,'Disconnected subpaths');check(path(d).getTotalLength()>2,'Empty stroke');}
  return {checks,message:'Head/ear/neck/leg/hoof joins, white eye and muzzle masks, four legs and grass occlusion verified'};
 },lesson));
}finally{await browser.close();}
