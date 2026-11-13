import { describe,it,expect } from 'vitest';
import { shapeDefinition,partPoint,transformPoint } from './shapes.js';
import { automaticGrid,practiceScene,shapeBounds } from './layout.js';
import { screenProfile,scaledProfile } from './trackProfile.js';
import { createShapeAttempt,restoreShape } from './shapeAttempt.js';
import { generateTasks } from '../engine.js';
const variant=(seed,angle=37,size=0)=>({schema:6,seed,angle,size,aspect:1,positionX:.9,positionY:.1});
describe('whole readable cubes',()=>{
 it('always has nine visible edges and equal projected edges, at every random size and angle',()=>{
  for(let seed=1;seed<=100;seed++){
   const s=shapeDefinition('parallelepiped',variant(seed,seed*3.6-180));expect(s.parts).toHaveLength(9);
   for(const part of s.parts)expect(part.travelLength).toBeCloseTo(s.volume.edge,8);
   expect(s.volume.separation/s.volume.edge).toBeCloseTo(Math.sqrt(3)/2,8);
  }
 });
 for(const input of ['pen','passive_pen','touch'])it(`${input}: keeps a readable size and at least 12 px between separate roads, enlarging a tight cell`,()=>{
  const profile=screenProfile(input),minimum=input==='pen'?160:input==='passive_pen'?200:240;
  for(const size of [{width:390,height:650},{width:820,height:984},{width:1180,height:806}])for(const angle of [-175,-120,-45,0,40,90,165])for(const seed of [2,42,90]){
   const v=variant(seed,angle),s=shapeDefinition('parallelepiped',v),grid=automaticGrid(size,input),scene=practiceScene(size,true,0,grid,s,v,profile),p=scene.placement,b=shapeBounds(s);
   expect(p.needsSpace).toBe(false);expect(Math.min(b.maxX-b.minX,b.maxY-b.minY)*p.scale).toBeGreaterThanOrEqual(minimum-1e-6);
   expect(s.volume.separation*p.scale-profile.width).toBeGreaterThanOrEqual(12-1e-6);
   expect(s.volume.edge*p.scale).toBeGreaterThanOrEqual(profile.width*2+16-1e-6);
   expect((b.maxX-b.minX)*p.scale+2*p.pad).toBeLessThanOrEqual(p.area.width+1e-6);
   expect((b.maxY-b.minY)*p.scale+2*p.pad).toBeLessThanOrEqual(p.area.height+1e-6);
  }
  const v=variant(42),s=shapeDefinition('parallelepiped',v),scene=practiceScene({width:820,height:984},true,0,{columns:3,rows:4},s,v,profile);
  if(input!=='pen')expect(scene.compact).toBe(true);
 });
 it('does not silently squeeze a cube below its minimum on an impossibly short screen',()=>{
  const s=shapeDefinition('parallelepiped',variant(42)),p=practiceScene({width:568,height:110},true,0,{columns:2,rows:2},s,s.variant,screenProfile('touch')).placement;
  expect(p.needsSpace).toBe(true);
 });
 it('completes once after all nine edges and restores the same whole geometry',()=>{
  const v=variant(42),s=shapeDefinition('parallelepiped',v),profile=screenProfile('passive_pen'),p=practiceScene({width:820,height:984},true,0,{columns:3,rows:4},s,v,profile).placement,a=createShapeAttempt('parallelepiped',undefined,scaledProfile(profile,p.scale),v);
  for(const[i,part]of s.parts.entries()){
   expect(a.begin(transformPoint(partPoint(part,0),part.frame))).toBe(true);a.move(transformPoint(partPoint(part,1),part.frame),1000);
   expect(a.end()).toBe(i===8);
  }
  expect(a.state.hadError).toBe(false);expect(restoreShape({version:3,attempt:a.state},'parallelepiped',v).done).toBe(true);
 });
 it('only enables whole volumes for a package which supports the rule',()=>{
  const bank=[{id:'line',conceptId:'line',firstLines:{kind:'short_line'}}],old={type:'drawing_first_lines',screenPractice:true,adaptiveSheet:true};
  const params={preciseSelection:true,exercises:['parallelepiped']};
  expect(generateTasks(old,bank,15,params).every(t=>t.variant.schema===5)).toBe(true);
  expect(generateTasks({...old,solidVolumes:true},bank,15,params).every(t=>t.variant.schema===6&&shapeDefinition(t.exerciseKind,t.variant).parts.length===9)).toBe(true);
 });
});
