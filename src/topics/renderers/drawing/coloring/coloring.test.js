import {describe,it,expect} from 'vitest';
import {FIGURES,bounds,contourDistance,figureOutline,generateSheet,inside,randomSource,resample} from './geometry.js';
import {coloringOptions,createColoringAttempt,freshProgress} from './attempt.js';
import {loadColoring,saveColoring} from './storage.js';
import {generateTasks} from '../engine.js';
import {createSessionState,handleAdvance,handleAnswer} from '@/features/session/sessionEngine.js';
import topic from '../../../../../tools/drawing/topic.json';

const square={points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]};
const options={tolerance:6,brush:12,trace:5,target:.9};
const fresh=()=>freshProgress({shapes:[square]}).shapes[0];
function draw(attempt,points){expect(attempt.begin(points[0])).toBe(true);for(const p of points.slice(1))expect(attempt.move(p).failed).toBe(false);return attempt.end();}

describe('coloring geometry and placement',()=>{
  it('generates every closed figure and both simple ribbons with positive interiors',()=>{
    for(const kind of FIGURES){
      const points=figureOutline(kind,randomSource(42));
      expect(points.length).toBeGreaterThanOrEqual(3);
      expect(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
      expect(bounds(points).width).toBeGreaterThan(0);
      expect(bounds(points).height).toBeGreaterThan(0);
      expect(inside({x:0,y:0},points)).toBe(true);
    }
  });
  it('keeps random sheets deterministic, in bounds and separated, with variable counts',()=>{
    const counts=new Set();
    for(let seed=0;seed<40;seed++){
      const sheet=generateSheet(seed,1000,720);counts.add(sheet.shapes.length);
      expect(sheet).toEqual(generateSheet(seed,1000,720));
      expect(sheet.shapes.length).toBeGreaterThan(1);
      const boxes=sheet.shapes.map(s=>bounds(s.points));
      for(const b of boxes){expect(b.x).toBeGreaterThanOrEqual(25);expect(b.y).toBeGreaterThanOrEqual(25);expect(b.x+b.width).toBeLessThanOrEqual(975);expect(b.y+b.height).toBeLessThanOrEqual(695);}
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
        const a=boxes[i],b=boxes[j];
        expect(a.x+a.width+25<=b.x||b.x+b.width+25<=a.x||a.y+a.height+25<=b.y||b.y+b.height+25<=a.y).toBe(true);
      }
    }
    expect(counts.size).toBeGreaterThan(1);
  });
  it('keeps wavy ribbon offsets from crossing, including the tighter two-wave variant',()=>{
    const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    for(let seed=0;seed<60;seed++){
      const points=figureOutline('wavy_path',randomSource(seed));
      let crosses=false;
      for(let i=0;i<points.length;i++)for(let j=i+2;j<points.length;j++){
        if(i===0&&j===points.length-1)continue;
        const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];
        crosses ||= cross(a,b,c)*cross(a,b,d)<-1e-12&&cross(c,d,a)*cross(c,d,b)<-1e-12;
      }
      expect(crosses).toBe(false);
    }
  });
  it('can restrict the selection to roads or basic shapes',()=>{
    expect(generateSheet(12,1000,720,'pen','paths').shapes.every(s=>s.kind.endsWith('_path'))).toBe(true);
    expect(generateSheet(12,1000,720,'pen','basic').shapes.every(s=>FIGURES.slice(0,8).includes(s.kind))).toBe(true);
  });
});
describe('separate outline and interior assessments',()=>{
  it('does not credit tracing as coloring and advances only after a lifted contour',()=>{
    const state=fresh(),a=createColoringAttempt(square,state,options);
    draw(a,[...resample(square.points,2),square.points[0]]);
    expect(state.phase).toBe('fill');expect(a.progress().coverage).toBe(0);expect(state.filled).toEqual([]);
  });
  it('checks distance rather than exterior area, including the brush edge',()=>{
    const state={...fresh(),phase:'fill'},a=createColoringAttempt(square,state,options);
    // Half of the brush is outside; it reaches exactly six units from the contour.
    draw(a,[{x:0,y:10},{x:0,y:90}]);
    expect(a.progress().coverage).toBeLessThan(.06);
    expect(a.begin({x:0,y:50})).toBe(true);
    expect(a.move({x:-1,y:50}).failed).toBe(true);
    expect(state.phase).toBe('fill');
    a.end();
    expect(a.progress().coverage).toBe(0);
    draw(a,[{x:0,y:10},{x:0,y:90}]);
    const before=a.progress().coverage;
    draw(a,[{x:0,y:10},{x:0,y:90}]);
    expect(a.progress().coverage).toBe(before); // repeated area counts once
  });
  it('detects far excursions between sparse events and never clips input to the shape',()=>{
    const state={...fresh(),phase:'fill'},a=createColoringAttempt(square,state,options);
    expect(a.begin({x:50,y:50})).toBe(true);
    expect(a.move({x:200,y:50}).failed).toBe(true);
    expect(a.move({x:50,y:60}).failed).toBe(true);a.end();
    expect(state.ink).toEqual([]);expect(state.filled).toEqual([]);
    expect(a.begin({x:50,y:60})).toBe(true);a.end();
  });
  it('restarts the whole outline, including earlier strokes, after a tracing error',()=>{
    const state=fresh(),a=createColoringAttempt(square,state,options);
    draw(a,[{x:0,y:0},{x:100,y:0}]);
    expect(a.progress().trace).toBeGreaterThan(.2);
    expect(a.begin({x:100,y:0})).toBe(true);
    expect(a.move({x:50,y:50}).failed).toBe(true);
    expect(state).toMatchObject({phase:'trace',retry:true,outline:[],traceHits:[]});
    expect(a.progress().trace).toBe(0);expect(a.begin({x:0,y:0})).toBe(false);
    a.end();draw(a,[...resample(square.points,2),square.points[0]]);
    expect(state.phase).toBe('fill');expect(a.progress().coverage).toBe(0);
  });
  it('restarts all coloring while keeping the completed outline and permits a full retry',()=>{
    const state=fresh(),a=createColoringAttempt(square,state,options);
    draw(a,[...resample(square.points,2),square.points[0]]);
    const outline=structuredClone(state.outline),hits=[...state.traceHits];
    draw(a,[{x:10,y:10},{x:90,y:10}]);draw(a,[{x:10,y:20},{x:90,y:20}]);
    expect(a.progress().coverage).toBeGreaterThan(0);
    a.begin({x:50,y:50});expect(a.move({x:200,y:50}).failed).toBe(true);
    expect(state).toMatchObject({phase:'fill',retry:true,ink:[],filled:[]});
    expect(state.outline).toEqual(outline);expect(state.traceHits).toEqual(hits);expect(a.progress().coverage).toBe(0);
    expect(a.begin({x:50,y:50})).toBe(false);a.end();
    for(let y=6;y<=94&&state.phase!=='done';y+=8)draw(a,[{x:5,y},{x:95,y}]);
    expect(state.phase).toBe('done');
  });
  it('fills only the interior union, restores coverage and finishes at the target',()=>{
    const state={...fresh(),phase:'fill'},a=createColoringAttempt(square,state,options);
    for(let y=6;y<=94&&state.phase!=='done';y+=8)draw(a,[{x:5,y},{x:95,y}]);
    expect(state.phase).toBe('done');expect(a.progress().coverage).toBeGreaterThanOrEqual(.9);
    const restored=createColoringAttempt(square,structuredClone(state),options);
    expect(restored.progress().coverage).toBe(a.progress().coverage);
    expect(restored.begin({x:50,y:50})).toBe(false);
  });
  it('does not jump over concave gaps, or advance on cancellation',()=>{
    const shape={points:[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:70,y:100},{x:70,y:30},{x:30,y:30},{x:30,y:100},{x:0,y:100}]};
    const state={...fresh(),phase:'fill'},a=createColoringAttempt(shape,state,options);
    expect(a.begin({x:15,y:80})).toBe(true);expect(a.move({x:85,y:80}).failed).toBe(true);a.end();
    const trace=fresh(),b=createColoringAttempt(square,trace,options);
    b.begin(square.points[0]);for(const p of [...resample(square.points,2),square.points[0]])b.move(p);b.end(true);
    expect(trace.phase).toBe('trace');
  });
  it('uses the chosen pen width for interior coverage, brush-edge tolerance and outline ink',()=>{
    const thinOptions=coloringOptions({penWidth:'6'}),thickOptions=coloringOptions({penWidth:'24'});
    const thin=createColoringAttempt(square,{...fresh(),phase:'fill'},thinOptions),thick=createColoringAttempt(square,{...fresh(),phase:'fill'},thickOptions);
    draw(thin,[{x:25,y:50},{x:75,y:50}]);draw(thick,[{x:25,y:50},{x:75,y:50}]);
    expect(thick.progress().coverage).toBeGreaterThan(thin.progress().coverage*3);
    expect(thin.begin({x:4,y:50})).toBe(true);thin.end();
    expect(thick.begin({x:4,y:50})).toBe(false);
    const state=fresh(),a=createColoringAttempt(square,state,thickOptions);
    draw(a,[{x:0,y:0},{x:100,y:0}]);expect(state.outline[0].width).toBe(24);
    const zoom=coloringOptions({penWidth:'24'},2);expect(zoom.brush*2).toBe(24);expect(zoom.outlineInk*2).toBe(24);
  });
  it('keeps tolerance in screen pixels across zoom',()=>{
    expect(coloringOptions({outsideTolerance:'10'},2).tolerance).toBe(5);
    expect(coloringOptions({outsideTolerance:'NaN',fillTarget:'0'})).toMatchObject({tolerance:6,target:.9});
    expect(contourDistance({x:105,y:50},square.points)).toBe(5);
  });
});
describe('sessions and checkpoints',()=>{
  it('uses a looping, evaluated mode, with fresh task seeds each generation',()=>{
    const mode=topic.modes.find(m=>m.id==='drawing_coloring');
    expect(mode).toMatchObject({finite:false,loop:true,evaluation:'auto'});
    const tasks=generateTasks(mode,topic.cards),next=generateTasks(mode,topic.cards);
    expect(tasks).toHaveLength(15);expect(tasks[0].seed).not.toBe(next[0].seed);
    let state=createSessionState(tasks,mode,'kid','drawing','0.22.0',['first_lines']);
    for(let i=0;i<45;i++){state=handleAnswer(state,true,tasks[state.taskIndex].conceptId,tasks[state.taskIndex].cardId);state=handleAdvance(state);expect(state.status).toBe('task_active');}
  });
  it('restores exact geometry and separate coverage, rejects broken data',()=>{
    localStorage.clear();const sheet=generateSheet(15,1000,720),progress=freshProgress(sheet);
    progress.hadError=true;progress.shapes[0].phase='fill';progress.shapes[0].filled=[1,2,3];
    const snapshot={sheet,progress};saveColoring('drawing-coloring:test',snapshot);
    expect(loadColoring('drawing-coloring:test')).toEqual(snapshot);
    localStorage.setItem('drawing-coloring:test','{"sheet":{"version":1}}');expect(loadColoring('drawing-coloring:test')).toBeNull();
  });
});
