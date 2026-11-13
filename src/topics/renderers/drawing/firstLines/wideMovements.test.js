import { afterEach,describe,it,expect,vi } from 'vitest';
import { generateTasks } from '../engine.js';
import { shapeDefinition,partPoint,transformPoint } from './shapes.js';
import { automaticGrid,practiceScene,shapeBounds } from './layout.js';
import { screenProfile,scaledProfile } from './trackProfile.js';
import { createShapeAttempt,restoreShape } from './shapeAttempt.js';
const bank=[{id:'line',conceptId:'line',firstLines:{kind:'short_line'}}];
const mode={type:'drawing_first_lines',screenPractice:true,adaptiveSheet:true,solidVolumes:true,wideMovements:true};
const kinds=['short_line','wave','zigzag','fence','arc'];
afterEach(()=>vi.unstubAllGlobals());
const tasksFor=(kind,input,w,h)=>{vi.stubGlobal('innerWidth',w);vi.stubGlobal('innerHeight',h);return generateTasks(mode,bank,15,{preciseSelection:true,exercises:[kind],inputMode:input,workSurface:'sheet'});};
describe('wide arm movements',()=>{
 it('mixes three wide tasks into a normal lesson without changing rewards or whole cubes',()=>{
  const tasks=generateTasks(mode,bank,15,{});expect(tasks).toHaveLength(15);expect(tasks.filter(t=>t.variant.schema===7)).toHaveLength(3);
  expect(tasks.filter(t=>t.exerciseKind==='parallelepiped').every(t=>t.variant.schema===6)).toBe(true);
  expect(new Set(tasks.map(t=>t.cardId))).toEqual(new Set(['line']));
  expect(tasks.every(t=>!t.breakBefore)).toBe(true);
  expect(generateTasks({...mode,wideMovements:false},bank,15,{}).some(t=>t.variant.schema===7)).toBe(false);
  expect(tasksFor('circle','pen',820,1180).some(t=>t.variant.schema===7)).toBe(false);
 });
 for(const input of ['pen','passive_pen','touch'])for(const kind of kinds)it(`${kind}/${input}: fills available width with safe endpoints and accepts the whole movement once`,()=>{
  for(const viewport of [{width:390,height:844},{width:844,height:390},{width:820,height:1180},{width:1180,height:900}]){
   const tasks=tasksFor(kind,input,viewport.width,viewport.height);expect(tasks.filter(t=>t.variant.schema===7)).toHaveLength(3);
   const task=tasks.find(t=>t.variant.schema===7),shape=shapeDefinition(kind,task.variant),profile=screenProfile(input);
   const size={width:viewport.width,height:viewport.height-(viewport.height<500?144:194)},grid=automaticGrid(size,input),scene=practiceScene(size,true,0,grid,shape,task.variant,profile),p=scene.placement,b=shapeBounds(shape);
   expect(scene.compact).toBe(true);expect((b.maxX-b.minX)*p.scale).toBeCloseTo(size.width-2*p.pad,5);
   expect((b.maxY-b.minY)*p.scale+2*p.pad).toBeLessThanOrEqual(size.height+1e-6);
   const a=createShapeAttempt(kind,undefined,scaledProfile(profile,p.scale),task.variant),part=shape.parts[0];
   expect(a.begin(transformPoint(partPoint(part,0),part.frame))).toBe(true);
   for(let n=1;n<=360;n++)a.move(transformPoint(partPoint(part,n/360),part.frame),n*20);
   expect(a.end()).toBe(true);expect(a.state.hadError).toBe(false);
   expect(restoreShape({version:3,attempt:a.state},kind,JSON.parse(JSON.stringify(task.variant))).done).toBe(true);
  }
 });
});
