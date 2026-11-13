import { partPoint,transformPoint } from './shapes.js';
export const CANVAS_OPTIONS=Object.freeze({alpha:false,willReadFrequently:true,desynchronized:false});
export function backingSize(width,height,dpr=1){
 const ratio=Math.min(Math.max(1,dpr||1),2,2048/Math.max(1,width),2048/Math.max(1,height),Math.sqrt(4000000/Math.max(1,width*height)));
 return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio)),ratio};
}
export function cameraTransform(width,height,view){
 const scale=Math.min(width/view.width,height/view.height);
 return {scale,x:(width-view.width*scale)/2-view.x*scale,y:(height-view.height*scale)/2-view.y*scale};
}
export function clientFromWorld(point,rect,view,placement){
 const camera=cameraTransform(rect.width,rect.height,view);
 return {x:rect.left+camera.x+(placement.tx+point.x*placement.scale)*camera.scale,y:rect.top+camera.y+(placement.ty+point.y*placement.scale)*camera.scale};
}
function frame(ctx,f){ctx.translate(f.tx,f.ty);ctx.translate(500,500);ctx.rotate(f.angle*Math.PI/180);ctx.scale(f.scale??1,f.scale??1);ctx.translate(-500,-500);}
function polyline(ctx,points,color,width,alpha=1){
 if(!points.length)return;
 ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
 if(points.length>1)ctx.stroke();ctx.restore();
}
function circle(ctx,p,r,color,stroke=null,width=1,alpha=1){
 ctx.save();ctx.globalAlpha*=alpha;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);
 if(color){ctx.fillStyle=color;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}ctx.restore();
}
function partTrace(ctx,part,fraction,color,width){
 const t=Math.max(0,Math.min(1,fraction));if(t===0)return;
 const start=partPoint(part,0),tip=partPoint(part,t);ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(start.x,start.y);
 if(part.type!=='line')for(const p of part.points){if(p.s>0&&p.s<t*part.length)ctx.lineTo(p.x,p.y);}
 ctx.lineTo(tip.x,tip.y);ctx.stroke();ctx.restore();
}
function ink(ctx,stroke,width){
 if(stroke.points.length===1)circle(ctx,stroke.points[0],width/2,'#315b86');
 const index=stroke.failedFrom;
 polyline(ctx,index===null?stroke.points:stroke.points.slice(0,index+1),'#315b86',width);
 if(index!==null)polyline(ctx,stroke.points.slice(index),'#a56e31',width,.65);
}
export function drawingMarkers(state,shape,profile,drawing=false){
 const part=shape.parts[state.part],current=state.parts[state.part];
 const from=drawing&&current.strokes.length?current.strokes.at(-1).points[0]:current.anchor;
 const start=transformPoint(from,part.frame),finish=transformPoint(part.closed&&current.start?current.start:partPoint(part,1),part.frame);
 const fraction=part.type==='line'?(current.progress-320)/360:current.progress/part.length;
 const lead=Array.from({length:12},(_,i)=>transformPoint(partPoint(part,Math.min(1,fraction+(profile.leadLength??44)/part.travelLength*i/11)),part.frame));
 const radius=profile.markerRadius??Math.max(14,profile.width*.22);
 return {start,finish,lead,radius,goalRadius:profile.goalRadius??radius+10};
}
export function paintDrawing(ctx,item,time=0,reducedMotion=false){
 const {state,shape,placement,profile,passive=false,drawing=false,hint=false,demo=false,demoProgress=0,demoPart=state.part,demoLift=null}=item;
 ctx.save();ctx.translate(placement.tx,placement.ty);ctx.scale(placement.scale,placement.scale);ctx.lineCap='round';ctx.lineJoin='round';
 // Every guide is behind every ink stroke, including the shared edges of a cube.
 if(!passive)shape.parts.forEach((part,i)=>{ctx.save();frame(ctx,part.frame);ctx.globalAlpha*=i===state.part||state.done||shape.volume?1:.5;partTrace(ctx,part,1,'#dbebe0',profile.width/part.frame.scale);ctx.restore();});
 shape.parts.forEach((part,i)=>{
  const s=state.parts[i],scale=part.frame.scale;ctx.save();frame(ctx,part.frame);
  for(const history of s.history??[]){ctx.save();ctx.globalAlpha*=.22;for(const stroke of history.strokes){if(history.reason==='error')polyline(ctx,stroke.points,'#a56e31',profile.ink/scale,.65);else ink(ctx,stroke,profile.ink/scale);}for(const p of history.marks)circle(ctx,p,(profile.markRadius??20)/scale,null,'#b98532',(profile.markerStroke??2)*2/scale);ctx.restore();}
  for(const stroke of s.strokes)ink(ctx,stroke,profile.ink/scale);
  for(const p of s.marks)circle(ctx,p,(profile.markRadius??20)/scale,null,'#b98532',(profile.markerStroke??2)*2/scale);
  if(demo&&demoPart===i){
   partTrace(ctx,part,demoProgress,'#315b86',profile.ink/scale);
   if(demoProgress<1||demoLift===null)circle(ctx,partPoint(part,demoProgress),(profile.tipRadius??Math.max(6,profile.ink))/scale,'#315b86');
  }
  ctx.restore();
 });
 if(demo&&demoLift!==null){
  const part=shape.parts[demoLift],end=transformPoint(partPoint(part,1),part.frame),s=profile.overlayScale??1;
  ctx.save();ctx.translate(end.x,end.y);ctx.scale(s,s);polyline(ctx,[{x:22,y:8},{x:22,y:-18}],'#315b86',profile.markerStroke?profile.markerStroke/s*2:6);polyline(ctx,[{x:16,y:-12},{x:22,y:-18},{x:28,y:-12}],'#315b86',profile.markerStroke?profile.markerStroke/s*2:6);ctx.restore();
 }
 if(!passive&&!state.done){
  const current=state.parts[state.part],m=drawingMarkers(state,shape,profile,drawing),pulse=reducedMotion?1:.825+.175*Math.cos(time/1200*Math.PI*2);
  ctx.save();ctx.globalAlpha*=pulse;
  if(!drawing&&!current.needsReturn)polyline(ctx,[m.start,...m.lead],'#0ba85b',profile.leadInk??Math.max(6,profile.ink));
  circle(ctx,m.start,m.radius+(profile.markerHalo??(hint||state.recovery?8:5)),'#0ba85b',null,1,.16);
  circle(ctx,m.start,m.radius,'#0ba85b','#fff',profile.markerStroke??2);ctx.restore();
  circle(ctx,m.finish,m.goalRadius,null,'#8153b5',profile.goalStroke??5);
 }
 ctx.restore();
}
export function paintFrame(ctx,options){
 const {width,height,ratio,view,drawings,time=0,reducedMotion=false,background='#fafbf7',selection=null}=options;
 ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle=background;ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
 const camera=cameraTransform(width,height,view);ctx.setTransform(ratio*camera.scale,0,0,ratio*camera.scale,ratio*camera.x,ratio*camera.y);
 ctx.lineCap='round';ctx.lineJoin='round';for(const drawing of drawings)paintDrawing(ctx,drawing,time,reducedMotion);
 if(selection){ctx.strokeStyle='#248b79';ctx.lineWidth=2/camera.scale;ctx.strokeRect(selection.x+8,selection.y+8,selection.width-16,selection.height-16);}
 ctx.setTransform(1,0,0,1,0,0);
}
