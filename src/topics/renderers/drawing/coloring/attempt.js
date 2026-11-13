import { bounds, contourDistance, distanceToSegment, inside, resample } from './geometry.js';

export function coloringOptions(params={}, scale=1) {
  const input=params.inputMode, factor=1/Math.max(.05,scale);
  const tolerance=Number(params.outsideTolerance);
  const target=Number(params.fillTarget);
  return { tolerance: ([3,6,10,16].includes(tolerance)?tolerance:6)*factor,
    target: ([80,90,95].includes(target)?target:90)/100,
    brush: (input==='touch'?26:input==='passive_pen'?16:12)*factor,
    trace: (input==='touch'?24:input==='passive_pen'?12:7)*factor };
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
  const contour=resample(shape.points,3), hits=new Set(state.traceHits.filter(i=>Number.isInteger(i)&&i>=0&&i<contour.length));
  let last=null,stroke=null,failed=false;
  const progress=()=>({coverage:total?filled/total:0,trace:contour.length?hits.size/contour.length:0});
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
    if(state.phase==='trace') {
      contour.forEach((p,i)=>{if(!hits.has(i)&&distanceToSegment(p,a,b)<=options.trace){hits.add(i);state.traceHits.push(i);}});
    } else {
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
      state.outline=[];state.traceHits=[];hits.clear();
    } else {
      state.ink=[];state.filled=[];painted.fill(0);filled=0;
    }
    state.retry=true;last=null;stroke=null;
  }
  function move(p) {
    if(!stroke||failed)return {failed};
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
    begin(p) {
      if(failed||stroke||state.phase==='done'||!allowed(p))return false;
      state.retry=false;
      failed=false;last=p;stroke={width:state.phase==='trace'?3:options.brush,points:[p]};
      (state.phase==='trace'?state.outline:state.ink).push(stroke);mark(p,p);return true;
    },move,
    end(cancelled=false) {
      // A cancellation preserves work, but never advances a phase mid-gesture.
      if(!cancelled&&stroke&&!failed) {
        if(state.phase==='trace'&&progress().trace>=.97)state.phase='fill';
        else if(state.phase==='fill'&&progress().coverage>=options.target)state.phase='done';
      }
      last=null;stroke=null;failed=false;return state.phase;
    },
  };
}

export function markColoringError(snapshot) {snapshot.progress.hadError=true;}
export function nextColoringShape(snapshot) {if(snapshot.progress.shapes[snapshot.progress.index]?.phase==='done'&&snapshot.progress.index+1<snapshot.progress.shapes.length)snapshot.progress.index++;}
