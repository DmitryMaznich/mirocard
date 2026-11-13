import { partPoint, transformPoint } from './shapes.js';
const boundsCache = new WeakMap();
export function shapeBounds(shape) {
  if(boundsCache.has(shape))return boundsCache.get(shape);
  const points=shape.parts.flatMap(part => (part.type==='line'?[partPoint(part,0),partPoint(part,1)]:part.points.filter(p=>p.s<=part.length)).map(p=>transformPoint(p,part.frame)));
  const result = points.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minY:Math.min(b.minY,p.y),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity});
  boundsCache.set(shape,result);return result;
}
export function fitShape(shape, area, variant, profile) {
  const bounds=shapeBounds(shape),pad=Math.min(Math.max(30,profile.width/2+profile.extra+6,profile.goalRadius+6),Math.min(area.width,area.height)*.28);
  const w=Math.max(1,bounds.maxX-bounds.minX),h=Math.max(1,bounds.maxY-bounds.minY);
  const maxScale=Math.max(.001,Math.min(Math.max(1,area.width-2*pad)/w,Math.max(1,area.height-2*pad)/h));
  const minFraction=Math.min(1,Math.max((variant?.schema??0)>=5 ? .6 : .45,Math.max((variant?.schema??0)>=5?96:72,profile.width*2)/((shape.parts.length===1&&shape.parts[0].type==='line'?Math.max(w,h):Math.min(w,h))*maxScale)));
  // A solid volume needs both a readable silhouette and clear gaps between its roads.
  const minScale=shape.volume?Math.max((profile.width+12)/shape.volume.separation,(profile.width*2+16)/shape.volume.edge,(profile.width>=50?240:profile.width>=20?200:160)/Math.min(w,h)):0;
  const size=[4,5,6,7].includes(variant?.schema)?variant.size:.75;
  const randomScale=variant?.schema===7?maxScale:shape.volume?minScale+(Math.min(maxScale,minScale*1.5)-minScale)*size:maxScale*(minFraction+(1-minFraction)*size);
  const scale=Math.min(maxScale,Math.max(minScale,randomScale));
  const x=area.x+pad+(area.width-2*pad-w*scale)*(variant?.positionX??.5);
  const y=area.y+pad+(area.height-2*pad-h*scale)*(variant?.positionY??.5);
  return {scale,tx:x-bounds.minX*scale,ty:y-bounds.minY*scale,bounds,pad,area,minScale,needsSpace:minScale>maxScale+1e-9};
}
// Freeze this choice for the session; resizing changes the cells, never their identities.
export function automaticGrid(size,input='pen') {
  if(size.width<700||size.height<500)return {columns:2,rows:2};
  const minWidth=input==='touch'?300:input==='passive_pen'?260:240;
  const minHeight=input==='touch'?260:input==='passive_pen'?230:220;
  let columns=Math.max(2,Math.min(4,Math.floor(size.width/minWidth)));
  let rows=Math.max(2,Math.min(4,Math.floor(size.height/minHeight)));
  while(columns*rows>12){if(size.width/columns<size.height/rows)columns--;else rows--;}
  return {columns,rows};
}
export function sheetPosition(task,grid) {
  const capacity=grid.columns*grid.rows,index=Math.max(0,(task.number??1)-1);
  return task.autoSheet?{page:Math.floor(index/capacity),slot:index%capacity,capacity}:{page:task.sheetPage??0,slot:task.sheetSlot??0,capacity:4};
}
export function screenScene(size,sheet,slot,peek=false,grid={columns:2,rows:2},focus=false) {
  const compact=sheet&&(focus||size.width<700||size.height<500);
  const width=size.width*(compact?grid.columns:1),height=size.height*(compact?grid.rows:1);
  const areas=Array.from({length:grid.columns*grid.rows},(_,i)=>sheet?{x:(i%grid.columns)*width/grid.columns,y:Math.floor(i/grid.columns)*height/grid.rows,width:width/grid.columns,height:height/grid.rows}:{x:0,y:0,width,height});
  const view=compact&&!peek?areas[slot]:{x:0,y:0,width,height};
  return {compact,width,height,areas,view};
}
export function practiceScene(size,sheet,slot,grid,shape,variant,profile,peek=false){
  const base=screenScene(size,sheet,slot,peek,grid);
  const fitted=fitShape(shape,base.areas[slot],variant,profile);
  const focus=sheet&&(fitted.needsSpace||variant?.schema===7)&&!base.compact;
  const scene=focus?screenScene(size,sheet,slot,peek,grid,true):base;
  return {...scene,placement:focus?fitShape(shape,scene.areas[slot],variant,profile):fitted};
}

export const placementTransform = p => `translate(${p.tx} ${p.ty}) scale(${p.scale})`;
export const intoPlacement = (p,point) => ({x:p.tx+point.x*p.scale,y:p.ty+point.y*p.scale});
export const fromPlacement = (p,point) => ({x:(point.x-p.tx)/p.scale,y:(point.y-p.ty)/p.scale});
