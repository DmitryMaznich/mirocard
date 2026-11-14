import {inkColor} from './palette.js';
import {createContour,contourProfile} from './contour.js';
import { bounds, contourDistance, distanceToSegment, inside } from './geometry.js';

export function coloringOptions(params={}, scale=1) {
  const input=params.inputMode, factor=1/Math.max(.05,scale);
  const tolerance=Number(params.outsideTolerance);
  const target=Number(params.fillTarget);
  const requestedWidth=Number(params.penWidth);
  const width=Number.isFinite(requestedWidth)&&requestedWidth>=1&&requestedWidth<=32?requestedWidth:null;
  const profile=contourProfile(input,scale,width===null?undefined:width*factor);
  return { traceProfile:profile,tolerance: (Number.isFinite(tolerance)&&tolerance>=0&&tolerance<=16?tolerance:6)*factor,
    target: (Number.isFinite(target)&&target>=50&&target<=100?target:90)/100,
    brush: (width??(input==='touch'?26:input==='passive_pen'?16:12))*factor,
    outlineInk: profile.ink,
    trace: profile.width/2+profile.extra };
}
export function freshProgress(sheet) {
  return {index:0,hadError:false,shapes:sheet.shapes.map(()=>({phase:'trace',traceHits:[],filled:[],outline:[],ink:[]}))};
}

// A 2-unit interior mask measures the union of brush marks, not stroke length.
// Exterior marks never enter the numerator or denominator.
export function createColoringAttempt(shape,state,options) {
  const step=2, box=bounds(shape.points), cols=Math.ceil(box.width/step),rows=Math.ceil(box.height/step);
  const mask=new Uint8Array(cols*rows), painted=new Uint8Array(cols*rows);
  let total=0,filled=0;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
    const i=y*cols+x;
    if(inside({x:box.x+(x+.5)*step,y:box.y+(y+.5)*step},shape.points)){mask[i]=1;total++;}
  }
  for(const i of state.filled)if(Number.isInteger(i)&&mask[i]&&!painted[i]){painted[i]=1;filled++;}
  let contour=state.phase==='trace'?createContour(shape,state,options):null;
  let last=null,stroke=null,failed=false;
  const progress=()=>({coverage:total?filled/total:0,trace:contour?Math.min(1,contour.attempt.state.progress/contour.part.length):1});
  const allowed = p => {
    if(state.phase==='trace')return contourDistance(p,shape.points)<=options.trace;
    // Sample the whole brush footprint along with its centre. This includes the
    // round cap; a centre inside the figure doesn't excuse an exterior brush edge.
    const radius=options.brush/2;
    if(inside(p,shape.points)&&contourDistance(p,shape.points)>=radius)return true;
    const samples=[p,...Array.from({length:24},(_,i)=>({x:p.x+radius*Math.cos(i*Math.PI/12),y:p.y+radius*Math.sin(i*Math.PI/12)}))];
    return samples.every(q=>inside(q,shape.points)||contourDistance(q,shape.points)<=options.tolerance);
  };
  function mark(a,b) {
    if(state.phase!=='trace') {
      const r=options.brush/2;
      const x0=Math.max(0,Math.floor((Math.min(a.x,b.x)-r-box.x)/step)),x1=Math.min(cols-1,Math.ceil((Math.max(a.x,b.x)+r-box.x)/step));
      const y0=Math.max(0,Math.floor((Math.min(a.y,b.y)-r-box.y)/step)),y1=Math.min(rows-1,Math.ceil((Math.max(a.y,b.y)+r-box.y)/step));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) {
        const i=y*cols+x;
        if(mask[i]&&!painted[i]&&distanceToSegment({x:box.x+(x+.5)*step,y:box.y+(y+.5)*step},a,b)<=r){painted[i]=1;filled++;state.filled.push(i);}
      }
    }
  }
  function resetStage() {
    if(state.phase==='trace') {
      state.outline=[];state.traceHits=[];delete state.contourAttempt;
      contour=createContour(shape,state,options);
    } else {
      state.ink=[];state.filled=[];painted.fill(0);filled=0;
    }
    state.retry=true;last=null;stroke=null;
  }
  function move(p,time=0) {
    if(failed)return {failed:true};
    if(state.phase==='trace') {
      const result=contour.attempt.move(p,time);
      if(result.mistake||contour.attempt.state.needsReturn){failed=true;resetStage();return {failed:true,point:p};}
      return {failed:false};
    }
    if(!stroke)return {failed:false};
    const a=last,n=Math.max(1,Math.ceil(Math.hypot(p.x-a.x,p.y-a.y)/2));
    for(let i=1;i<=n;i++) {
      const q={x:a.x+(p.x-a.x)*i/n,y:a.y+(p.y-a.y)*i/n};
      if(!allowed(q)){failed=true;resetStage();return {failed:true,point:q};}
      mark(last,q);last=q;
    }
    if(Math.hypot(p.x-stroke.points.at(-1).x,p.y-stroke.points.at(-1).y)>=1)stroke.points.push(p);
    return {failed:false};
  }
  return {state,progress,
    get readyToLift(){return state.phase==='trace'&&contour.attempt.ready;},
    begin(p,time=0,color) {
      if(failed||stroke||state.phase==='done')return false;
      if(state.phase==='trace') {
        if(!contour.attempt.begin(p,time))return false;
        state.retry=false;
        contour.attempt.state.strokes.at(-1).width=options.outlineInk??contour.profile.ink;
        return true;
      }
      if(!allowed(p))return false;
      state.retry=false;
      failed=false;last=p;stroke={width:options.brush,color:inkColor(color),points:[p]};
      (state.phase==='trace'?state.outline:state.ink).push(stroke);mark(p,p);return true;
    },move,
    end(cancelled=false) {
      if(state.phase==='trace') {
        // Some tablets report cancel/lost capture instead of up when lifting.
        // Once a valid finish was observed, that cannot undo a completed contour.
        const done=contour.attempt.end(failed||(cancelled&&!contour.attempt.ready));
        if(contour.attempt.state.needsReturn&&!failed){failed=true;resetStage();}
        if(done&&!failed){
          // Close only the short accepted gap to the child's actual first point.
          const start=contour.attempt.state.start,points=state.outline.at(-1)?.points;
          if(start&&points&&Math.hypot(points.at(-1).x-start.x,points.at(-1).y-start.y)>.001)points.push({x:start.x,y:start.y});
          state.phase='fill';
        }
        failed=false;return state.phase;
      }
      // A cancellation preserves work, but never advances a phase mid-gesture.
      if(!cancelled&&stroke&&!failed) {
        if(progress().coverage>=options.target)state.phase='done';
      }
      last=null;stroke=null;failed=false;return state.phase;
    },
  };
}

export function markColoringError(snapshot) {snapshot.progress.hadError=true;}
export function nextColoringShape(snapshot) {if(snapshot.progress.shapes[snapshot.progress.index]?.phase==='done'&&snapshot.progress.index+1<snapshot.progress.shapes.length)snapshot.progress.index++;}
