/* global document, Image, Path2D */
// Independent comparison after undoing each lesson's object layout transform.
// Supply the original, unscaled 854×480 video frame at 158 seconds.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
if(!process.argv[2])throw Error('Supply the 854×480 original frame at 158 seconds');
const lessons=await Promise.all(['sun_earth_moon','jupiter_saturn'].map(async id=>JSON.parse(await readFile(new URL(`../lessons/${id}.json`,import.meta.url),'utf8'))));
const picture='data:image/png;base64,'+(await readFile(process.argv[2])).toString('base64');
const repair=process.env.SOLAR_OCCLUSION_FRAME?'data:image/png;base64,'+(await readFile(process.env.SOLAR_OCCLUSION_FRAME)).toString('base64'):null;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
try{
 const page=await browser.newPage();
 const report=await page.evaluate(async({lessons,picture,repair})=>{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=picture;});
  const width=854,height=480,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
  if(repair){const alternate=new Image();await new Promise((resolve,reject)=>{alternate.onload=resolve;alternate.onerror=reject;alternate.src=repair;});ctx.drawImage(alternate,629,349,31,30,629,349,31,30);}
  const pixels=ctx.getImageData(0,0,width,height).data;
  const source=new Uint8Array(width*height);for(let i=0;i<source.length;i++)source[i]=Math.max(pixels[i*4],pixels[i*4+1],pixels[i*4+2])<160?1:0;
  const offsets=[];for(let y=-12;y<=12;y++)for(let x=-12;x<=12;x++)offsets.push([x,y,Math.hypot(x,y)]);offsets.sort((a,b)=>a[2]-b[2]);
  const nearest=(mask,x,y)=>{x=Math.round(x);y=Math.round(y);for(const[dx,dy,d]of offsets)if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height&&mask[(y+dy)*width+x+dx])return d;return 20;};
  const stats=vs=>{vs.sort((a,b)=>a-b);return {samples:vs.length,p95:vs[Math.floor((vs.length-1)*.95)],max:vs.at(-1)};};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');document.body.append(svg);
  ctx.fillStyle='white';ctx.fillRect(0,0,width,height);ctx.strokeStyle='black';ctx.lineCap='round';ctx.lineJoin='round';
  const movements=[],objects=[];
  for(const lesson of lessons){
   objects.push(...lesson.source.objects);
   for(const step of lesson.steps.filter(s=>s.kind==='stroke'&&s.tool==='black')){
    const object=lesson.source.objects.find(o=>o.id===step.referenceObject);const scale=object.scale;
    const values=[],outliers=[];
    for(const d of step.paths){
     const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',d);svg.append(p);
     for(let length=0;length<=p.getTotalLength();length+=.6){
      const q=p.getPointAtLength(length),x=object.sourceCenter[0]+(q.x/2-object.targetCenter[0])/scale,y=object.sourceCenter[1]+(q.y/2-object.targetCenter[1])/scale;
      const delta=nearest(source,x,y);values.push(delta);if(delta>2)outliers.push([+x.toFixed(2),+y.toFixed(2),+delta.toFixed(2)]);
     }
     ctx.save();ctx.setTransform(1/(2*scale),0,0,1/(2*scale),object.sourceCenter[0]-object.targetCenter[0]/scale,object.sourceCenter[1]-object.targetCenter[1]/scale);ctx.lineWidth=3.5;ctx.stroke(new Path2D(d));ctx.restore();
    }
    movements.push({lesson:lesson.id,title:step.title,...stats(values),outliers:outliers.filter((_,i)=>i%5===0).slice(0,20)});
   }
  }
  const drawn=ctx.getImageData(0,0,width,height).data,vector=new Uint8Array(source.length);for(let i=0;i<vector.length;i++)vector[i]=drawn[i*4]<160?1:0;
  const coverage={};
  for(const object of objects){
   const[x0,y0,x1,y1]=object.sourceBounds,values=[],misses=[];
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    if(object.id==='sun'&&Math.hypot(x-289.8,y-159.3)>130)continue;
    if(object.id==='sun'&&Math.hypot(x-420,y-315)<77)continue; // unused lower planet
    if(object.id==='earth'&&Math.hypot(x-480.6,y-145.9)>74)continue;
    if(object.id==='saturn'){
     const dx=x-583,dy=y-341,u=.819152*dx-.573576*dy,v=.573576*dx+.819152*dy;
     if((u/148)**2+(v/45)**2>1.1&&(dx/75)**2+(dy/75)**2>1.1)continue;
     // The adaptation hides the original globe line under the front rings.
     if(y+.7*x>750&&Math.abs(Math.hypot(dx,dy)-68)<3)continue;
    }
    if(source[y*width+x]){const delta=nearest(vector,x,y);values.push(delta);if(delta>3.1)misses.push([x,y,delta]);}
   }
   coverage[object.id]={...stats(values),misses:misses.filter((_,i)=>i%5===0).slice(0,30)};
  }
  return {movements,coverage};
 },{lessons,picture,repair});
 if(process.env.SOLAR_REFERENCE_REPORT)await writeFile(process.env.SOLAR_REFERENCE_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 if(process.argv.includes('--check')){
  for(const movement of report.movements){assert(movement.p95<=1.5,movement.title+': reference deviation');assert(movement.max<=(movement.title.includes('Сатурна')?4.1:3.1),movement.title+': stray line');}
  for(const[name,coverage]of Object.entries(report.coverage)){assert(coverage.p95<=2.1,name+': missing reference strokes');assert(coverage.max<=(name==='sun'?8.5:5.1),name+': missing detail');}
 }
}finally{await browser.close();}
