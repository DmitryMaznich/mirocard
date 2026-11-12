/* global document, Image */
// Compare visible black centreline geometry to an independent original video frame.
// Usage: CHROMIUM_PATH=/usr/bin/chromium node tools/drawing/authoring/compare-donkey-reference.mjs <frame.jpg> [output.png]
// The reference video/frame is deliberately not committed or shipped in the deck.
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const input = process.argv[2];
if (!input) throw Error('Supply the original unscaled 640×360 frame at about 102 seconds');
const source = JSON.parse(await readFile(process.env.DONKEY_LESSON_PATH ?? new URL('../lessons/donkey.json', import.meta.url), 'utf8'));
const picture = 'data:image/jpeg;base64,'+(await readFile(input)).toString('base64');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 1072 } });
  const result = await page.evaluate(async ({ source, picture }) => {
    const svgNS = 'http://www.w3.org/2000/svg';
    const load = url => new Promise((resolve,reject) => { const i=new Image(); i.onload=()=>resolve(i); i.onerror=reject; i.src=url; });
    const canvas = document.createElement('canvas'); canvas.width=640; canvas.height=360;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.drawImage(await load(picture),0,0);
    const pixels=ctx.getImageData(0,0,640,360).data;
    const mask=new Uint8Array(640*360);
    for(let y=48;y<279;y++)for(let x=225;x<450;x++){const i=y*640+x;mask[i]=Math.max(...pixels.slice(i*4,i*4+3))<120?1:0;}
    // Ignore isolated compression specks, retaining all real marker strokes.
    const seen=new Uint8Array(mask.length);
    for(let i=0;i<mask.length;i++)if(mask[i]&&!seen[i]){
      const component=[i];seen[i]=1;
      for(let n=0;n<component.length;n++){const at=component[n],x=at%640,y=Math.floor(at/640);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<640&&y+dy>=0&&y+dy<360){const q=at+dy*640+dx;if(mask[q]&&!seen[q]){seen[q]=1;component.push(q);}}}
      if(component.length<4)for(const q of component)mask[q]=0;
    }
    const offsets=[];for(let dy=-20;dy<=20;dy++)for(let dx=-20;dx<=20;dx++)offsets.push({dx,dy,d:Math.hypot(dx,dy)}); offsets.sort((a,b)=>a.d-b.d);
    const distance=(target,x,y)=>{x=Math.round(x);y=Math.round(y);for(const {dx,dy,d} of offsets)if(x+dx>=0&&x+dx<640&&y+dy>=0&&y+dy<360&&target[(y+dy)*640+x+dx])return d;return 30;};
    const stats = values => {values.sort((a,b)=>a-b);return {samples:values.length,mean:+(values.reduce((s,v)=>s+v,0)/values.length).toFixed(3),p95:values[Math.floor((values.length-1)*.95)],max:values.at(-1)};};
    const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','220 38 250 268');svg.setAttribute('width','1000');svg.setAttribute('height','1072');document.body.style.margin='0';document.body.append(svg);
    const img=document.createElementNS(svgNS,'image');img.setAttribute('href',picture);img.setAttribute('width','640');img.setAttribute('height','360');img.setAttribute('opacity','.45');svg.append(img);
    const group=document.createElementNS(svgNS,'g');group.setAttribute('transform','scale(.5)');group.setAttribute('fill','none');group.setAttribute('stroke','#d90040');group.setAttribute('stroke-width','1.4');group.setAttribute('stroke-linecap','round');group.setAttribute('stroke-linejoin','round');svg.append(group);
    const movements=[],drawn=[];
    for(const step of source.steps.filter(s=>s.kind==='stroke'&&s.tool==='black')){
      const distances=[],outliers=[];
      for(const d of step.paths){const p=document.createElementNS(svgNS,'path');p.setAttribute('d',d);group.append(p);drawn.push(d);const length=p.getTotalLength();
        for(let v=0;v<=length;v+=.6){const q=p.getPointAtLength(v);const d=distance(mask,q.x/2,q.y/2);distances.push(d);if(d>1.5)outliers.push([+(q.x/2).toFixed(2),+(q.y/2).toFixed(2),+d.toFixed(2)]);}}
      movements.push({title:step.title,...stats(distances),...(outliers.length?{outliers:outliers.filter((_,i)=>i%5===0).slice(0,20)}:{})});
    }
    const xml='<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="white"/><g transform="scale(.5)" stroke="black" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none">'+drawn.map(d=>`<path d="${d}"/>`).join('')+'</g><g transform="scale(.5)" fill="black" fill-rule="evenodd">'+source.steps.filter(s=>s.kind==='color'&&s.tool==='black').map(s=>`<path d="${s.d}"/>`).join('')+'</g></svg>';
    ctx.clearRect(0,0,640,360);ctx.drawImage(await load('data:image/svg+xml;base64,'+btoa(xml)),0,0);
    const ink=ctx.getImageData(0,0,640,360).data;const vector=new Uint8Array(mask.length);for(let i=0;i<vector.length;i++)vector[i]=ink[i*4]<160?1:0;
    const regions={head:[233,90,333,166],ears:[298,50,416,129],neck:[285,124,336,184],legs:[280,208,413,275],tail:[395,115,448,180],all:[225,48,450,279]};const coverage={};
    for(const [name,[x0,y0,x1,y1]]of Object.entries(regions)){const values=[];for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(mask[y*640+x])values.push(distance(vector,x,y));coverage[name]=stats(values);}
    return {movements,coverage};
  }, {source,picture});
  if(process.argv[3] && process.argv[3] !== '--check')await page.screenshot({path:process.argv[3]});
  console.log(JSON.stringify(result,null,2));
  if(process.argv.includes('--check')) {
    for(const movement of result.movements) {
      assert(movement.p95 <= 1, movement.title+': more than one reference pixel at the 95th percentile');
      assert(movement.max <= (movement.title === 'Хвост с кисточкой' ? 2.1 : 1.5), movement.title+': stray contour');
    }
    assert(result.coverage.all.p95 <= 2.01, 'Original marker stroke coverage diverges');
    assert(result.coverage.all.max <= 4.6, 'Missing original detail');
  }
  if(process.env.DONKEY_REFERENCE_REPORT)await writeFile(process.env.DONKEY_REFERENCE_REPORT,JSON.stringify(result,null,2)+'\n');
} finally { await browser.close(); }
