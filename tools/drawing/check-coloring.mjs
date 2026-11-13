/* global window, document, PointerEvent, requestAnimationFrame */
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const output='output/drawing-coloring';await mkdir(output,{recursive:true});
const errors=[];
async function ready(page,url){await page.goto(url);await page.locator('.coloring[data-phase="trace"]').waitFor();await page.waitForFunction(()=>document.querySelector('.coloring__board')?.width>100);}
async function snapshot(page){return page.evaluate(()=>{const key=Object.keys(localStorage).filter(k=>k.startsWith('drawing-coloring:')).at(-1);return {key,...JSON.parse(localStorage.getItem(key))};});}
async function gesture(page,points,pointerType='pen',frameByFrame=false){
  await page.evaluate(async({points,pointerType,frameByFrame})=>{
    const board=document.querySelector('.coloring__board'),r=board.getBoundingClientRect(),view=JSON.parse(board.dataset.view);
    const scale=Math.min(r.width/view.width,r.height/view.height);
    const send=(type,p)=>board.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,buttons:type==='pointerup'?0:1,pointerType,pointerId:1,
      clientX:r.left+(r.width-view.width*scale)/2+(p.x-view.x)*scale,clientY:r.top+(r.height-view.height*scale)/2+(p.y-view.y)*scale}));
    send('pointerdown',points[0]);
    if(frameByFrame)await new Promise(requestAnimationFrame);
    for(const p of points.slice(1)){
      send('pointermove',p);
      if(frameByFrame){
        // Repaint SessionScreen between real input frames. Replacing only the
        // params object's identity must not end the held stroke.
        window.previewStore.setState({students:[...window.previewStore.getState().students]});
        await new Promise(requestAnimationFrame);
      }
    }
    send('pointerup',points.at(-1));
    await new Promise(requestAnimationFrame);
  },{points,pointerType,frameByFrame});
}
try {
  const page=await browser.newPage({viewport:{width:1180,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('fetch')&&!m.text().includes('404')&&!m.text().includes('503'))errors.push(m.text());});
  await ready(page,'http://localhost:8080/tools/drawing/first-lines-preview.html?fresh&coloring&noVideo&figures=basic');
  let saved=await snapshot(page);assert(saved.sheet.shapes.length>1);
  await page.screenshot({path:`${output}/tablet-start.png`});
  const first=saved.sheet.shapes[0];
  const center=await page.evaluate(async points=>{const b=(await import('/src/topics/renderers/drawing/coloring/geometry.js')).bounds(points);return {x:b.x+b.width/2,y:b.y+b.height/2};},first.points);
  await gesture(page,[first.points[0],center]);
  saved=await snapshot(page);assert.equal(saved.progress.shapes[0].phase,'trace');assert.deepEqual(saved.progress.shapes[0].outline,[]);assert.deepEqual(saved.progress.shapes[0].traceHits,[]);
  await page.reload();await page.locator('.coloring[data-phase="trace"]').waitFor();
  await gesture(page,[...first.points,first.points[0]],'pen',true);
  await page.locator('.coloring[data-phase="fill"]').waitFor();
  saved=await snapshot(page);assert.equal(saved.progress.shapes[0].filled.length,0);
  // Fill the first real random figure with closely spaced short horizontal strokes.
  const strokes=await page.evaluate(async(points)=>{
    const {inside,contourDistance,bounds}=await import('/src/topics/renderers/drawing/coloring/geometry.js');const b=bounds(points),result=[];
    for(let y=b.y+2;y<b.y+b.height;y+=4){let run=[];
      for(let x=b.x;x<=b.x+b.width+2;x+=3){const p={x,y};if(inside(p,points)&&contourDistance(p,points)>2)run.push(p);else if(run.length){result.push(run);run=[];}}
      if(run.length)result.push(run);
    }return result;
  },first.points);
  for(const [i,stroke] of strokes.entries()){if(await page.locator('.coloring').getAttribute('data-phase')==='done')break;await gesture(page,stroke,'pen',i<6);}
  assert.equal(await page.locator('.coloring').getAttribute('data-phase'),'done');
  saved=await snapshot(page);assert(saved.progress.shapes[0].filled.length>0);
  await page.screenshot({path:`${output}/tablet-first-done.png`});
  await page.getByRole('button',{name:'Следующая фигура'}).click();
  const second=(await snapshot(page)).sheet.shapes[1];await gesture(page,[...second.points,second.points[0]]);
  await page.locator('.coloring[data-phase="fill"]').waitFor();
  const keptOutline=(await snapshot(page)).progress.shapes[1].outline;
  const b=await page.evaluate(async points=>(await import('/src/topics/renderers/drawing/coloring/geometry.js')).bounds(points),second.points);
  await gesture(page,[{x:b.x+b.width/2,y:b.y+b.height/2},{x:b.x+b.width+70,y:b.y+b.height/2}]);
  saved=await snapshot(page);assert(saved.progress.hadError);const preserved=saved.progress.shapes[1].filled.length;assert.equal(preserved,0);assert.deepEqual(saved.progress.shapes[1].ink,[]);assert.deepEqual(saved.progress.shapes[1].outline,keptOutline);assert.equal(saved.progress.shapes[0].phase,'done');
  await page.reload();await page.locator('.coloring[data-phase="fill"]').waitFor();
  assert.equal((await snapshot(page)).progress.shapes[1].filled.length,preserved);
  // Complete a checkpoint to exercise actual session advancement and the 15-sheet loop.
  const originalSeed=await page.evaluate(()=>window.previewStore.getState().activeSessionSnapshot.sessionState.tasks[0].seed);
  await page.addInitScript(()=>{if(sessionStorage.getItem('complete-coloring')!=='yes')return;sessionStorage.removeItem('complete-coloring');for(const key of Object.keys(localStorage).filter(k=>k.startsWith('drawing-coloring:'))){const s=JSON.parse(localStorage.getItem(key));s.progress.index=s.sheet.shapes.length-1;s.progress.shapes.forEach(p=>p.phase='done');localStorage.setItem(key,JSON.stringify(s));}});
  for(let round=0;round<16;round++){
    await page.evaluate(()=>sessionStorage.setItem('complete-coloring','yes'));
    await page.reload();await page.getByRole('button',{name:'Следующий лист'}).waitFor();
    await page.getByRole('button',{name:'Следующий лист'}).click();await page.locator('.coloring[data-phase="trace"]').waitFor();
  }
  assert.notEqual(await page.evaluate(()=>window.previewStore.getState().activeSessionSnapshot.sessionState.tasks[0].seed),originalSeed);
  await page.close();
  const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});phone.on('pageerror',e=>errors.push(e.message));
  await ready(phone,'http://localhost:8080/tools/drawing/first-lines-preview.html?fresh&coloring&touch&noVideo&figures=paths');
  saved=await snapshot(phone);assert(saved.sheet.shapes.every(s=>s.kind.endsWith('_path')));
  await phone.screenshot({path:`${output}/phone-road.png`});
  await gesture(phone,[...saved.sheet.shapes[0].points,saved.sheet.shapes[0].points[0]],'touch');
  await phone.locator('.coloring[data-phase="fill"]').waitFor();
  await phone.getByRole('button',{name:'Весь лист',exact:true}).click();await phone.screenshot({path:`${output}/phone-overview.png`});
  await phone.getByRole('button',{name:'К фигуре'}).click();
  await phone.setViewportSize({width:844,height:390});
  assert.equal((await snapshot(phone)).progress.shapes[0].phase,'fill');
  await phone.screenshot({path:`${output}/phone-rotated.png`});
  assert.deepEqual(errors,[]);console.log('Coloring: separate input frames and parent updates, real ZIP, trace/fill, failure, reload, 16 sheets, regenerated loop, phone paths, overview and rotation passed.');
} finally {await browser.close();}
