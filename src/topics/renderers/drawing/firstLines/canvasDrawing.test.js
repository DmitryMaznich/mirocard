import { describe,it,expect } from 'vitest';
import { backingSize,CANVAS_OPTIONS,paintFrame,drawingMarkers,cameraTransform,clientFromWorld } from './canvasDrawing.js';
import { recordingContext } from './canvasTestContext.js';
import { shapeDefinition,SHAPE_KINDS,partPoint,transformPoint } from './shapes.js';
import { createShapeAttempt } from './shapeAttempt.js';
import { fitShape } from './layout.js';
import { screenProfile,scaledProfile } from './trackProfile.js';
describe('software raster workspace',()=>{
 it('requests an opaque CPU/readback context, without a desynchronized front buffer',()=>{
  expect(CANVAS_OPTIONS).toEqual({alpha:false,willReadFrequently:true,desynchronized:false});
  for(const width of [320,820,1180,2560])for(const height of [200,650,1000,2160])for(const dpr of [1,2,3,4]){
   const b=backingSize(width,height,dpr);expect(b.width).toBeLessThanOrEqual(2048);expect(b.height).toBeLessThanOrEqual(2048);expect(b.width*b.height).toBeLessThanOrEqual(4003000);
  }
 });
 it('maps the same camera into client coordinates and paints an opaque full frame first',()=>{
  const rect={left:10,top:20,width:800,height:600},view={x:1000,y:600,width:800,height:600},p={tx:900,ty:500,scale:.5};
  const c=cameraTransform(800,600,view),q=clientFromWorld({x:400,y:600},rect,view,p);expect(c).toEqual({x:-1000,y:-600,scale:1});expect(q).toEqual({x:110,y:220});
  const ctx=recordingContext({width:1600,height:1200});paintFrame(ctx,{width:800,height:600,ratio:2,view,drawings:[]});
  expect(ctx.calls[0]).toMatchObject({name:'setTransform',args:[1,0,0,1,0,0]});expect(ctx.calls[1]).toMatchObject({name:'fillRect',args:[0,0,1600,1200],alpha:1,fill:'#fafbf7'});
 });
 for(const kind of SHAPE_KINDS)it(`${kind}: paints every guide before the real trace and uses finite native 2D commands`,()=>{
  const v={schema:kind==='parallelepiped'?6:5,seed:42,angle:37,size:.6},shape=shapeDefinition(kind,v),profile=screenProfile('passive_pen'),placement=fitShape(shape,{x:0,y:0,width:800,height:700},v,profile),a=createShapeAttempt(kind,undefined,scaledProfile(profile,placement.scale),v),part=shape.parts[0];
  a.begin(transformPoint(partPoint(part,0),part.frame));for(let n=1;n<=60;n++)a.move(transformPoint(partPoint(part,.3*n/60),part.frame),n*20);a.end();
  const ctx=recordingContext();paintFrame(ctx,{width:1000,height:1000,ratio:1,view:{x:0,y:0,width:1000,height:1000},drawings:[{state:a.state,shape,placement,profile:a.state.profile}]});
  const strokes=ctx.calls.filter(c=>c.name==='stroke'),lastGuide=strokes.findLastIndex(c=>c.stroke==='#dbebe0'),firstInk=strokes.findIndex(c=>c.stroke==='#315b86');
  expect(strokes.filter(c=>c.stroke==='#dbebe0')).toHaveLength(shape.parts.length);expect(firstInk).toBeGreaterThan(lastGuide);
  expect(ctx.calls.every(c=>c.args.every(n=>typeof n!=='number'||Number.isFinite(n)))).toBe(true);
  expect(strokes.some(c=>c.stroke==='#8153b5')).toBe(true);expect(ctx.calls.some(c=>c.name==='fill'&&c.fill==='#0ba85b')).toBe(true);
 });
 it('keeps a closed figure start dot inside its hollow finish ring',()=>{
  const a=createShapeAttempt('circle'),m=drawingMarkers(a.state,a.shape,a.state.profile);expect(m.start.x).toBeCloseTo(m.finish.x,8);expect(m.start.y).toBeCloseTo(m.finish.y,8);expect(m.goalRadius).toBeGreaterThan(m.radius);
 });
 it('paints failed history calmly, preserves the true trace and can paint the model without touching scoring',()=>{
  const a=createShapeAttempt('short_line');a.begin({x:320,y:500});a.move({x:450,y:700},500);a.end();const before=JSON.stringify(a.state),ctx=recordingContext();
  paintFrame(ctx,{width:1000,height:1000,ratio:1,view:{x:0,y:0,width:1000,height:1000},drawings:[{state:a.state,shape:a.shape,placement:{tx:0,ty:0,scale:1},profile:a.state.profile,demo:true,demoProgress:.5}]});
  expect(ctx.calls.some(c=>c.name==='stroke'&&c.stroke==='#a56e31'&&c.alpha<.3)).toBe(true);expect(JSON.stringify(a.state)).toBe(before);
 });
});
