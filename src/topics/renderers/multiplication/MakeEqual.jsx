// Ступень 1 «Сделай поровну» — docs/multiplication-methodology.md, «Ступень 1».
import { useEffect, useMemo, useRef, useState } from "react";
import { makeEqualExercise, seededRng } from "./mechanics.js";
import { demoPending, lessonLevel, markDemoPlayed, recordResult } from "./levelStore.js";
import { APPLE } from "./assets.js";
import { Group, Rows, Say } from "./shared.jsx";
import { msg, useTimers } from "./lesson.js";

const IDLE_MS = 6000;
const deviation = (counts, target) => counts.reduce((s, x) => s + Math.abs(x - target), 0);
const centre = (mat, i) => mat?.querySelector(`[data-group="${i}"]`)?.getBoundingClientRect();

// The demo hand and item live on <body> (position: fixed) only while they move.
function playDemo(mat, from, to) {
  const a = centre(mat, from), b = centre(mat, to);
  if (!a || !b) return () => {};
  const hand = Object.assign(document.createElement("div"), { className: "mul-demo-hand", textContent: "👆" });
  const item = Object.assign(document.createElement("img"), { className: "mul-demo-item", src: APPLE, alt: "" });
  document.body.append(item, hand);
  const p = [a.left + a.width / 2, a.top + a.height / 2], q = [b.left + b.width / 2, b.top + b.height / 2];
  const kf = (pt, o = 1) => ({ left: `${pt[0]}px`, top: `${pt[1]}px`, opacity: o });
  const frames = [kf(p, 0), kf(p), kf(q), kf(q, 0)];
  const opt = { duration: 1500, iterations: 2, easing: "ease-in-out" };
  const stop = () => { hand.remove(); item.remove(); };
  item.animate?.(frames, opt);
  const anim = hand.animate?.(frames, opt);
  if (anim?.finished) anim.finished.then(stop, stop); else setTimeout(stop, 3000);
  return stop;
}

// Hint arrow «откуда → куда», over the table, in table coordinates.
function arrowBetween(mat, from, to) {
  const m = mat?.getBoundingClientRect(), a = centre(mat, from), b = centre(mat, to);
  if (!m || !a || !b) return null;
  const x1 = a.left + a.width / 2 - m.left, y1 = Math.max(14, a.top - m.top - 14);
  const x2 = b.left + b.width / 2 - m.left, y2 = Math.max(14, b.top - m.top - 14);
  return { left: x1, top: y1, width: Math.hypot(x2 - x1, y2 - y1), angle: Math.atan2(y2 - y1, x2 - x1) };
}

export default function MakeEqual({ task, sessionId, student, soundEnabled, interactionDisabled, onCorrect }) {
  const lesson = useMemo(() => lessonLevel({ sessionId, modeId: task.type, studentId: student?.id, param: task.level }), [sessionId, task, student?.id]);
  const level = lesson.level;
  const ex = useMemo(() => makeEqualExercise(level, seededRng(task.seed)), [task, level]);
  const [counts, setCounts] = useState(ex.counts);
  const [sel, setSel] = useState(null);
  const [hint, setHint] = useState(0);          // 0 none, 1 «где больше», 2 стрелка
  const [shownHint, setShownHint] = useState(level === "R" ? 1 : 0);
  const [drop, setDrop] = useState(null);
  const [done, setDone] = useState(false);
  const [say, setSay] = useState(msg(task, "make.prompt"));
  const stats = useRef({ moves: 0, wasted: 0 });
  const matRef = useRef(null);
  const drag = useRef(null);
  const justDragged = useRef(false);
  const idle = useRef(null);
  const later = useTimers();
  const n = counts.length;

  const from = counts.indexOf(Math.max(...counts));
  const to = counts.indexOf(Math.min(...counts));

  const [arrow, setArrow] = useState(null);
  function raiseHint(k, current = counts) {
    setHint((h) => Math.max(h, k));
    setShownHint((h) => Math.max(h, k));
    if (k >= 2) setArrow(arrowBetween(matRef.current, current.indexOf(Math.max(...current)), current.indexOf(Math.min(...current))));
  }
  function armIdle() {
    clearTimeout(idle.current);
    idle.current = setTimeout(() => { if (!done) { raiseHint(Math.min(2, shownHint + 1)); } }, IDLE_MS);
  }
  useEffect(() => { armIdle(); return () => clearTimeout(idle.current); }); // re-armed after every change

  // Образец в первом задании занятия: рука дважды переносит предмет «откуда → куда».
  const stopDemo = useRef(() => {});
  useEffect(() => {
    if (!demoPending({ sessionId, modeId: task.type })) return undefined;
    const id = setTimeout(() => {
      markDemoPlayed({ sessionId, modeId: task.type });
      stopDemo.current = playDemo(matRef.current, from, to);
      setSay(msg(task, "make.watch"));
      later(() => setSay((s) => (s === msg(task, "make.watch") ? msg(task, "make.prompt") : s)), 3000);
    }, 700);
    return () => { clearTimeout(id); stopDemo.current(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function move(a, b) {
    if (done || a === b || counts[a] === 0) return;
    const next = [...counts]; next[a]--; next[b]++;
    stats.current.moves++;
    if (deviation(next, ex.target) >= deviation(counts, ex.target)) stats.current.wasted++;
    setCounts(next);
    setShownHint(0); setArrow(null);
    if (next.every((x) => x === ex.target)) return finish();
    if (stats.current.wasted >= 4) raiseHint(2, next); else if (stats.current.wasted >= 2) raiseHint(1, next);
  }
  function finish() {
    setDone(true); setArrow(null);
    clearTimeout(idle.current);
    const clean = hint === 0 && stats.current.moves <= ex.min + 1;
    recordResult({ sessionId, modeId: task.type, studentId: student?.id }, { clean, down: hint === 2 });
    setSay(msg(task, "make.done", { n: ex.target }));
    onCorrect(task.conceptId, task.cardId);
  }

  function onTap(i) {
    if (done || interactionDisabled || justDragged.current) return;
    if (sel === null) { if (counts[i] > 0) setSel(i); return; }
    const a = sel; setSel(null);
    if (a !== i) move(a, i);
  }
  function groupAt(x, y) {
    const el = document.elementFromPoint(x, y)?.closest("[data-group]");
    return el && matRef.current?.contains(el) ? Number(el.dataset.group) : null;
  }
  function onPointerDown(e) {
    stopDemo.current();
    const i = groupAt(e.clientX, e.clientY);
    if (i === null || done || interactionDisabled || counts[i] === 0) return;
    // No pointer capture yet: a plain tap must stay a click on the plate («откуда», потом «куда»).
    drag.current = { from: i, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, over: null, ghost: null };
  }
  function onPointerMove(e) {
    const d = drag.current; if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10) return;
    if (!d.moved) {
      d.moved = true; setSel(null); setShownHint(0);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
      d.ghost = Object.assign(document.createElement("img"), { className: "mul-ghost", src: APPLE, alt: "" });
      document.body.append(d.ghost);
      setCounts((c) => { const x = [...c]; x[d.from]--; return x; });
    }
    d.ghost.style.left = `${e.clientX}px`; d.ghost.style.top = `${e.clientY}px`;
    const over = groupAt(e.clientX, e.clientY);
    d.over = over !== d.from ? over : null;
    setDrop(d.over);
  }
  function onPointerEnd(e) {
    const d = drag.current; if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moved) return;
    d.ghost?.remove(); setDrop(null);
    justDragged.current = true; later(() => { justDragged.current = false; }, 60);
    // the item was lifted for the drag: put it back, then make the move as a normal move
    const base = [...counts]; base[d.from]++;
    if (d.over !== null && e.type === "pointerup") {
      const a = d.from, b = d.over;
      const next = [...base]; next[a]--; next[b]++;
      stats.current.moves++;
      if (deviation(next, ex.target) >= deviation(base, ex.target)) stats.current.wasted++;
      setCounts(next); setShownHint(0); setArrow(null);
      if (next.every((x) => x === ex.target)) return finish();
      if (stats.current.wasted >= 4) raiseHint(2, next); else if (stats.current.wasted >= 2) raiseHint(1, next);
    } else setCounts(base);
  }
  useEffect(() => () => drag.current?.ghost?.remove(), []);

  const cls = (i) => [
    done && "mul-group--ok mul-faded",
    !done && sel === i && "mul-group--sel",
    !done && drop === i && "mul-group--drop",
    !done && shownHint >= 1 && i === from && "mul-group--from",
    !done && shownHint >= 2 && i === to && "mul-group--to",
  ].filter(Boolean).join(" ");

  return (
    <>
      <Say task={task} text={say} soundEnabled={soundEnabled} />
      <div ref={matRef} className={`mul-mat${done ? " mul-mat--small" : ""}`} style={{ "--hf": ".72" }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
        <div className="mul-row" style={{ "--n": n }}>
          {counts.map((c, i) => (
            <Group key={i} button count={c} data-group={i} className={cls(i)} onClick={() => onTap(i)}
              aria-label={msg(task, "aria.group", { n: i + 1 })} />
          ))}
        </div>
        {done && <Rows counts={counts} judge={false} />}
        {arrow && <div className="mul-arrow" style={{ left: arrow.left, top: arrow.top, width: arrow.width, transform: `rotate(${arrow.angle}rad)` }} />}
      </div>
      <div className="mul-answers" />
    </>
  );
}
