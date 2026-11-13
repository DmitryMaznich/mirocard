import { describe,it,expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { SHAPE_KINDS,shapeDefinition,partPoint,partPrefix } from './shapes.js';
import { createShapeAttempt } from './shapeAttempt.js';
import ShapeDrawing from './ShapeDrawing.jsx';
const vertices=d=>[...d.matchAll(/[ML]([-+.0-9e]+) ([-+.0-9e]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
describe('demonstration uses a real path prefix instead of normalized SVG dashes',()=>{
 for(const kind of SHAPE_KINDS)it(`${kind}: the visible prefix grows to the target and ends exactly at the moving tip`,()=>{
  const shape=shapeDefinition(kind,{schema:5,seed:93,angle:-113,size:.8,positionX:.2,positionY:.9});
  for(const part of shape.parts){
   let previous=0;
   for(const f of [0,.001,.125,.5,.875,.999,1]){
    const path=partPrefix(part,f),points=vertices(path),tip=partPoint(part,f);
    const length=points.reduce((s,p,i)=>s+(i?Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y):0),0);
    expect(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
    expect(points.at(-1).x).toBeCloseTo(tip.x,8);expect(points.at(-1).y).toBeCloseTo(tip.y,8);
    expect(length).toBeGreaterThanOrEqual(previous);expect(length).toBeCloseTo(part.length*f,6);previous=length;
   }
  }
 });
 it('renders the shown part with no pathLength or dash offset and never draws another part',()=>{
  const variant={schema:5,seed:42,angle:17,size:.5},a=createShapeAttempt('parallelepiped',undefined,'normal',variant);
  const html=renderToStaticMarkup(createElement(ShapeDrawing,{state:a.state,demo:true,demoProgress:.5,demoPart:0}));
  expect(html.match(/class="first-lines__demo-line"/g)).toHaveLength(1);
  expect(html).not.toMatch(/pathLength|stroke-dashoffset|stroke-dasharray/i);
  expect(html).toContain(partPrefix(a.shape.parts[0],.5));
 });
});
