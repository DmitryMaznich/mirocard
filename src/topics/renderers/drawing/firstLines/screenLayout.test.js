import { describe,expect,it } from 'vitest';
import { generateTasks } from '../engine.js';
import { shapeDefinition,partPoint,transformPoint } from './shapes.js';
import { fitShape,screenScene,intoPlacement,fromPlacement } from './layout.js';
import { screenProfile,scaledProfile } from './trackProfile.js';
import { createShapeAttempt,restoreShape } from './shapeAttempt.js';
const bank=[{id:'line',conceptId:'line',firstLines:{kind:'short_line'}}],mode={type:'drawing_first_lines',screenPractice:true};
const variant=(seed,extra={})=>({schema:4,seed,scale:1,angle:37.2,aspect:1,size:.5,positionX:.1,positionY:.9,...extra});
const boundsOf=(shape,p)=>shape.parts.flatMap(part=>(part.type==='line'?[partPoint(part,0),partPoint(part,1)]:part.points.filter(q=>q.s<=part.length)).map(q=>intoPlacement(p,transformPoint(q,part.frame))));
describe('screen-sized procedural practice',()=>{
 for(const input of ['pen','touch'])for(const kind of ['short_line','circle','oval','rectangle','rhombus','arc','parallelepiped','zigzag','wave','zigzag_arc_zigzag'])it(`${kind}/${input}: fits every rotated/shifted target and its road inside the current device cell`,()=>{
  const profile=screenProfile(input);
  for(const size of [{width:320,height:380},{width:390,height:650},{width:844,height:150},{width:820,height:900},{width:1180,height:600}])for(const angle of [-173.3,-95.4,-20.7,37.2,142.8])for(const edge of [0,1]){
   const v=variant(63,{angle,size:edge,positionX:edge,positionY:1-edge}),shape=shapeDefinition(kind,v),scene=screenScene(size,true,3),area=scene.areas[3],p=fitShape(shape,area,v,profile);
   for(const q of boundsOf(shape,p)){expect(q.x-profile.width/2).toBeGreaterThanOrEqual(area.x-1e-7);expect(q.y-profile.width/2).toBeGreaterThanOrEqual(area.y-1e-7);expect(q.x+profile.width/2).toBeLessThanOrEqual(area.x+area.width+1e-7);expect(q.y+profile.width/2).toBeLessThanOrEqual(area.y+area.height+1e-7);}
   expect(scene.view.width/scene.view.height).toBeCloseTo(size.width/size.height,8);
   const q={x:340,y:510},back=fromPlacement(p,intoPlacement(p,q));expect(back.x).toBeCloseTo(q.x,8);expect(back.y).toBeCloseTo(q.y,8);
  }
 });
 it('shows 1,2,3 or all 4 rectangle sides, with a different starting side and generated dimensions',()=>{
  const counts=new Set(),lengths=new Set(),starts=new Set();
  for(let seed=1;seed<=120;seed++){
   const shape=shapeDefinition('rectangle',variant(seed)),first=shape.parts[0];counts.add(shape.parts.length);lengths.add(first.travelLength.toFixed(2));starts.add(first.frame.angle);
  }
  expect([...counts].sort()).toEqual([1,2,3,4]);expect(lengths.size).toBeGreaterThan(20);expect(starts.size).toBeGreaterThan(2);
 });
 it('stores arbitrary angles, normalized scale/offset and a reproducible generated contour, without paper breaks',()=>{
  const tasks=generateTasks(mode,bank,15,{workSurface:'sheet'});expect(tasks.every(t=>!t.breakBefore&&t.variant.schema===4)).toBe(true);
  expect(tasks.some(t=>t.variant.angle%90!==0)).toBe(true);expect(JSON.parse(JSON.stringify(tasks))).toEqual(tasks);
  const shape=shapeDefinition('rectangle',variant(82)),copy=shapeDefinition('rectangle',JSON.parse(JSON.stringify(shape.variant)));expect(copy).toEqual(shape);
  const area={x:0,y:0,width:500,height:360},profile=screenProfile('pen'),left=fitShape(shape,area,variant(82,{size:0,positionX:0,positionY:0}),profile),right=fitShape(shape,area,variant(82,{size:1,positionX:1,positionY:1}),profile);
  expect(right.scale).toBeGreaterThanOrEqual(left.scale);expect(left.tx).not.toBe(right.tx);
 });
 for(const kind of ['short_line','circle','rectangle','arc','zigzag_arc_zigzag'])for(const input of ['pen','touch'])it(`${kind}/${input}: accepts the generated fragment once, including its final shown side`,()=>{
  const v=variant(42),shape=shapeDefinition(kind,v),profile=screenProfile(input),p=fitShape(shape,{x:0,y:0,width:430,height:560},v,profile),a=createShapeAttempt(kind,undefined,scaledProfile(profile,p.scale),v);
  for(const[i,part]of shape.parts.entries()){
   expect(a.begin(transformPoint(partPoint(part,0),part.frame))).toBe(true);
   for(let n=1;n<=240;n++)a.move(transformPoint(partPoint(part,n/240),part.frame),n*20);
   expect(a.end()).toBe(i===shape.parts.length-1);
  }
  expect(a.state.hadError).toBe(false);expect(restoreShape({version:3,attempt:a.state},kind,v).done).toBe(true);
 });
});
