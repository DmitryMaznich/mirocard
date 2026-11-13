import { useEffect, useRef, useState } from 'react';
import { createShapeAttempt } from './shapeAttempt.js';
import { sheetCell, frameTransform, cellTransform } from './shapes.js';
import ShapeDrawing from './ShapeDrawing.jsx';
import { trackProfile } from './trackProfile.js';
import { checkpointKey, readCheckpoint, saveCheckpoint, sheetKey, readSheet, saveSheet } from './checkpoint.js';
import './firstLines.css';

const fullView = { x: 0, y: 0, width: 1000, height: 1000 };
const compactView = { x: 220, y: 380, width: 560, height: 240 };

export default function FirstLines({ task, student, sessionId, sessionParams, sessionStatus,
  rewardAttemptBlocked = false, interactionDisabled = false, onCorrect, onStreakReset, onAdvance, playFeedback }) {
  // SessionScreen keys each task. Its stable session identity also survives an app reload.
  const key = checkpointKey(student?.id, sessionId, task.id);
  const kind = task.exerciseKind ?? 'short_line';
  const [attempt] = useState(() => createShapeAttempt(kind, readCheckpoint(key, kind, task.variant), trackProfile(sessionParams?.trackWidth, sessionParams?.inputMode), task.variant));
  const isSheet = sessionParams?.workSurface === 'sheet';
  const pageKey = sheetKey(student?.id, sessionId, task.sheetPage ?? 0);
  const [entries] = useState(() => readSheet(pageKey));
  const cell = sheetCell(task.sheetSlot ?? 0);
  const [peek, setPeek] = useState(false);
  const [, redraw] = useState(0);
  const [paused, setPaused] = useState(() => Boolean(task.breakBefore) && !attempt.state.parts.some(p => p.strokes.length || p.history?.length));
  const [paperPrevious, setPaperPrevious] = useState(Boolean(task.breakBefore));
  const paperEntries = paperPrevious ? readSheet(sheetKey(student?.id, sessionId, (task.sheetPage ?? 0) - 1))
    : entries.map((entry, i) => attempt.state.done && i === (task.sheetSlot ?? 0) ? attempt.state : entry);
  const [demo, setDemo] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const [demoLift, setDemoLift] = useState(null);
  const [hint, setHint] = useState(false);
  const [inputHint, setInputHint] = useState(false);
  const failedGesture = useRef(false), penSeen = useRef(false);
  const [compact, setCompact] = useState(false);
  const svg = useRef(null), pointer = useRef(null), reported = useRef(false), completed = useRef(false);
  const state = attempt.state;
  const current = state.parts[state.part];
  const liftCue = attempt.readyToLift;
  const part = attempt.shape.parts[state.part];
  const demoMs = part.type === 'line' ? 1200 : attempt.shape.steps[state.part];
  const correct = sessionStatus === 'answer_correct';
  const disabled = interactionDisabled || paused || correct || peek;
  const focusView = kind === 'short_line' ? compactView : { x: 140, y: 140, width: 720, height: 720 };
  const view = peek || !compact ? fullView : isSheet
    ? { x: cell.tx + focusView.x * cell.scale, y: cell.ty + focusView.y * cell.scale, width: focusView.width * cell.scale, height: focusView.height * cell.scale }
    : focusView;
  const refresh = () => {
    saveCheckpoint(key, state);
    if (isSheet && state.done) saveSheet(pageKey, task.sheetSlot ?? 0, state);
    redraw(n => n + 1);
  };

  useEffect(() => {
    // A local checkpoint can be newer than the app's async session snapshot. Reconcile
    // the spent attempt before accepting completion; never reset the shared policy.
    if (state.hadError && !rewardAttemptBlocked && !reported.current && !correct) {
      reported.current = true; onStreakReset(task.conceptId, task.cardId);
    }
    if (state.done && !completed.current && !correct) {
      if (isSheet) saveSheet(pageKey, task.sheetSlot ?? 0, state);
      completed.current = true; onCorrect(task.conceptId, task.cardId);
    }
  }, [state, rewardAttemptBlocked, correct, onStreakReset, onCorrect, task, isSheet, pageKey]);

  useEffect(() => {
    let disposed = false;
    const cancel = () => {
      if (disposed) return;
      attempt.end(true); pointer.current = null;
      saveCheckpoint(key, attempt.state); redraw(n => n + 1);
    };
    const hidden = () => { if (document.hidden) cancel(); };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      if (disposed || !svg.current) return;
      cancel();
      const rect = svg.current.getBoundingClientRect();
      setCompact(isSheet ? Math.min(rect.width, rect.height) < 700 : rect.width < 600 || rect.height < 300);
    }) : null;
    observer?.observe(svg.current);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      disposed = true;
      observer?.disconnect(); document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', cancel); window.removeEventListener('blur', cancel);
      attempt.end(true); saveCheckpoint(key, attempt.state);
    };
  }, [attempt, key, isSheet]);

  useEffect(() => {
    if (disabled) { attempt.end(true); pointer.current = null; }
  }, [disabled, attempt]);

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
    const rect = svg.current.getBoundingClientRect();
    const scale = Math.min(rect.width / view.width, rect.height / view.height);
    const mapped = { x: view.x + (event.clientX - rect.left - (rect.width - view.width * scale) / 2) / scale,
      y: view.y + (event.clientY - rect.top - (rect.height - view.height * scale) / 2) / scale };
    return isSheet ? { x: (mapped.x - cell.tx) / cell.scale, y: (mapped.y - cell.ty) / cell.scale } : mapped;
  };
  const announceFailure = () => {
    if (failedGesture.current) return;
    failedGesture.current = true;
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
    if (svg.current.hasPointerCapture?.(event.pointerId)) svg.current.releasePointerCapture(event.pointerId);
    refresh();
    if (done && !completed.current) { completed.current = true; onCorrect(task.conceptId, task.cardId); }
  };
  const drawing = attempt.active;
  const waitingLift = current.needsReturn && drawing;
  const started = current.strokes.length > 0;
  const phase = state.done || correct ? 'done' : inputHint ? 'stylus' : waitingLift ? 'error' : demo ? 'watch'
    : state.recovery === 'error' ? 'retry' : hint ? 'locate' : liftCue ? 'lift' : drawing ? 'draw' : started ? 'resume' : 'start';
  const cues = { done: 'Готово!', stylus: 'Рисуй стилусом', error: 'Стоп. Подними стилус', watch: demoLift !== null ? 'В конце — подними стилус' : 'Смотри или рисуй',
    retry: 'Повтори от точки', locate: 'Начни с точки', draw: 'Веди по дорожке', lift: 'Подними стилус', resume: 'Продолжи от точки', start: 'Рисуй от точки' };

  return <section className="first-lines" data-task-id={task.id} data-phase={phase} aria-label={`Первые линии — ${attempt.shape.title}`} onClick={event => event.stopPropagation()}>
    <div className="first-lines__tools">
      <button type="button" disabled={disabled || demo || state.done} onClick={() => { attempt.end(true); pointer.current = null; attempt.restartPart('sample'); setHint(false); setInputHint(false); refresh(); setDemoProgress(0); setDemoLift(null); setDemo(true); }} aria-label="Показать движение">
        <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M5 16h26M27 7l10 9-10 9" /></svg><span>Показать</span>
      </button>
      <button type="button" disabled={interactionDisabled} onClick={() => { attempt.end(true); pointer.current = null; setDemo(false); setPaperPrevious(false); setPaused(true); refresh(); }} aria-label="Повторить на бумаге"><svg viewBox="0 0 48 32" aria-hidden="true"><path d="M10 3h27v26H10zM17 11h13M17 19h13" /></svg></button>
    </div>
    <svg ref={svg} className="first-lines__board" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-label={`Нарисуй: ${attempt.shape.title}`} data-return={current.needsReturn || state.recovery === 'error' || undefined}
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
      onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}>
      {isSheet && <g className="first-lines__sheet">
        <path d="M500 0V1000M0 500H1000" fill="none" stroke="#dce5df" strokeWidth="2" />
        {entries.map((entry, i) => entry && i !== (task.sheetSlot ?? 0) && <g key={i} transform={cellTransform(sheetCell(i))}><ShapeDrawing state={entry} passive /></g>)}
      </g>}
      <g transform={isSheet ? cellTransform(cell) : undefined}>
        <ShapeDrawing state={state} width={sessionParams?.trackWidth} hint={hint} drawing={drawing} ready={Boolean(liftCue)} demoPart={state.part} demo={demo} demoProgress={demoProgress} demoLift={demoLift} />
      </g>
    </svg>
    {isSheet && compact && <button type="button" className="first-lines__overview" disabled={interactionDisabled || paused || demo} aria-label={peek ? 'К заданию' : 'Весь лист'} onClick={() => { attempt.end(true); pointer.current = null; setPeek(!peek); }}>
      <svg viewBox="0 0 1000 1000" aria-hidden="true">
        <rect x="4" y="4" width="992" height="992" fill="white" stroke="#a2b9ad" strokeWidth="10" />
        <path d="M500 0V1000M0 500H1000" stroke="#dce5df" strokeWidth="8" />
        {entries.map((entry, i) => entry && i !== (task.sheetSlot ?? 0) && <g key={i} transform={cellTransform(sheetCell(i))}><ShapeDrawing state={entry} passive /></g>)}
        <g transform={cellTransform(cell)}><ShapeDrawing state={state} passive /></g>
        <rect x={cell.x + 8} y={cell.y + 8} width="484" height="484" fill="none" stroke="#248b79" strokeWidth="16" />
      </svg><span>{peek ? 'К заданию' : 'Весь лист'}</span>
    </button>}
    <div className={`first-lines__footer first-lines__footer--${phase}`} aria-live="polite">
      {state.done || correct ? <div className="first-lines__complete"><span>✓ Готово!</span><button type="button" disabled={interactionDisabled || !correct} onClick={onAdvance}><svg viewBox="0 0 48 32" aria-hidden="true"><path d="M5 16h30M27 7l10 9-10 9" /></svg> Следующее задание</button></div>
        : peek ? <span>Весь лист</span> : <span className="first-lines__cue" aria-label={cues[phase]}>
          <svg viewBox="0 0 48 40" aria-hidden="true">
            {['error', 'lift'].includes(phase) || demoLift !== null && demo ? <><path d="M24 35V6M13 17 24 6l11 11" /><path d="M8 35h32" /></>
              : phase === 'stylus' ? <path d="m12 30 20-25 8 6-20 25-11 2Z" />
                : <><circle cx="10" cy="20" r="7" fill="currentColor"/><path d="M24 20h18M34 12l8 8-8 8"/></>}
          </svg><span>{cues[phase]}</span>
        </span>}
    </div>
    {paused && <div className="first-lines__pause" role="dialog" aria-label="Повтори на бумаге">
      <svg viewBox="0 0 1000 1000" aria-hidden="true">
        <rect x="15" y="15" width="970" height="970" strokeWidth="18" />
        {isSheet ? <>
          <path d="M500 15V985M15 500H985" strokeWidth="12" />
          {paperEntries.map((entry, i) => entry && <g key={i} transform={cellTransform(sheetCell(i))}><ShapeDrawing state={entry} passive /></g>)}
          {!paperPrevious && !state.done && <g transform={cellTransform(cell)} data-paper-target="true">
            {attempt.shape.parts.map((part, i) => <path key={i} transform={frameTransform(part.frame)} d={part.d} strokeWidth={18 / part.frame.scale} />)}
          </g>}
        </> : attempt.shape.parts.map((part, i) => <path key={i} transform={frameTransform(part.frame)} d={part.d} strokeWidth="24" />)}
      </svg>
      <span>Повтори на бумаге</span>
      <button type="button" disabled={interactionDisabled} onClick={() => setPaused(false)}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m10 6 16 10-16 10Z" /></svg> Рисовать на экране</button>
    </div>}
  </section>;
}
