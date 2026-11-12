import { useEffect, useRef, useState } from 'react';
import { createLineAttempt, LINE } from './lineAttempt.js';
import { checkpointKey, readCheckpoint, saveCheckpoint } from './checkpoint.js';
import './firstLines.css';

const pathPoints = points => points.map(p => `${p.x},${p.y}`).join(' ');

export default function FirstLines({ task, student, sessionId, sessionParams, sessionStatus,
  rewardAttemptBlocked = false, interactionDisabled = false, onCorrect, onStreakReset, onAdvance }) {
  // SessionScreen keys each task. Its stable session identity also survives an app reload.
  const key = checkpointKey(student?.id, sessionId, task.id);
  const [attempt] = useState(() => createLineAttempt(readCheckpoint(key)));
  const [, redraw] = useState(0);
  const [paused, setPaused] = useState(Boolean(task.breakBefore));
  const [demo, setDemo] = useState(false);
  const [hint, setHint] = useState(false);
  const [small, setSmall] = useState(false);
  const svg = useRef(null), pointer = useRef(null), reported = useRef(false), completed = useRef(false);
  const state = attempt.state;
  const correct = sessionStatus === 'answer_correct';
  const disabled = interactionDisabled || paused || demo || correct || small;
  const refresh = () => { saveCheckpoint(key, state); redraw(n => n + 1); };

  useEffect(() => {
    // A local checkpoint can be newer than the app's async session snapshot. Reconcile
    // the spent attempt before accepting completion; never reset the shared policy.
    if (state.hadError && !rewardAttemptBlocked && !reported.current && !correct) {
      reported.current = true; onStreakReset(task.conceptId, task.cardId);
    }
    if (state.done && !completed.current && !correct) {
      completed.current = true; onCorrect(task.conceptId, task.cardId);
    }
  }, [state, rewardAttemptBlocked, correct, onStreakReset, onCorrect, task]);

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
      setSmall(Math.min(rect.width, rect.height) < 600);
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
  }, [attempt, key]);

  useEffect(() => {
    if (disabled) { attempt.end(true); pointer.current = null; }
  }, [disabled, attempt]);

  useEffect(() => {
    if (!demo) return undefined;
    const timer = setTimeout(() => setDemo(false), 1800);
    return () => clearTimeout(timer);
  }, [demo]);

  const point = event => {
    const rect = svg.current.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    return { x: (event.clientX - rect.left - (rect.width - size) / 2) * 1000 / size,
      y: (event.clientY - rect.top - (rect.height - size) / 2) * 1000 / size };
  };
  const move = event => {
    const samples = event.nativeEvent?.getCoalescedEvents?.() ?? [];
    for (const sample of [...samples, event]) {
      const result = attempt.move(point(sample), sample.timeStamp);
      if (result.mistake && !reported.current && !rewardAttemptBlocked) {
        reported.current = true;
        onStreakReset(task.conceptId, task.cardId);
        try { navigator.vibrate?.(30); } catch { /* Optional: unavailable on iPad. */ }
      }
    }
  };
  const finish = (event, cancelled = false) => {
    if (pointer.current !== event.pointerId) return;
    if (!cancelled && !disabled) move(event);
    const done = attempt.end(cancelled || disabled);
    pointer.current = null;
    if (svg.current.hasPointerCapture?.(event.pointerId)) svg.current.releasePointerCapture(event.pointerId);
    refresh();
    if (done && !completed.current) { completed.current = true; onCorrect(task.conceptId, task.cardId); }
  };

  return <section className="first-lines" aria-label="Первые линии — короткая прямая" onClick={event => event.stopPropagation()}>
    <div className="first-lines__tools">
      <button type="button" disabled={disabled || state.done} onClick={() => { attempt.end(true); pointer.current = null; setDemo(true); }} aria-label="Показать движение">
        <svg viewBox="0 0 48 32" aria-hidden="true"><path d="M5 16h26M27 7l10 9-10 9" /></svg><span>Показать</span>
      </button>
      <button type="button" disabled={interactionDisabled || correct} onClick={() => { attempt.end(true); pointer.current = null; setDemo(false); setPaused(true); refresh(); }} aria-label="Пауза"><svg viewBox="0 0 48 32" aria-hidden="true"><path d="M18 6v20M30 6v20" /></svg></button>
    </div>
    <svg ref={svg} className="first-lines__board" viewBox="0 0 1000 1000" role="img" aria-label="Проведи линию от точки к домику" data-return={state.needsReturn || undefined}
      onContextMenu={event => event.preventDefault()}
      onPointerDown={event => {
        if (disabled || state.done || pointer.current !== null || event.button !== 0) return;
        if (event.pointerType !== 'mouse' && event.pointerType !== 'pen' && !(event.pointerType === 'touch' && sessionParams?.inputMode === 'touch')) return;
        event.preventDefault();
        if (!attempt.begin(point(event), event.timeStamp)) { setHint(true); return; }
        setHint(false); pointer.current = event.pointerId; event.currentTarget.setPointerCapture?.(event.pointerId); refresh();
      }}
      onPointerMove={event => { if (!disabled && pointer.current === event.pointerId) { event.preventDefault(); move(event); refresh(); } }}
      onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={event => finish(event, true)}>
      <path className="first-lines__track" d="M320 500H680" />
      <circle cx="320" cy="500" r="22" fill="#248b79" />
      <path className="first-lines__house" d="M653 494v40h54v-40M644 496l36-32 36 32M674 534v-22h13v22" />
      {state.strokes.map((stroke, index) => <g key={index}>
        {stroke.points.length === 1 && <circle cx={stroke.points[0].x} cy={stroke.points[0].y} r="7" fill="#315b86" />}
        <polyline className="first-lines__ink" points={pathPoints(stroke.failedFrom === null ? stroke.points : stroke.points.slice(0, stroke.failedFrom + 1))} />
        {stroke.failedFrom !== null && <polyline className="first-lines__ink first-lines__ink--error" points={pathPoints(stroke.points.slice(stroke.failedFrom))} />}
      </g>)}
      {state.marks.map((p, index) => <circle key={index} className="first-lines__mark" cx={p.x} cy={p.y} r="22" />)}
      {!state.done && (state.needsReturn || hint || state.progress > LINE.start) && <circle className="first-lines__resume" cx={state.anchor.x} cy={state.anchor.y} r="34" />}
      {demo && <circle className="first-lines__demo" cx="320" cy="500" r="16" />}
    </svg>
    <div className="first-lines__footer" aria-live="polite">
      {state.done || correct ? <button type="button" disabled={interactionDisabled || !correct} onClick={onAdvance}><svg viewBox="0 0 48 32" aria-hidden="true"><path d="M5 16h30M27 7l10 9-10 9" /></svg> Дальше</button>
        : <span className="first-lines__cue" aria-label={state.needsReturn ? 'Подними стилус и продолжи от отмеченного места' : 'От точки к домику'}>
          <svg viewBox="0 0 130 40" aria-hidden="true"><circle cx="12" cy="22" r="7" fill="currentColor" /><path d="M35 22h34M60 13l10 9-10 9" />
            {state.needsReturn ? <path d="M103 33V7M94 16l9-9 9 9" /> : <path d="M96 20v14h23V20M91 21l16-14 17 14M104 34V24h7v10" />}
          </svg>{state.needsReturn && <span>Продолжи отсюда</span>}
        </span>}
    </div>
    {paused && <div className="first-lines__pause" role="dialog" aria-label="Пауза — можно повторить линию на бумаге">
      <svg viewBox="0 0 160 120" aria-hidden="true"><path d="M20 10h110v100H20zM45 65h58M95 57l8 8-8 8" /></svg>
      <span>На бумаге</span>
      <button type="button" disabled={interactionDisabled} onClick={() => setPaused(false)}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="m10 6 16 10-16 10Z" /></svg> Продолжить</button>
    </div>}
    {small && <div className="first-lines__size" role="status">
      <svg viewBox="0 0 120 100" aria-hidden="true"><rect x="30" y="10" width="60" height="80" rx="8" /><path d="M46 50h28M55 40l-10 10 10 10M65 40l10 10-10 10" /></svg>
      <strong>Нужно больше места</strong><span>Поверните планшет или откройте занятие на большем экране.</span>
    </div>}
  </section>;
}
