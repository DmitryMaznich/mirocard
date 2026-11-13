import { beforeEach,describe,it,expect } from 'vitest';
import { automaticGrid,screenScene,sheetPosition,fitShape,intoPlacement } from './layout.js';
import { shapeDefinition,SHAPE_KINDS,partPoint,transformPoint } from './shapes.js';
import { screenProfile,scaledProfile } from './trackProfile.js';
import { createShapeAttempt } from './shapeAttempt.js';
import { gridKey,readGrid,saveGrid,readSheet,saveSheet } from './checkpoint.js';
import { generateTasks } from '../engine.js';
const variant=(seed,angle=37)=>({schema:5,seed,angle,size:.1,positionX:.9,positionY:.1});
const world=(part,f)=>transformPoint(partPoint(part,f),part.frame);
beforeEach(()=>localStorage.clear());
describe('adaptive worksheets',()=>{
 it('fits more tasks on larger canvases while keeping larger cells for fingers',()=>{
  expect(automaticGrid({width:390,height:650})).toEqual({columns:2,rows:2});
  expect(automaticGrid({width:1180,height:806},'pen')).toEqual({columns:4,rows:3});
  expect(automaticGrid({width:820,height:984},'passive_pen')).toEqual({columns:3,rows:4});
  expect(automaticGrid({width:820,height:900},'touch')).toEqual({columns:2,rows:3});
 });
 it('keeps task identities and all completed work beyond the fourth cell across reload/rotation',()=>{
  const key=gridKey('kid','session'),grid=automaticGrid({width:1180,height:806},'passive_pen');saveGrid(key,grid);
  const saved=readGrid(key),task={number:11,autoSheet:true},position=sheetPosition(task,saved);
  expect(position).toEqual({page:0,slot:10,capacity:12});
  const a=createShapeAttempt('short_line',undefined,screenProfile('pen'),variant(11));a.begin(world(a.shape.parts[0],0));a.move(world(a.shape.parts[0],1),1000);expect(a.end()).toBe(true);
  saveSheet('page',10,a.state,12);saveSheet('page',0,a.state,12);
  expect(readSheet('page',12)[10]).toEqual(a.state);expect(readSheet('page',12).filter(Boolean)).toHaveLength(2);
  for(const size of [{width:820,height:984},{width:390,height:650},{width:1180,height:806}]){
   const scene=screenScene(size,true,position.slot,false,saved);expect(scene.areas).toHaveLength(12);expect(scene.view.width/scene.view.height).toBeCloseTo(size.width/size.height,8);
   expect(sheetPosition(task,readGrid(key))).toEqual(position);
  }
  expect(sheetPosition({number:13,autoSheet:true},saved)).toEqual({page:1,slot:0,capacity:12});
 });
 it('does not send new kinds, geometry or layouts to an older installed ZIP',()=>{
  const bank=[{id:'line',conceptId:'line',firstLines:{kind:'short_line'}}],old={type:'drawing_first_lines',screenPractice:true,params:{exercises:{values:['arc','wave','zigzag']}}};
  const tasks=generateTasks(old,bank,15,{practiceSet:'patterns'});expect(tasks.every(t=>['wave','zigzag'].includes(t.exerciseKind)&&t.variant.schema===4&&!t.autoSheet)).toBe(true);
  const next=generateTasks({...old,adaptiveSheet:true,params:{exercises:{values:['arc','wave','zigzag','fence']}}},bank,15,{practiceSet:'lines'});
  expect(next.every(t=>t.autoSheet&&t.variant.schema===5)).toBe(true);expect(new Set(next.map(t=>t.exerciseKind))).toEqual(new Set(['arc','wave','zigzag','fence']));
 });
 for(const input of ['pen','passive_pen','touch'])it(`${input}: generated targets and their roads fit every cell of an automatic grid`,()=>{
  const profile=screenProfile(input);
  for(const size of [{width:820,height:984},{width:1180,height:806}]){
   const grid=automaticGrid(size,input),scene=screenScene(size,true,0,false,grid);
   for(const [i,kind] of SHAPE_KINDS.entries())for(const seed of [4,29,80]){
    const v=variant(seed,seed*7-180),shape=shapeDefinition(kind,v),area=scene.areas[i%scene.areas.length],placement=fitShape(shape,area,v,profile);
    const points=shape.parts.flatMap(part=>Array.from({length:121},(_,n)=>intoPlacement(placement,world(part,n/120))));
    expect(Math.min(...points.map(p=>p.x))-profile.width/2).toBeGreaterThanOrEqual(area.x-1e-6);
    expect(Math.min(...points.map(p=>p.y))-profile.width/2).toBeGreaterThanOrEqual(area.y-1e-6);
    expect(Math.max(...points.map(p=>p.x))+profile.width/2).toBeLessThanOrEqual(area.x+area.width+1e-6);
    expect(Math.max(...points.map(p=>p.y))+profile.width/2).toBeLessThanOrEqual(area.y+area.height+1e-6);
   }
  }
 });
 for(const input of ['pen','passive_pen','touch'])for(const kind of ['fence','wave','zigzag','arc','semicircle'])it(`${kind}/${input}: completes the generated movement in a dense cell`,()=>{
  for(const seed of [4,29,80]){
   const v=variant(seed),profile=screenProfile(input),shape=shapeDefinition(kind,v),grid=automaticGrid({width:820,height:984},input),area=screenScene({width:820,height:984},true,0,false,grid).areas[0],placement=fitShape(shape,area,v,profile),attempt=createShapeAttempt(kind,undefined,scaledProfile(profile,placement.scale),v);
   expect(attempt.begin(world(shape.parts[0],0))).toBe(true);
   for(let n=1;n<=300;n++)attempt.move(world(shape.parts[0],n/300),n*20);
   expect(attempt.end()).toBe(true);expect(attempt.state.hadError).toBe(false);
  }
 });
 it('generates both directions of travel for arcs, at any whole-shape angle',()=>{
  const directions=new Set();
  for(let seed=1;seed<=64;seed++){
   const part=shapeDefinition('arc',variant(seed,0)).parts[0],a=part.points[0],b=part.points[1];
   directions.add(Math.sign((a.x-500)*(b.y-500)-(a.y-500)*(b.x-500)));
  }
  expect(directions).toEqual(new Set([-1,1]));
 });
});
