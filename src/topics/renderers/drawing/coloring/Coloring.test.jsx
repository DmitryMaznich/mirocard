import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Coloring from './Coloring.jsx';
import {freshProgress} from './attempt.js';
import {loadColoring,saveColoring,storageKey} from './storage.js';
import {recordingContext} from '../firstLines/canvasTestContext.js';

const task={id:'coloring:regression',seed:5,conceptId:'coloring',cardId:'coloring'};
const key=storageKey('kid','session',task.id);
const sheet={version:1,width:640,height:640,shapes:[{title:'Квадрат',kind:'square',points:[{x:50,y:50},{x:350,y:50},{x:350,y:350},{x:50,y:350}]}]};
let root,host;
beforeEach(()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();
  const progress=freshProgress(sheet);progress.shapes[0].phase='fill';saveColoring(key,{sheet,progress});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(function(){const ctx=recordingContext(this);ctx.closePath=()=>{};return ctx;});
  vi.spyOn(HTMLCanvasElement.prototype,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,width:640,height:640,right:640,bottom:640});
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
async function render(inputMode='pen',props={}){
  // SessionScreen constructs a fresh params object on each parent render.
  await act(async()=>root.render(<Coloring task={task} student={{id:'kid'}} sessionId="session" sessionParams={{inputMode,outsideTolerance:'6',fillTarget:'90'}} {...props} />));
}
async function send(type,x,y,pointerType='pen'){
  await act(async()=>{const event=new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y});Object.defineProperties(event,{pointerId:{value:1},pointerType:{value:pointerType}});host.querySelector('canvas').dispatchEvent(event);});
}

describe('natural coloring across separate browser frames',()=>{
  it('continues a held stroke through parent updates and repeated back-and-forth movements',async()=>{
    await render();await send('pointerdown',100,100);await send('pointermove',120,100);
    await render();await send('pointermove',200,100);
    await render();await send('pointermove',100,108);
    await render();await send('pointermove',200,116);
    await send('pointerup',200,116);
    const state=loadColoring(key).progress.shapes[0];
    expect(state.ink).toHaveLength(1);
    expect(state.ink[0].points.at(-1)).toEqual({x:200,y:116});
    expect(state.ink[0].points).toContainEqual({x:100,y:108});
    expect(state.filled.length).toBeGreaterThan(500);
  });
  for(const input of ['pen','passive_pen','touch'])it(`${input}: accumulates separate strokes without connecting across lifted movements`,async()=>{
    await render(input);const pointerType=input==='pen'?'pen':'touch';let before=0;
    for(let n=0;n<5;n++){
      await send('pointerdown',100,100+n*30,pointerType);
      await send('pointermove',120,100+n*30,pointerType);await render(input);
      await send('pointermove',180,100+n*30,pointerType);await send('pointerup',180,100+n*30,pointerType);
      const state=loadColoring(key).progress.shapes[0];expect(state.ink).toHaveLength(n+1);
      expect(state.ink[n].points.at(-1)).toEqual({x:180,y:100+n*30});
      expect(state.filled.length).toBeGreaterThan(before);before=state.filled.length;
    }
  });
  it('clears all coloring immediately, preserves the outline and earlier figures, and resumes only after lifting',async()=>{
    const snapshot=loadColoring(key);
    const completed={phase:'done',traceHits:[0],filled:[1],outline:[{width:3,points:[{x:50,y:50},{x:350,y:50}]}],ink:[{width:12,points:[{x:100,y:100},{x:150,y:100}]}]};
    snapshot.sheet.shapes.push(structuredClone(snapshot.sheet.shapes[0]));
    snapshot.progress.shapes.unshift(structuredClone(completed));snapshot.progress.index=1;
    snapshot.progress.shapes[1].outline=structuredClone(completed.outline);
    saveColoring(key,snapshot);const error=vi.fn();
    await render('pen',{onStreakReset:error});
    await send('pointerdown',100,100);await send('pointermove',180,100);await send('pointerup',180,100);
    expect(loadColoring(key).progress.shapes[1].filled.length).toBeGreaterThan(0);
    await send('pointerdown',100,130);await send('pointermove',400,130);
    let saved=loadColoring(key);
    expect(saved.progress.shapes[1]).toMatchObject({phase:'fill',retry:true,ink:[],filled:[],outline:completed.outline});
    expect(saved.progress.shapes[0]).toEqual(completed);expect(saved.progress.hadError).toBe(true);
    await send('pointermove',100,150);expect(loadColoring(key).progress.shapes[1].filled).toEqual([]);
    await send('pointerup',100,150);expect(host.textContent).toContain('Закрась фигуру заново');
    await send('pointerdown',100,160);await send('pointermove',180,160);await send('pointerup',180,160);
    saved=loadColoring(key);expect(saved.progress.shapes[1].filled.length).toBeGreaterThan(0);
    expect(saved.progress.shapes[1].ink).toHaveLength(1);expect(error).toHaveBeenCalledTimes(1);
    await send('pointerdown',100,180);await send('pointermove',400,180);await send('pointerup',400,180);
    expect(loadColoring(key).progress.shapes[1].filled).toEqual([]);expect(error).toHaveBeenCalledTimes(1);
  });
  it('removes the whole partial outline on error and retains the reset after remounting',async()=>{
    const saved=loadColoring(key);saved.progress.shapes[0].phase='trace';saveColoring(key,saved);
    await render();await send('pointerdown',50,50);await send('pointermove',200,50);await send('pointerup',200,50);
    expect(loadColoring(key).progress.shapes[0].contourAttempt.progress).toBeGreaterThan(0);
    await send('pointerdown',200,50);await send('pointermove',200,150);
    expect(loadColoring(key).progress.shapes[0]).toMatchObject({phase:'trace',retry:true,outline:[],traceHits:[]});
    await send('pointerup',200,150);expect(host.textContent).toContain('Обведи контур заново');
    await act(async()=>root.unmount());root=createRoot(host);await render();
    expect(host.textContent).toContain('Обведи контур заново');
    await send('pointerdown',50,50);await send('pointermove',100,50);await send('pointerup',100,50);
    expect(loadColoring(key).progress.shapes[0].outline).toHaveLength(1);
  });

  it('allows a fresh attempt after the window loses focus during an error',async()=>{
    await render();await send('pointerdown',100,100);await send('pointermove',400,100);
    await act(async()=>window.dispatchEvent(new Event('blur')));
    await send('pointerdown',100,150);await send('pointermove',180,150);await send('pointerup',180,150);
    const saved=loadColoring(key).progress.shapes[0];expect(saved.ink).toHaveLength(1);
    expect(saved.filled.length).toBeGreaterThan(0);expect(saved.ink[0].points.at(-1)).toEqual({x:180,y:150});
  });

  it('does not cancel a held stroke when ResizeObserver repeats an unchanged size',async()=>{
    let notify;
    vi.stubGlobal('ResizeObserver',class {constructor(callback){notify=callback;}observe(){}disconnect(){}});
    await render();await send('pointerdown',100,100);await send('pointermove',120,100);
    await act(async()=>notify());await send('pointermove',200,100);await send('pointerup',200,100);
    expect(loadColoring(key).progress.shapes[0].ink[0].points.at(-1)).toEqual({x:200,y:100});
  });

  it('offers five pencils during filling, keeps old strokes colored and restores the selection',async()=>{
    await render();
    const colors=host.querySelector('[aria-label="Цвет карандаша"]');expect(colors).toBeTruthy();expect(colors.querySelectorAll('button')).toHaveLength(5);
    await act(async()=>host.querySelector('[aria-label="Красный"]').click());
    expect(host.querySelector('[aria-label="Красный"]').getAttribute('aria-pressed')).toBe('true');
    await send('pointerdown',100,100);await send('pointermove',180,100);await send('pointerup',180,100);
    const before=loadColoring(key).progress.shapes[0].filled.length;
    await act(async()=>host.querySelector('[aria-label="Зелёный"]').click());
    expect(loadColoring(key).progress.shapes[0].filled.length).toBe(before);
    await send('pointerdown',100,140);await send('pointermove',180,140);await send('pointerup',180,140);
    const saved=loadColoring(key);expect(saved.progress.shapes[0].ink.map(s=>s.color)).toEqual(['#ef6363','#68b77d']);
    expect(saved.progress.color).toBe('#68b77d');
    await act(async()=>root.unmount());root=createRoot(host);await render();
    expect(host.querySelector('[aria-label="Зелёный"]').getAttribute('aria-pressed')).toBe('true');
    await send('pointerdown',100,180);await send('pointermove',180,180);await send('pointerup',180,180);
    expect(loadColoring(key).progress.shapes[0].ink.map(s=>s.color)).toEqual(['#ef6363','#68b77d','#68b77d']);
  });
  it('hides the palette during contour tracing and disables color changes during a stroke',async()=>{
    const saved=loadColoring(key);saved.progress.shapes[0].phase='trace';saveColoring(key,saved);
    await render();expect(host.querySelector('[aria-label="Цвет карандаша"]')).toBeNull();
    await send('pointerdown',50,50);await send('pointermove',350,50);await send('pointermove',350,350);await send('pointermove',50,350);await send('pointermove',50,50);await send('pointerup',50,50);
    expect(host.querySelector('[aria-label="Цвет карандаша"]')).toBeTruthy();
    await send('pointerdown',100,100);
    expect([...host.querySelectorAll('.coloring__color')].every(b=>b.disabled)).toBe(true);
    await send('pointerup',100,100);
    expect([...host.querySelectorAll('.coloring__color')].some(b=>b.disabled)).toBe(false);
  });

});
