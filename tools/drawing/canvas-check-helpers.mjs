/* global window,document,requestAnimationFrame */
import { expect } from '@playwright/test';
import { shapeDefinition,partPoint,transformPoint } from '../../src/topics/renderers/drawing/firstLines/shapes.js';
export const state=p=>p.evaluate(()=>window.previewStore.getState().activeSessionSnapshot.sessionState);
export const task=async p=>{const s=await state(p);return s.tasks[s.taskIndex];};
export async function settle(p){
 await p.locator('canvas.first-lines__board[data-render-status="ready"]').waitFor();await p.evaluate(()=>document.fonts.ready);
 await expect.poll(()=>p.locator('.first-lines__board').getAttribute('data-frame')).not.toBeNull();
 await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
}
export async function points(p,part,fractions){
 const world=fractions.map(f=>transformPoint(partPoint(part,f),part.frame));
 return p.locator('.first-lines__board').evaluate((canvas,points)=>{
  const {view,placement}=JSON.parse(canvas.dataset.camera),r=canvas.getBoundingClientRect(),scale=Math.min(r.width/view.width,r.height/view.height);
  return points.map(p=>({x:r.left+(r.width-view.width*scale)/2+(placement.tx+p.x*placement.scale-view.x)*scale,y:r.top+(r.height-view.height*scale)/2+(placement.ty+p.y*placement.scale-view.y)*scale}));
 },world);
}
export async function mouseStroke(p,xy){await p.mouse.move(xy[0].x,xy[0].y);await p.mouse.down();for(const q of xy.slice(1))await p.mouse.move(q.x,q.y);await p.mouse.up();}
export async function draw(p,{touch=false,context}={}){
 const t=await task(p),shape=shapeDefinition(t.exerciseKind,t.variant);
 for(const part of shape.parts){
  const xy=await points(p,part,Array.from({length:part.type==='line'?12:121},(_,n)=>n/(part.type==='line'?11:120)));
  if(touch){const cdp=await context.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...xy[0],radiusX:4,radiusY:4,force:.1}]});for(const q of xy.slice(1))await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...q,radiusX:4,radiusY:4,force:.1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else await mouseStroke(p,xy);
 }
 await settle(p);
}
export async function pixels(p){
 return p.locator('.first-lines__board').evaluate(canvas=>{
  const ctx=canvas.getContext('2d'),rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;let blue=0,green=0,purple=0;let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let i=0;i<rgba.length;i+=4){const r=rgba[i],g=rgba[i+1],b=rgba[i+2];if(b>r+25&&b>g+15&&r<120&&g<160&&b>90){blue++;const n=i/4,x=n%canvas.width,y=Math.floor(n/canvas.width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(g>r+45&&g>b+20)green++;if(r>100&&r<180&&b>r+25&&b>g+40)purple++;}
  return{blue,green,purple,bounds:blue?{minX,maxX,minY,maxY}:null,width:canvas.width,height:canvas.height,attributes:ctx.getContextAttributes(),camera:JSON.parse(canvas.dataset.camera)};
 });
}
export async function checkpoint(p){const t=await task(p);return p.evaluate(id=>{const key=Object.keys(localStorage).find(k=>k.startsWith('drawing-first-lines:')&&k.endsWith(':'+id));return key?JSON.parse(localStorage.getItem(key)).attempt:null;},t.id);}
export async function next(p){const i=(await state(p)).taskIndex;await p.getByRole('button',{name:'Следующее задание'}).click();await expect.poll(async()=>(await state(p)).taskIndex).toBe(i+1);await settle(p);}
