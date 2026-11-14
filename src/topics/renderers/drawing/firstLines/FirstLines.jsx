import { useEffect, useMemo, useRef, useState } from 'react';
import { createShapeAttempt } from './shapeAttempt.js';
import { sheetCell, shapeDefinition } from './shapes.js';
import CanvasBoard from './CanvasBoard.jsx';
import { trackProfile, screenProfile, scaledProfile } from './trackProfile.js';
import { checkpointKey, readCheckpoint, saveCheckpoint, sheetKey, readSheet, saveSheet, gridKey, readGrid, saveGrid } from './checkpoint.js';
import { fitShape, focusedFit, fromPlacement, automaticGrid, sheetPosition, practiceScene } from './layout.js';
import './firstLines.css';

const defaultGrid = {columns:2,rows:2};
const fullView = { x: 0, y: 0, width: 1000, height: 1000 };
const compactView = { x: 220, y: 380, width: 560, height: 240 };
// Timings are fixed on purpose: the same event always looks the same (docs/drawing-first-lines-redesign-brief.md).
const ADVANCE_MS = 900, REVEAL_START_MS = 600, REVEAL_MOVE_MS = 900, REVEAL_HOLD_MS = 1000, IDLE_MS = [5000, 10000];
const seenKey = (studentId, sessionId) => `drawing-first-lines-seen:${studentId ?? 'local'}:${sessionId}`;
// The first task of each kind in a lesson is modelled once by itself; later ones only on ▶.
function firstOfKind(studentId, sessionId, kind) {
  try {
    const key = seenKey(studentId, sessionId), seen = JSON.parse(localStorage.getItem(key)) ?? [];
    if (seen.includes(kind)) return false;
    localStorage.setItem(key, JSON.stringify([...seen, kind])); return true;
  } catch { return false; }
}
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, width: a.width + (b.width - a.width) * t, height: a.height + (b.height - a.height) * t });

function useWorksheet(key,capacity){
  const entries=useMemo(()=>readSheet(key,capacity),[key,capacity]);
  const shapes=useMemo(()=>entries.map(e=>e?shapeDefinition(e.kind,e.variant):null),[entries]);
  return {entries,shapes};
}

export default function FirstLines({ task, student, sessionId, sessionParams, sessionStatus,
  rewardAttemptBlocked = false, interactionDisabled = false, onCorrect, onStreakReset, onAdvance, playFeedback }) {
  // SessionScreen keys each task. Its stable session identity also survives an app reload.
  const key = checkpointKey(student?.id, sessionId, task.id);
  const kind = task.exerciseKind ?? 'short_line';
  const procedural = [4,5,6,7].includes(task.variant?.schema);
  const automatic = Boolean(task.autoSheet && sessionParams?.workSurface === 'sheet');
  // «Крупно, лист в конце» (default): one large task at a time, the sheet appears when it is full.
  const large = procedural && automatic && sessionParams?.sheetView !== 'sheet';
  const autoAdvance = sessionParams?.advance !== 'tap';
  const layoutKey = gridKey(student?.id,sessionId);
  const [gridChoice,setGridChoice] = useState(()=>automatic?readGrid(layoutKey):null);
  const [reveal,setReveal] = useState(0);
  const [idleState,setIdleState] = useState({key:null,level:0});
  const [liftSince,setLiftSince] = useState(null);
  const grid=automatic&&gridChoice?gridChoice:defaultGrid;
  const layoutReady=!automatic||gridChoice!==null;
  const {page,slot,capacity}=sheetPosition(automatic?task:{...task,autoSheet:false},grid);
  const [boardSize, setBoardSize] = useState({ width: 1000, height: 1000 });
  const pxProfile = screenProfile(sessionParams?.inputMode);
  const isSheet = sessionParams?.workSurface === 'sheet';
  const targetShape=useMemo(()=>shapeDefinition(kind,task.variant),[kind,task.variant]);
  const scene = practiceScene(boardSize,isSheet,slot,grid,targetShape,task.variant,pxProfile,false,large);
  const [attempt, setAttempt] = useState(() => {
    const fitted=scene.placement;
    return createShapeAttempt(kind,readCheckpoint(key,kind,task.variant),procedural?scaledProfile(pxProfile,fitted.scale):trackProfile(sessionParams?.trackWidth,sessionParams?.inputMode),task.variant);
  });
  const pageKey = sheetKey(student?.id, sessionId, page);
  const {entries,shapes:entryShapes}=useWorksheet(pageKey,capacity);
  const cell = sheetCell(slot);
  const [, redraw] = useState(0);
  const [demo, setDemo] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const [demoLift, setDemoLift] = useState(null);
  const [hint, setHint] = useState(false);
  const [inputHint, setInputHint] = useState(false);
  const failedGesture = useRef(false), penSeen = useRef(false);
  const [compact, setCompact] = useState(false);
  const board = useRef(null), pointer = useRef(null), reported = useRef(false), completed = useRef(false);
  const state = attempt.state;
  const current = state.parts[state.part];
  const liftCue = attempt.readyToLift;
  const part = attempt.shape.parts[state.part];
  const demoMs = part.type === 'line' ? 1200 : attempt.shape.steps[state.part];
  const correct = sessionStatus === 'answer_correct';
  const disabled = interactionDisabled || correct || !layoutReady || scene.placement.needsSpace;
  const endsSheet = large && slot === capacity - 1 && task.number < 15, revealing = endsSheet && state.done;
  const focusView = kind === 'short_line' ? compactView : { x: 140, y: 140, width: 720, height: 720 };
  const legacyView = !compact ? fullView : isSheet
    ? { x: cell.tx + focusView.x * cell.scale, y: cell.ty + focusView.y * cell.scale, width: focusView.width * cell.scale, height: focusView.height * cell.scale }
    : focusView;
  const placement = scene.placement;
  const view = procedural ? (large ? (reveal > 0 ? mix(scene.cell, scene.full, reveal) : scene.view) : scene.view) : legacyView;
  const drawingPlacement=procedural?placement:isSheet?cell:{tx:0,ty:0,scale:1};
  const previousDrawings=entries.flatMap((entry,index)=>{
    if(!entry||index===slot)return [];
    const fitted=procedural?(large?focusedFit:fitShape)(entryShapes[index],scene.areas[index],entry.variant,pxProfile):sheetCell(index);
    return [{state:entry,shape:entryShapes[index],placement:fitted,profile:procedural?scaledProfile(pxProfile,fitted.scale):entry.profile??trackProfile(sessionParams?.trackWidth,sessionParams?.inputMode),passive:true}];
  });
  // The app's engine advances by itself after this delay (no «Готово», no «Следующее задание»).
  const credit = () => onCorrect(task.conceptId, task.cardId, autoAdvance
    ? { autoAdvance: true, autoAdvanceDelayMs: endsSheet ? REVEAL_START_MS + REVEAL_MOVE_MS + REVEAL_HOLD_MS : ADVANCE_MS } : undefined);
  const refresh = () => {
    saveCheckpoint(key, state);
    if (isSheet && layoutReady && state.done) saveSheet(pageKey, slot, state,capacity);
    redraw(n => n + 1);
  };

  useEffect(()=>{
    const root=board.current?.closest('.session-screen');root?.classList.add('first-lines-session');
    return()=>root?.classList.remove('first-lines-session');
  },[]);

  useEffect(() => {
    if(!layoutReady)return;
    if(isSheet&&state.done)saveSheet(pageKey,slot,state,capacity);
    // A local checkpoint can be newer than the app's async session snapshot. Reconcile
    // the spent attempt before accepting completion; never reset the shared policy.
    if (state.hadError && !rewardAttemptBlocked && !reported.current && !correct) {
      reported.current = true; onStreakReset(task.conceptId, task.cardId);
    }
    if (state.done && !completed.current && !correct) {
      completed.current = true; credit();
    }
  }, [state, rewardAttemptBlocked, correct, onStreakReset, onCorrect, task, isSheet, pageKey, slot, capacity, layoutReady]); // eslint-disable-line react-hooks/exhaustive-deps -- credit() is guarded by completed.current

  useEffect(() => {
    let disposed = false;
    const cancel = () => {
      if (disposed) return;
      attempt.end(true); pointer.current = null;
      saveCheckpoint(key, attempt.state); redraw(n => n + 1);
    };
    const hidden = () => { if (document.hidden) cancel(); };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (disposed || !board.current) return;
      const rect = board.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      if (procedural) {
        const width=Math.round(rect.width),height=Math.round(rect.height);
        if(width===boardSize.width&&height===boardSize.height&&layoutReady)return;
        const nextGrid=automatic?(gridChoice??automaticGrid({width,height},sessionParams?.inputMode,large)):grid;
        if(automatic&&!gridChoice){saveGrid(layoutKey,nextGrid);setGridChoice(nextGrid);}
        const nextPosition=sheetPosition(automatic?task:{...task,autoSheet:false},nextGrid);
        cancel();
        const nextScene=practiceScene({width,height},isSheet,nextPosition.slot,nextGrid,attempt.shape,task.variant,screenProfile(sessionParams?.inputMode),false,large);
        const next=nextScene.placement;
        setBoardSize({width,height});
        setAttempt(previous=>createShapeAttempt(kind,structuredClone(previous.state),scaledProfile(screenProfile(sessionParams?.inputMode),next.scale),task.variant));
      } else {
        cancel(); setCompact(rect.width < 600 || rect.height < 300);
      }
    }) : null;
    observer?.observe(board.current);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      disposed = true;
      observer?.disconnect(); document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', cancel); window.removeEventListener('blur', cancel);
      attempt.end(true); saveCheckpoint(key, attempt.state);
    };
  }, [attempt, key, isSheet, procedural, boardSize.width, boardSize.height, kind, task, slot, task.variant, sessionParams?.inputMode, automatic, gridChoice, layoutKey, layoutReady, grid, large]);

  useEffect(() => {
    if (disabled) { attempt.end(true); pointer.current = null; }
  }, [disabled, attempt]);

  // Reopened after a credited task (reload, app switch): the engine's own timer is gone, so move on here.
  useEffect(() => {
    if (!autoAdvance || !correct || completed.current || interactionDisabled) return undefined;
    const timer = setTimeout(onAdvance, ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [autoAdvance, correct, interactionDisabled, onAdvance]);

  // Model the movement once on the first task of each kind (errorless start). Never on idle.
  const autoDemo = useRef(false);
  useEffect(() => {
    if (autoDemo.current || !procedural || disabled || state.done || current.strokes.length || (current.history?.length ?? 0)) return undefined;
    // Decided inside the timer: a resize recreates the attempt and would cancel an earlier decision.
    const timer = setTimeout(() => {
      if (autoDemo.current) return;
      autoDemo.current = true;
      if (firstOfKind(student?.id, sessionId, kind) && !attempt.active) { setDemoProgress(0); setDemoLift(null); setDemo(true); }
    }, 500);
    return () => clearTimeout(timer);
  }, [procedural, disabled, state.done, current, student?.id, sessionId, kind, attempt]);

  // A long pause only makes the start point call louder (5 s, then 10 s).
  const waiting = !disabled && !state.done && !demo && !attempt.active;
  const waitKey = waiting ? `${state.part}:${current.strokes.length}:${hint}` : null;
  const idle = idleState.key === waitKey && waitKey !== null ? idleState.level : 0;
  useEffect(() => {
    if (waitKey === null) return undefined;
    const timers = IDLE_MS.map((ms, i) => setTimeout(() => setIdleState({ key: waitKey, level: i + 1 }), ms));
    return () => timers.forEach(clearTimeout);
  }, [waitKey]);

  // Sheet full: the camera moves out to show the whole sheet, then the next task comes by itself.
  useEffect(() => {
    if (!revealing) return undefined;
    const linear = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let frame, started;
    const animate = time => {
      started ??= time;
      const t = Math.max(0, Math.min(1, (time - started) / REVEAL_MOVE_MS));
      setReveal(linear ? 1 : Math.max(.001, t * t * (3 - 2 * t)));
      if (t < 1 && !linear) frame = requestAnimationFrame(animate);
    };
    const timer = setTimeout(() => { frame = requestAnimationFrame(animate); }, REVEAL_START_MS);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [revealing]);

  useEffect(() => {
    if (!inputHint) return undefined;
    const timer = setTimeout(() => setInputHint(false), 2000);
    return () => clearTimeout(timer);
  }, [inputHint]);

  useEffect(() => {
    if (!demo) return undefined;
    let frame, started;
    const linear = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const animate = time => {
      started ??= time;
      const elapsed = time - started - 150;
      const progress = Math.max(0, Math.min(1, elapsed / demoMs));
      const sample = { progress: linear ? progress : progress * progress * (3 - 2 * progress), lift: progress === 1 ? state.part : null };
      // One progress value drives both the drawn line and its tip, including Safari.
      setDemoProgress(sample.progress); setDemoLift(sample.lift);
      if (elapsed < demoMs) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const timer = setTimeout(() => setDemo(false), demoMs + 1200);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [demo, attempt, demoMs, state.part]);

  const point = event => {
    const rect = board.current.getBoundingClientRect();
    const scale = Math.min(rect.width / view.width, rect.height / view.height);
    const mapped = { x: view.x + (event.clientX - rect.left - (rect.width - view.width * scale) / 2) / scale,
      y: view.y + (event.clientY - rect.top - (rect.height - view.height * scale) / 2) / scale };
    if (procedural) return fromPlacement(placement, mapped);
    return isSheet ? { x: (mapped.x - cell.tx) / cell.scale, y: (mapped.y - cell.ty) / cell.scale } : mapped;
  };
  const announceFailure = () => {
    if (failedGesture.current) return;
    failedGesture.current = true; setLiftSince(performance.now());
    if (!reported.current && !rewardAttemptBlocked) { reported.current = true; onStreakReset(task.conceptId, task.cardId); }
    else playFeedback?.('incorrect'); // New gesture: familiar sound, no second reward event.
    try { navigator.vibrate?.(30); } catch { /* Optional on supported devices. */ }
  };
  const move = event => {
    if (attempt.state.parts[attempt.state.part].needsReturn) return;
    const samples = event.nativeEvent?.getCoalescedEvents?.() ?? [];
    for (const sample of [...samples, event]) {
      const result = attempt.move(point(sample), sample.timeStamp);
      if (result.failed) { announceFailure(); break; }
    }
  };
  const finish = (event, cancelled = false) => {
    if (pointer.current !== event.pointerId) return;
    if (!cancelled && !disabled) move(event);
    const failures = state.failures ?? 0;
    const done = attempt.end(cancelled || disabled);
    if ((state.failures ?? 0) > failures) announceFailure();
    pointer.current = null;
    if (board.current.hasPointerCapture?.(event.pointerId)) board.current.releasePointerCapture(event.pointerId);
    refresh();
    if (done && !completed.current) { completed.current = true; credit(); }
  };
  const drawing = attempt.active;
  const waitingLift = current.needsReturn && drawing;
  const started = current.strokes.length > 0;
  const phase = state.done || correct ? 'done' : inputHint ? 'stylus' : waitingLift ? 'error' : demo ? 'watch'
    : state.recovery === 'error' ? 'retry' : hint ? 'locate' : liftCue ? 'lift' : drawing ? 'draw' : started ? 'resume' : 'start';
  const cues = { done: 'Готово!', stylus: 'Рисуй стилусом', error: 'Стоп. Подними стилус', watch: demoLift !== null ? 'В конце — подними стилус' : 'Смотри или рисуй',
    retry: 'Повтори от точки', locate: 'Начни с точки', draw: 'Веди по дорожке', lift: 'Подними стилус', resume: 'Продолжи от точки', start: 'Рисуй от точки' };

  const item = {state,shape:attempt.shape,placement:drawingPlacement,profile:state.profile,hint,drawing,demo,demoProgress,demoPart:state.part,demoLift,
    success:procedural&&state.done,idle,liftCue:waitingLift&&liftSince!==null?{type:'error',since:liftSince}:liftCue&&drawing?{type:'finish'}:null};
  // No text on the child's screen: every cue is drawn on the board. The words stay for screen readers.
  return <section className="first-lines" data-task-id={task.id} data-phase={phase} data-movement={task.variant?.schema===7?'wide':'regular'} data-layout={large?'large':'sheet'} data-reveal={reveal>0||undefined} data-idle={idle||undefined} data-sheet-capacity={capacity} data-sheet-page={page} data-sheet-slot={slot} aria-label={`Первые линии — ${attempt.shape.title}`} onClick={event => event.stopPropagation()}>
    <CanvasBoard boardRef={board} className="first-lines__board" view={view} placement={drawingPlacement} activeState={state}
      drawings={reveal>0?[...previousDrawings,item].map(d=>({...d,inkScale:1+2*reveal})):[...previousDrawings,item]} pulse={!disabled&&!state.done||Boolean(item.liftCue)}
      onSurfaceLost={()=>{attempt.end(true);pointer.current=null;refresh();}} role="img" aria-label={`Нарисуй: ${attempt.shape.title}`} style={placement.needsSpace?{visibility:'hidden'}:undefined} data-return={current.needsReturn || state.recovery === 'error' || undefined}
      onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (disabled || state.done || pointer.current !== null || event.button !== 0) return;
        if (event.pointerType !== 'mouse' && event.pointerType !== 'pen' && !(event.pointerType === 'touch' && ['touch', 'passive_pen'].includes(sessionParams?.inputMode))) { if (!penSeen.current) setInputHint(true); return; }
        if (demo) setDemo(false);
        if (event.pointerType === 'pen') penSeen.current = true;
        event.preventDefault();
        if (!attempt.begin(point(event), event.timeStamp)) { setHint(true); return; }
        setHint(false); setInputHint(false); failedGesture.current = false; pointer.current = event.pointerId; event.currentTarget.setPointerCapture?.(event.pointerId); refresh();
      }}
      onPointerMove={event => { if (!disabled && pointer.current === event.pointerId) { event.preventDefault(); if (!attempt.state.parts[attempt.state.part].needsReturn) { move(event); refresh(); } } }}
      onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)} />
    <button type="button" className="first-lines__show" data-active={demo||undefined} disabled={disabled || demo || state.done} onClick={() => { attempt.end(true); pointer.current = null; attempt.restartPart('sample'); setHint(false); setInputHint(false); refresh(); setDemoProgress(0); setDemoLift(null); setDemo(true); }} aria-label="Показать движение">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M11 7.5v17l14-8.5z" /></svg>
    </button>
    {inputHint&&<div className="first-lines__pen-hint" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="m14 50 4-14 26-26 10 10-26 26zM18 36l10 10M40 14l10 10" /></svg></div>}
    {placement.needsSpace&&<div className="first-lines__room" role="status"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 14h24v36H20zM8 30a24 24 0 0 1 40-16M48 4v10H38M56 34a24 24 0 0 1-40 16M16 60V50h10"/></svg><span>Кубу нужно больше места.<br/>Поверни экран или увеличь область занятия.</span></div>}
    {!autoAdvance && correct && <button type="button" className="first-lines__next" disabled={interactionDisabled} onClick={onAdvance} aria-label="Следующее задание">
      <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 24h24M25 13l11 11-11 11" /></svg>
    </button>}
    <p className="first-lines__live" aria-live="polite">{placement.needsSpace ? '' : cues[phase]}</p>
  </section>;
}
