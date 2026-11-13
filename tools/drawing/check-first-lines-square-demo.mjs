/* global window, document, requestAnimationFrame */
import { chromium, expect } from '@playwright/test';
import { shapeDefinition, partPoint, transformPoint } from '../../src/topics/renderers/drawing/firstLines/shapes.js';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto(`${process.env.DRAWING_PREVIEW_URL||'http://127.0.0.1:8080'}/tools/drawing/first-lines-preview.html?fresh&exercises=square&noVideo`);
 await page.locator('.first-lines__board').waitFor();await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.clock.install();
 const task=await page.evaluate(()=>window.previewStore.getState().activeSessionSnapshot.sessionState.tasks[0]);
 for(const[i,part]of shapeDefinition('square',task.variant).parts.entries()){
  await page.getByRole('button',{name:'Показать движение',exact:true}).click();await page.clock.runFor(1500);
  await expect(page.locator('.first-lines__demo-line')).toHaveCount(1);await expect(page.locator('.first-lines__demo').locator('..')).toHaveAttribute('data-part',String(i));
  await expect(page.locator('.first-lines__demo-lift')).toHaveCount(1);
  if(!i)await page.screenshot({path:'output/first-lines/square-lift-demo.png'});
  const points=[partPoint(part,0),partPoint(part,1)].map(p=>transformPoint(p,part.frame));
  const xy=await page.locator('.first-lines__board').evaluate((svg,points)=>points.map(p=>{const a=svg.createSVGPoint();a.x=p.x;a.y=p.y;const b=a.matrixTransform(svg.getScreenCTM());return{x:b.x,y:b.y};}),points);
  await page.mouse.move(xy[0].x,xy[0].y);await page.mouse.down();await page.mouse.move(xy[1].x,xy[1].y,{steps:8});await expect(page.locator('.first-lines__cue')).toContainText('Подними стилус');await page.mouse.up();
  const state=await page.evaluate(()=>window.previewStore.getState().activeSessionSnapshot.sessionState);expect(state.incorrectCount).toBe(0);expect(state.correctCount).toBe(i===3?1:0);
 }
 console.log('Square: current-side-only model, explicit lift cue, immediate copy during demonstration and four sides/one credit passed.');
}finally{await browser.close();}
