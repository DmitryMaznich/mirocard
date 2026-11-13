import { useEffect,useLayoutEffect,useRef } from 'react';
import { backingSize,CANVAS_OPTIONS,paintFrame } from './canvasDrawing.js';

export default function CanvasBoard({boardRef,className,view,placement,drawings,pulse=false,background,selection,activeState,onSurfaceLost,...events}){
 const latest=useRef(null),schedule=useRef(null),ready=useRef(false);
 useLayoutEffect(()=>{latest.current={view,drawings,pulse,background,selection,onSurfaceLost};schedule.current?.();});
 useEffect(()=>{
  const canvas=boardRef.current;if(!canvas)return undefined;
  const ctx=canvas.getContext('2d',CANVAS_OPTIONS);if(!ctx){canvas.dataset.renderStatus='unavailable';return undefined;}
  let stopped=false,raf=0,last=-Infinity;
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  ready.current=true;canvas.dataset.renderer='canvas-2d-cpu';canvas.dataset.renderStatus='ready';
  const draw=time=>{
   raf=0;if(stopped||!ready.current)return;
   const data=latest.current,rect=canvas.getBoundingClientRect();if(!data||rect.width<=0||rect.height<=0)return;
   if(time-last>=1000/30||!data.pulse||reduce?.matches){
    const size=backingSize(rect.width,rect.height,window.devicePixelRatio);
    if(canvas.width!==size.width)canvas.width=size.width;if(canvas.height!==size.height)canvas.height=size.height;
    paintFrame(ctx,{...data,width:rect.width,height:rect.height,ratio:size.ratio,time,reducedMotion:reduce?.matches??false});
    canvas.dataset.buffer=`${size.width}x${size.height}`;canvas.dataset.frame=String(Number(canvas.dataset.frame??0)+1);last=time;
   }
   if(data.pulse&&!reduce?.matches)raf=requestAnimationFrame(draw);
  };
  const request=()=>{if(!raf&&!stopped&&ready.current){last=-Infinity;raf=requestAnimationFrame(draw);}};
  const lost=event=>{event.preventDefault();ready.current=false;canvas.dataset.renderStatus='lost';if(raf)cancelAnimationFrame(raf);raf=0;latest.current?.onSurfaceLost?.();};
  const restored=()=>{ready.current=true;canvas.dataset.renderStatus='ready';request();};
  schedule.current=request;canvas.addEventListener('contextlost',lost);canvas.addEventListener('contextrestored',restored);request();
  return()=>{stopped=true;ready.current=false;if(raf)cancelAnimationFrame(raf);schedule.current=null;canvas.removeEventListener('contextlost',lost);canvas.removeEventListener('contextrestored',restored);canvas.width=1;canvas.height=1;};
 },[boardRef]);
 const pointer=(handler)=>(event)=>{if(ready.current){if(event.type!=='pointermove')schedule.current?.();handler?.(event);}};
 return <canvas {...events} ref={boardRef} className={className} data-camera={JSON.stringify({view,placement})} data-logical-track-width={activeState?.profile?.width} data-part={activeState?.part} data-demo={drawings.some(d=>d.demo)||undefined}
  onPointerDown={pointer(events.onPointerDown)} onPointerMove={pointer(events.onPointerMove)} onPointerUp={pointer(events.onPointerUp)} />;
}
