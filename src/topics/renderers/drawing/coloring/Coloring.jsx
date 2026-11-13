import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {contourPart} from './contour.js';
import {bounds,generateSheet} from './geometry.js';
import {coloringOptions,createColoringAttempt,freshProgress,markColoringError,nextColoringShape} from './attempt.js';
import {loadColoring,saveColoring,storageKey} from './storage.js';
import './coloring.css';

function path(ctx,points,close=false) {
  if(!points.length)return;
  ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(const p of points.slice(1))ctx.lineTo(p.x,p.y);
  if(close)ctx.closePath();
}
function paint(canvas,snapshot,view,options,focused) {
  const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const ratio=Math.min(2,window.devicePixelRatio||1),ctx=canvas.getContext('2d',{alpha:false,desynchronized:false,willReadFrequently:true});
  if(!ctx)return;
  const width=Math.round(rect.width*ratio),height=Math.round(rect.height*ratio);
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#fff';ctx.fillRect(0,0,rect.width,rect.height);
  const scale=Math.min(rect.width/view.width,rect.height/view.height);
  ctx.translate((rect.width-view.width*scale)/2,(rect.height-view.height*scale)/2);ctx.scale(scale,scale);ctx.translate(-view.x,-view.y);
  ctx.lineCap='round';ctx.lineJoin='round';
  snapshot.sheet.shapes.forEach((shape,i)=>{
    const state=snapshot.progress.shapes[i],active=i===snapshot.progress.index;
    if(focused&&!active)return;
    if(state.phase==='trace') {
      path(ctx,shape.points,true);ctx.strokeStyle=active?'#dceee2':'#edf3ef';ctx.lineWidth=(options.traceProfile?.width??options.trace*2);ctx.stroke();
    }
    for(const stroke of [...state.ink,...state.outline]) {
      path(ctx,stroke.points);ctx.strokeStyle=state.ink.includes(stroke)?'#66aacd':'#315b86';ctx.lineWidth=stroke.width;
      if(stroke.points.length===1){ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(stroke.points[0].x,stroke.points[0].y,stroke.width/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();
    }
    if(active&&state.phase==='trace') {
      const target=state.contourAttempt?.anchor??shape.points[0],start=state.contourAttempt?.start??shape.points[0];
      const profile=options.traceProfile;
      const progress=state.contourAttempt?.progress??0;
      const guide=contourPart(shape.points).points.filter(p=>p.s>=progress&&p.s<=progress+(profile?.leadLength??24/scale));
      if(guide.length>1){path(ctx,guide);ctx.strokeStyle='#0ba85b';ctx.lineWidth=profile?.leadInk??3/scale;ctx.stroke();}
      ctx.beginPath();ctx.arc(start.x,start.y,(profile?.goalRadius??14/scale),0,Math.PI*2);ctx.strokeStyle='#8153b5';ctx.lineWidth=3/scale;ctx.stroke();
      ctx.beginPath();ctx.arc(target.x,target.y,(profile?.markerRadius??8/scale),0,Math.PI*2);ctx.fillStyle='#0ba85b';ctx.fill();
    }

  });
}

export default function Coloring({task,student,sessionId,sessionParams={},sessionStatus,interactionDisabled=false,rewardAttemptBlocked=false,onCorrect,onStreakReset,onAdvance,playFeedback}) {
  const key=storageKey(student?.id,sessionId,task.id);
  const [snapshot,setSnapshot]=useState(()=>loadColoring(key));
  const [size,setSize]=useState({width:0,height:0});
  const [overview,setOverview]=useState(false),[hint,setHint]=useState(''),[drawing,setDrawing]=useState(false);
  const [,redraw]=useState(0);
  const canvas=useRef(null),pointer=useRef(null),failed=useRef(false),reported=useRef(false),completed=useRef(false);
  const current=useRef(null),activeAttempt=useRef(null),measuredSize=useRef({width:0,height:0});
  useLayoutEffect(()=>{current.current=snapshot;});
  const state=snapshot?.progress.shapes[snapshot.progress.index];
  const shape=snapshot?.sheet.shapes[snapshot.progress.index];
  const compact=size.width<600;
  const view=useMemo(()=>{
    if(!snapshot)return {x:0,y:0,width:1,height:1};
    if(compact&&!overview&&shape){const b=bounds(shape.points),pad=45;return {x:b.x-pad,y:b.y-pad,width:b.width+pad*2,height:b.height+pad*2};}
    return {x:0,y:0,width:snapshot.sheet.width,height:snapshot.sheet.height};
  },[snapshot,compact,overview,shape]);
  const scale=Math.min(size.width/view.width,size.height/view.height)||1;
  // SessionScreen recreates its params object on parent updates. Keep the
  // active gesture alive unless the actual tool settings or scale change.
  const {inputMode,outsideTolerance,fillTarget,penWidth}=sessionParams;
  const options=useMemo(()=>coloringOptions({inputMode,outsideTolerance,fillTarget,penWidth},scale),[inputMode,outsideTolerance,fillTarget,penWidth,scale]);
  const attempt=useMemo(()=>shape&&state?createColoringAttempt(shape,state,options):null,[shape,state,options]);
  useLayoutEffect(()=>{activeAttempt.current=attempt;});
  const correct=sessionStatus==='answer_correct';
  const disabled=interactionDisabled||correct||overview||!attempt||state?.phase==='done';
  const persist=()=>{if(current.current)saveColoring(key,current.current);};
  const refresh=()=>redraw(n=>n+1);

  useEffect(()=>{
    const board=canvas.current;
    const resize=()=>{
      const r=board.getBoundingClientRect();if(!r.width||!r.height)return;
      if(measuredSize.current.width===r.width&&measuredSize.current.height===r.height)return;
      measuredSize.current={width:r.width,height:r.height};
      activeAttempt.current?.end(true);pointer.current=null;setDrawing(false);setSize({width:r.width,height:r.height});
      setSnapshot(previous=>{
        if(previous)return previous;
        const sheet=generateSheet(task.seed,Math.max(660,Math.round(r.width)),Math.max(640,Math.round(r.height)),sessionParams.inputMode,sessionParams.figureSet);
        const next={sheet,progress:freshProgress(sheet)};saveColoring(key,next);return next;
      });
    };
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
    observer?.observe(board);resize();
    const lost=event=>{event.preventDefault();activeAttempt.current?.end(true);pointer.current=null;setDrawing(false);};
    const restored=()=>redraw(n=>n+1);
    board.addEventListener('contextlost',lost);board.addEventListener('contextrestored',restored);
    const save=()=>{activeAttempt.current?.end(true);pointer.current=null;setDrawing(false);if(current.current)saveColoring(key,current.current);};
    window.addEventListener('blur',save);window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',save);
    return()=>{observer?.disconnect();save();board.removeEventListener('contextlost',lost);board.removeEventListener('contextrestored',restored);window.removeEventListener('blur',save);window.removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',save);};
  },[key,task.seed,sessionParams.inputMode,sessionParams.figureSet]);

  useEffect(()=>{
    if(snapshot?.progress.hadError&&!reported.current&&!rewardAttemptBlocked&&!correct){reported.current=true;onStreakReset?.(task.conceptId,task.cardId);}
    if(snapshot?.progress.shapes.every(s=>s.phase==='done')&&!completed.current&&!correct){completed.current=true;onCorrect?.(task.conceptId,task.cardId);}
  },[snapshot,state?.phase,correct,rewardAttemptBlocked,onStreakReset,onCorrect,task]);
  useEffect(()=>{if(interactionDisabled){attempt?.end(true);pointer.current=null;}},[interactionDisabled,attempt]);
  useEffect(()=>()=>attempt?.end(true),[attempt]);
  useLayoutEffect(()=>{if(snapshot)paint(canvas.current,snapshot,view,options,compact&&!overview);});

  const point=event=>{
    const r=canvas.current.getBoundingClientRect();
    return {x:view.x+(event.clientX-r.left-(r.width-view.width*scale)/2)/scale,y:view.y+(event.clientY-r.top-(r.height-view.height*scale)/2)/scale};
  };
  const failure=()=>{
    if(failed.current)return;
    failed.current=true;markColoringError(snapshot);setHint(state.phase==='trace'?'Стоп. Подними стилус — обведём заново':'Стоп. Подними стилус — закрасим заново');
    persist();
    if(!reported.current&&!rewardAttemptBlocked){reported.current=true;onStreakReset?.(task.conceptId,task.cardId);}else playFeedback?.('incorrect');
  };
  const move=event=>{
    if(failed.current)return;
    for(const sample of [...(event.nativeEvent?.getCoalescedEvents?.()??[]),event])if(attempt.move(point(sample),sample.timeStamp).failed){failure();break;}
    refresh();
  };
  const end=(event,cancelled=false)=>{
    if(pointer.current!==event.pointerId)return;
    if(!cancelled&&!disabled)move(event);
    attempt.end(cancelled||interactionDisabled);pointer.current=null;setDrawing(false);
    if(failed.current)setHint(state.phase==='trace'?'Обведи контур заново':'Закрась фигуру заново');
    if(canvas.current.hasPointerCapture?.(event.pointerId))canvas.current.releasePointerCapture(event.pointerId);
    persist();refresh();
  };
  const sheetDone=snapshot?.progress.shapes.every(s=>s.phase==='done');
  const metrics=attempt?.progress();
  const cue=overview?'Весь лист':state?.phase==='done'?'Готово!':hint||(state?.retry?(state.phase==='fill'?'Закрась фигуру заново':'Обведи контур заново'):state?.phase==='fill'?'Закрась внутри фигуры':(metrics?.trace??0)>=.94?'Замкни линию — вернись к кольцу':(metrics?.trace??0)>0?'Продолжи от зелёной точки':'Обведи от точки и замкни линию');
  return <section className="coloring" aria-label="Тренировка закрашивания" data-phase={state?.phase??'loading'} data-sheet-count={snapshot?.sheet.shapes.length} onClick={e=>e.stopPropagation()}>
    <header className="coloring__tools"><span>{shape?.title} · {snapshot?`${snapshot.progress.index+1} / ${snapshot.sheet.shapes.length}`:''}</span>
      {compact&&<button type="button" disabled={interactionDisabled||drawing} onClick={()=>{attempt?.end(true);setOverview(v=>!v);setHint('');}}>{overview?'К фигуре':'Весь лист'}</button>}
    </header>
    <canvas ref={canvas} className="coloring__board" role="img" aria-label="Лист для обводки и закрашивания" data-view={JSON.stringify(view)}
      onContextMenu={e=>e.preventDefault()}
      onPointerDown={event=>{
        if(disabled||pointer.current!==null||event.button!==0)return;
        if(!['pen','mouse'].includes(event.pointerType)&&!(event.pointerType==='touch'&&['touch','passive_pen'].includes(sessionParams.inputMode))){setHint('Рисуй стилусом');return;}
        event.preventDefault();failed.current=false;
        if(!attempt.begin(point(event),event.timeStamp)){setHint(state.phase==='trace'?'Начни с зелёной точки':'Начни внутри фигуры');return;}
        setHint('');setDrawing(true);pointer.current=event.pointerId;event.currentTarget.setPointerCapture?.(event.pointerId);refresh();
      }}
      onPointerMove={event=>{if(!disabled&&pointer.current===event.pointerId){event.preventDefault();move(event);}}}
      onPointerUp={event=>end(event)} onPointerCancel={event=>end(event,true)} onLostPointerCapture={event=>end(event,true)}
/>
    <footer className="coloring__footer" aria-live="polite"><span>{cue}{state?.phase==='fill'&&!overview&&<small>Закрашено {Math.floor((metrics?.coverage??0)*100)}%</small>}</span>
      {state?.phase==='done'&&!overview&&<button type="button" disabled={interactionDisabled||(sheetDone&&!correct)} onClick={()=>{
        if(sheetDone){onAdvance?.();return;}
        nextColoringShape(snapshot);setHint('');persist();refresh();
      }}>{sheetDone?'Следующий лист':'Следующая фигура'} →</button>}
    </footer>
  </section>;
}
