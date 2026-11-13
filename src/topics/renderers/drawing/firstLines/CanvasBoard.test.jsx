import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import CanvasBoard from './CanvasBoard.jsx';
import { recordingContext } from './canvasTestContext.js';
import { createShapeAttempt } from './shapeAttempt.js';
let host,root,canvas,ctx,frames,id;
beforeEach(()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;frames=new Map();id=0;
 vi.stubGlobal('requestAnimationFrame',fn=>{frames.set(++id,fn);return id;});vi.stubGlobal('cancelAnimationFrame',n=>frames.delete(n));
 vi.spyOn(HTMLCanvasElement.prototype,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,width:800,height:600});
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation(function(){canvas=this;ctx??=recordingContext(this);return ctx;});
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();ctx=null;vi.restoreAllMocks();vi.unstubAllGlobals();});
async function tick(time){await act(async()=>{const current=[...frames.values()];frames.clear();for(const f of current)f(time);});}
const view={x:0,y:0,width:1000,height:1000},placement={tx:0,ty:0,scale:1};
it('paints the final completed frame even before the next 30fps interval and frees its bitmap on unmount',async()=>{
 const a=createShapeAttempt('short_line'),ref={current:null},item={state:a.state,shape:a.shape,profile:a.state.profile,placement};
 await act(async()=>root.render(<CanvasBoard boardRef={ref} view={view} placement={placement} drawings={[item]} pulse activeState={a.state}/>));
 await tick(100);expect(ctx.calls.some(c=>c.name==='stroke'&&c.stroke==='#8153b5')).toBe(true);const before=ctx.calls.length;
 a.begin({x:320,y:500});a.move({x:680,y:500},500);expect(a.end()).toBe(true);
 await act(async()=>root.render(<CanvasBoard boardRef={ref} view={view} placement={placement} drawings={[item]} pulse={false} activeState={a.state}/>));
 await tick(116);expect(ctx.calls.slice(before).some(c=>c.name==='fillRect')).toBe(true);expect(ctx.calls.slice(before).some(c=>c.name==='stroke'&&c.stroke==='#8153b5')).toBe(false);expect(canvas.dataset.frame).toBe('2');
 await act(async()=>root.unmount());root=createRoot(host);expect(canvas.width).toBe(1);expect(canvas.height).toBe(1);expect(frames.size).toBe(0);
});
it('cancels input on context loss, redraws after restoration and requests the CPU/readback context',async()=>{
 const ref={current:null},lost=vi.fn(),down=vi.fn();
 await act(async()=>root.render(<CanvasBoard boardRef={ref} view={view} placement={placement} drawings={[]} onSurfaceLost={lost} onPointerDown={down}/>));
 await tick(100);expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d',{alpha:false,willReadFrequently:true,desynchronized:false});
 await act(async()=>canvas.dispatchEvent(new Event('contextlost',{cancelable:true})));expect(lost).toHaveBeenCalledOnce();expect(canvas.dataset.renderStatus).toBe('lost');
 await act(async()=>canvas.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})));expect(down).not.toHaveBeenCalled();
 await act(async()=>canvas.dispatchEvent(new Event('contextrestored')));await tick(116);expect(canvas.dataset.renderStatus).toBe('ready');expect(canvas.dataset.frame).toBe('2');
 await act(async()=>canvas.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})));expect(down).toHaveBeenCalledOnce();
});
