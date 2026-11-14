/* global document, DOMPoint, Path2D */
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const lesson=JSON.parse(await readFile(new URL('../lessons/snail.json',import.meta.url),'utf8'));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try {
  const page=await browser.newPage();
  console.log(await page.evaluate(lesson=>{
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');document.body.append(svg);
    let checks=0;const check=(ok,why)=>{if(!ok)throw Error(why);checks++;};
    const path=d=>{const p=document.createElementNS(ns,'path');p.setAttribute('d',d);svg.append(p);return p;};
    const outlines=title=>lesson.steps.find(s=>s.title===title).paths.map(path);
    const start=p=>p.getPointAtLength(0),end=p=>p.getPointAtLength(p.getTotalLength());
    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const on=(q,ps,title)=>{let best=Infinity;for(const p of ps)for(let d=0;d<=p.getTotalLength();d+=.04)best=Math.min(best,distance(q,p.getPointAtLength(d)));check(best<.08,title);};
    const shell=[...outlines('Левая дуга раковины'),...outlines('Правая дуга раковины')];
    check(distance(end(shell[0]),start(shell[1]))<.001,'Shell halves do not join');
    check(distance(end(shell[1]),start(shell[0]))<.001,'Shell is not closed');
    const tail=outlines('Заострённый хвостик'),lower=outlines('Нижняя линия тела'),head=outlines('Округлая голова и шея');
    on(start(tail[0]),shell,'Tail/shell root');on(end(lower[0]),shell,'Tail/shell bottom');
    check(distance(end(tail[0]),start(lower[0]))<.001,'Disconnected tail');
    check(distance(end(lower[0]),start(lower[1]))<.001,'Disconnected lower body');
    check(distance(end(lower[1]),start(head[0]))<.001,'Disconnected head/lower body');
    on(end(head[0]),shell,'Head/shell root');
    for(const title of ['Левый','Правый'])for(const part of ['первая','вторая']){
      const stalk=outlines(title+' стебелёк — '+part+' линия')[0];
      on(start(stalk),outlines(title+' глазок'),title+' eye/stalk join');
      on(end(stalk),head,title+' stalk/head join');
    }
    const spiral=['Большой виток спирали','Средний виток спирали','Маленький завиток в центре'].map(t=>outlines(t)[0]);
    on(start(spiral[0]),shell,'Spiral starts on the shell');
    check(distance(end(spiral[0]),start(spiral[1]))<.001,'First spiral break');
    check(distance(end(spiral[1]),start(spiral[2]))<.001,'Second spiral break');
    const regions=lesson.steps.filter(s=>s.kind==='color').map(s=>{
      const shape=path(s.d);shape.setAttribute('fill-rule','evenodd');const clip=s.clip?path(s.clip):null;
      return {...s,shape,inside:q=>shape.isPointInFill(q)&&(!clip||clip.isPointInFill(q))};
    });
    const get=t=>regions.find(s=>s.title===t);
    for(const s of regions){const b=s.shape.getBBox();let hit=false;for(let i=0;i<=50&&!hit;i++)for(let j=0;j<=50&&!hit;j++)hit=s.inside(new DOMPoint(b.x+b.width*i/50,b.y+b.height*j/50));check(hit,'Empty colour region '+s.title);}
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.lineWidth=1;ctx.lineCap='round';ctx.lineJoin='round';
    const black=lesson.steps.filter(s=>s.kind==='stroke'&&s.tool==='black').flatMap(s=>s.paths).map(d=>new Path2D(d));
    let boundarySamples=0;
    for(const region of regions.filter(s=>s.tool==='yellow'||s.tool==='pink'))for(let d=0;d<=region.shape.getTotalLength();d+=.5){
      const q=region.shape.getPointAtLength(d);boundarySamples++;
      check(black.some(p=>ctx.isPointInStroke(p,q.x,q.y)),'Unoutlined colour boundary '+region.title+' at '+q.x/2+','+q.y/2);
    }
    const body=get('Жёлтое тело и голова'),tailRegion=get('Жёлтый хвостик'),shellRegion=get('Розовая основа раковины');
    ctx.lineWidth=3.5;
    for(let x=231;x<=435;x+=2)for(let y=165;y<=249;y+=2){const q=new DOMPoint(x*2,y*2);if(shellRegion.inside(q)&&!black.some(p=>ctx.isPointInStroke(p,q.x,q.y)))check(!body.inside(q)&&!tailRegion.inside(q),'Visible body colour overlaps the shell at '+x+','+y);}
    for(const [index,cx,cy,title] of [[0,403.2,136.2,'левый'],[1,445.3,145.7,'правый']]){
      const pupil=get('Чёрный зрачок с бликами: '+title);
      check(!pupil.inside(new DOMPoint((cx+1)*2,(cy+1.7)*2)),'Pupil reflection painted black');
      const ring=get('Жёлтая окантовка глазка '+(index+1));
      check(!ring.inside(new DOMPoint(cx*2,cy*2)),'Yellow covers the pupil');
    }
    ctx.lineWidth=2;
    let rays=0;
    for(const step of lesson.steps.filter(s=>s.title.startsWith('Фиолетовые лучики')))for(const d of step.paths){
      const p=path(d);rays++;
      for(let v=0;v<=p.getTotalLength();v+=1){const q=p.getPointAtLength(v);check(shellRegion.inside(q),'Ray leaves shell');check(!black.some(ink=>ctx.isPointInStroke(ink,q.x,q.y)),'Ray crosses a black spiral turn');}
    }
    for(const step of lesson.steps.filter(s=>s.kind==='stroke'))for(const d of step.paths){check(d.match(/M /g)?.length===1,'Disconnected movements in '+step.title);check(path(d).getTotalLength()>1,'Empty stroke '+step.title);}
    return {checks,boundarySamples,rays,result:'Continuous shell/spiral; four stalk joins; outlined colour regions; no shell/body overlaps; white reflections; hatching stays between turns'};
  },lesson));
} finally {await browser.close();}
