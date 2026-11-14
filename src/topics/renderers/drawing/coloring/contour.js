import {resample} from './geometry.js';
import {createCurveAttempt} from '../firstLines/curveAttempt.js';
import {screenProfile,scaledProfile} from '../firstLines/trackProfile.js';

export function contourPart(points) {
  const samples=resample(points,2);samples.push({...samples[0]});
  let length=0;
  const path=samples.map((p,i)=>{if(i)length+=Math.hypot(p.x-samples[i-1].x,p.y-samples[i-1].y);return {...p,s:length};});
  const end=path.at(-1);
  // The shared First Lines engine allows a short overlap past the initial point.
  for(const p of [...path].slice(1)){if(p.s>80)break;path.push({...p,s:length+p.s});}
  return {type:'curve',closed:true,points:path,length,end};
}
export function contourProfile(input,scale=1,ink) {
  const profile=scaledProfile(screenProfile(input),scale);
  // The accepted finish area matches the visible ring, independently of pen width.
  return {...profile,ink:ink??profile.ink,close:profile.goalRadius+profile.goalStroke/2};
}
export function createContour(shape,state,options) {
  const part=contourPart(shape.points),profile=options.traceProfile??{...contourProfile('pen'),width:options.trace*2};
  const attempt=createCurveAttempt(part,state.contourAttempt,profile,{stopAtFinish:true});
  state.contourAttempt=attempt.state;
  state.outline=attempt.state.strokes;
  for(const stroke of state.outline)stroke.width=options.outlineInk??profile.ink;
  return {attempt,part,profile};
}
