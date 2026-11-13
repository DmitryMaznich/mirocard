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
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();});
async function render(inputMode='pen'){
  // SessionScreen constructs a fresh params object on each parent render.
  await act(async()=>root.render(<Coloring task={task} student={{id:'kid'}} sessionId="session" sessionParams={{inputMode,outsideTolerance:'6',fillTarget:'90'}} />));
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
});
