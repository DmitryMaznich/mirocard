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
  const minFraction=Math.min(1,Math.max(.45,Math.max(72,profile.width*2)/((shape.parts.length===1&&shape.parts[0].type==='line'?Math.max(w,h):Math.min(w,h))*maxScale)));
  const size=variant?.schema===4?variant.size:.75,scale=maxScale*(minFraction+(1-minFraction)*size);
  const x=area.x+pad+(area.width-2*pad-w*scale)*(variant?.positionX??.5);
  const y=area.y+pad+(area.height-2*pad-h*scale)*(variant?.positionY??.5);
  return {scale,tx:x-bounds.minX*scale,ty:y-bounds.minY*scale,bounds,pad,area};
}
export function screenScene(size,sheet,slot,peek=false) {
  const compact=sheet&&(size.width<700||size.height<500),width=size.width*(compact?2:1),height=size.height*(compact?2:1);
  const areas=Array.from({length:4},(_,i)=>sheet?{x:(i%2)*width/2,y:Math.floor(i/2)*height/2,width:width/2,height:height/2}:{x:0,y:0,width,height});
  const view=compact&&!peek?areas[slot]:{x:0,y:0,width,height};
  return {compact,width,height,areas,view};
}
export const placementTransform = p => `translate(${p.tx} ${p.ty}) scale(${p.scale})`;
export const intoPlacement = (p,point) => ({x:p.tx+point.x*p.scale,y:p.ty+point.y*p.scale});
export const fromPlacement = (p,point) => ({x:(point.x-p.tx)/p.scale,y:(point.y-p.ty)/p.scale});
