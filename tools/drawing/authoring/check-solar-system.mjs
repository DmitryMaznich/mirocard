/* global document, DOMPoint, Path2D */
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const lessons=await Promise.all(['sun_earth_moon','jupiter_saturn'].map(async id=>JSON.parse(await readFile(new URL(`../lessons/${id}.json`,import.meta.url),'utf8'))));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try{
 const page=await browser.newPage();
 console.log(await page.evaluate(lessons=>{
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');document.body.append(svg);
  const path=d=>{const p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('fill-rule','evenodd');svg.append(p);return p;};
  let checks=0;const check=(ok,why)=>{if(!ok)throw Error(why);checks++;};
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=720;const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.lineWidth=3.5;ctx.lineCap='round';ctx.lineJoin='round';
  const all=[];
  for(const lesson of lessons){
   const colors=lesson.steps.filter(s=>s.kind==='color').map(s=>{
    const p=path(s.d),clip=s.clip?path(s.clip):null;
    return {...s,p,inside:q=>p.isPointInFill(q)&&(!clip||clip.isPointInFill(q))};
   });
   const strokes=lesson.steps.filter(s=>s.kind==='stroke');
   for(const step of strokes)for(const d of step.paths){
    const p=path(d),b=p.getBBox();check(d.match(/M /g)?.length===1,'Disconnected subpaths: '+step.title);check(p.getTotalLength()>1,'Empty line: '+step.title);
    check(b.x>=12&&b.y>=12&&b.x+b.width<=988&&b.y+b.height<=708,'Drawing clipped by the sheet: '+step.title);
   }
   for(const color of colors){
    const b=color.p.getBBox();let hit=false;
    for(let i=0;i<=60&&!hit;i++)for(let j=0;j<=60&&!hit;j++)hit=color.inside(new DOMPoint(b.x+b.width*i/60,b.y+b.height*j/60));
    check(hit,'Empty colouring step: '+color.title);
   }
   const footprints=[];
   for(const object of lesson.source.objects){
    ctx.clearRect(0,0,1000,720);
    for(const step of strokes.filter(s=>s.referenceObject===object.id))for(const d of step.paths)ctx.stroke(new Path2D(d));
    footprints.push({id:object.id,pixels:ctx.getImageData(0,0,1000,720).data});
   }
   for(let a=0;a<footprints.length;a++)for(let b=a+1;b<footprints.length;b++){
    let overlap=0;for(let i=3;i<footprints[a].pixels.length;i+=4)if(footprints[a].pixels[i]>40&&footprints[b].pixels[i]>40)overlap++;
    check(overlap===0,'Object outlines overlap: '+footprints[a].id+' / '+footprints[b].id);
   }
   all.push({lesson,colors,strokes});
  }
  const first=all[0],second=all[1];
  const get=(set,title)=>set.colors.find(c=>c.title===title);
  const black=first.strokes.flatMap(s=>s.paths).map(d=>new Path2D(d));
  const world=path(first.strokes.find(s=>s.title==='Круг Земли').paths[0]);
  const sea=get(first,'Синие океаны'),land=get(first,'Зелёные материки');
  for(let x=550;x<900;x+=2)for(let y=200;y<550;y+=2){
   const q=new DOMPoint(x,y);if(!world.isPointInFill(q)||black.some(p=>ctx.isPointInStroke(p,x,y)))continue;
   check(sea.inside(q)!==land.inside(q),'Earth has a white gap or overlapping land/ocean at '+x+','+y);
  }
  const sun=get(first,'Жёлтое Солнце'),flames=get(first,'Оранжевые лучи');
  const core=path(first.strokes.find(s=>s.title==='Круг Солнца').paths[0]);
  for(let x=50;x<490;x+=3)for(let y=130;y<610;y+=3){const q=new DOMPoint(x,y);if(core.isPointInFill(q)&&!ctx.isPointInStroke(new Path2D(core.getAttribute('d')),x,y))check(sun.inside(q)&&!flames.inside(q),'Orange paints the Sun core');}
  const gas=path(second.strokes.find(s=>s.title==='Круг Юпитера').paths[0]);
  for(const title of ['Красные полосы Юпитера','Красная середина пятна','Жёлтая окантовка пятна']){
   const region=get(second,title),b=region.p.getBBox();
   for(let x=b.x+.5;x<b.x+b.width;x+=2)for(let y=b.y+.5;y<b.y+b.height;y+=2){const q=new DOMPoint(x,y);if(region.inside(q))check(gas.isPointInFill(q),'Jupiter colour leaves globe: '+title);}
  }
  const ringColors=['Оранжевое наружное кольцо','Жёлтое среднее кольцо','Фиолетовое внутреннее кольцо'].map(t=>get(second,t));
  const ringInk=second.strokes.filter(s=>s.title.includes('кольца Сатурна')).flatMap(s=>s.paths).map(d=>new Path2D(d));
  for(let x=390;x<940;x+=2)for(let y=270;y<680;y+=2){
   if(ringInk.some(p=>ctx.isPointInStroke(p,x,y)))continue;
   const q=new DOMPoint(x,y);check(ringColors.filter(c=>c.inside(q)).length<=1,'Coloured ring bands overlap at '+x+','+y);
  }
  const saturn=second.lesson.source.objects.find(o=>o.id==='saturn');
  for(const p of [[644.95,296.69],[515.44,386.42]]){
   const q=new DOMPoint(2*(saturn.targetCenter[0]+(p[0]-saturn.sourceCenter[0])*saturn.scale),2*(saturn.targetCenter[1]+(p[1]-saturn.sourceCenter[1])*saturn.scale));
   check(!second.colors.some(c=>c.inside(q)),'The hole behind Saturn must stay white');
  }
  const crater=get(second,'Тёмные кратеры спутника'),moon=get(second,'Светло-серый спутник'),b=crater.p.getBBox();
  for(let x=b.x+.3;x<b.x+b.width;x+=2)for(let y=b.y+.3;y<b.y+b.height;y+=2){const q=new DOMPoint(x,y);if(crater.inside(q))check(!moon.inside(q),'Grey covers a dark crater');}
  return {checks,result:'Both layouts fit; objects are separate; Earth has complete coverage; ring bands do not overlap; ring holes stay white; craters stay black'};
 },lessons));
}finally{await browser.close();}
