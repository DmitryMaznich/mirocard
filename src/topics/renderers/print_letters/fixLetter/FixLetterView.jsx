import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { screenGlyph, polyD } from "../screenWrite/traceEngine";
import { Grid } from "../screenWrite/board";
import { boardBox, glyphWidth, useTone } from "../screenWrite/boardGeometry";
import { breakLetter, coverage, grabRole, isSolved, letterTargets, looseParts, mirrorLine, moved, partEnds, snapTarget, tapMirrors } from "./breakLetter";

// «Почини букву» (mode fix_letter): a big letter on the notebook grid with some strokes knocked out of
// place — shifted, tilted (one end moved), a half-oval mirrored; the child puts them back. A game of
// cards (owner, 2026-11-04: «просто выполняет карточки, это больше как игра»): a fixed letter is a right
// answer in the usual star series, then the next letter. Every part moves — the whole ones too — and a
// straight stroke drags by the middle (whole) or near an end (that end). A part let go near a place it
// fits snaps in — any place of the same shape (Е's three bars are interchangeable: the letter is checked
// by its shape, not by which part stands where). No error colours, no error sound. Decisions: docs/print-letters-fix-letter.md; the pure
// part (how a letter breaks, what a drag moves): breakLetter.js.

const INK_W = 7;           // as in «Пишу на экране»: a letter is 100 units tall
const HIT_W = 30;          // what the finger can grab
const SNAP_MS = 160;
const IDLE_HINT_MS = 8000; // idle: the place of one broken part glows softly (counts as help)
const DONE_HOLD_MS = 1100;
const MAGNET = "strong";   // one setting only (owner): the strong magnet always // the fixed letter stays on screen before the session hears about it

function partTransform(p) {
  if (p.line) return undefined;
  let t = `translate(${p.off.x} ${p.off.y})`;
  if (p.mirror) t += p.flip === "y" ? ` translate(0 ${p.cy}) scale(1 -1) translate(0 ${-p.cy})` : ` translate(${p.cx} 0) scale(-1 1) translate(${-p.cx} 0)`;
  return t;
}
function partD(p) {
  if (!p.line) return polyD(p.pts);
  const { a, b } = partEnds(p);
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

export default function FixLetterView({ task, onCorrect, onAdvance, onPrevious, soundEnabled }) {
  const card = useMemo(() => screenGlyph(task.card), [task.card]);
  const opts = useMemo(() => ({ broken: task.broken, tilt: task.tilt, mirror: task.mirror, magnet: MAGNET }), [task.broken, task.tilt, task.mirror]);
  const tone = useTone(soundEnabled !== false);
  const targets = useMemo(() => letterTargets(card), [card]);

  const [parts, setParts] = useState(() => breakLetter(card, opts));
  const partsRef = useRef(parts);
  const setPartsLive = (next) => { partsRef.current = next; setParts(next); };
  const [done, setDoneState] = useState(false);
  const doneRef = useRef(false);
  const setDone = (v) => { doneRef.current = v; setDoneState(v); };
  const [drag, setDrag] = useState(null);        // { i, role } — for the drawing only
  const [hint, setHint] = useState(null);        // index of the free target (place) that glows
  const dragRef = useRef(null);                  // { i, role, last, moved, id }
  const stats = useRef({ assisted: false, lastAct: 0 });
  const timers = useRef([]);
  const rafs = useRef(new Set());
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState(null);

  useEffect(() => { stats.current.lastAct = performance.now(); }, []);
  useEffect(() => () => { timers.current.forEach(clearTimeout); rafs.current.forEach(cancelAnimationFrame); }, []);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => { const r = el.getBoundingClientRect(); setSize({ w: r.width, h: r.height }); };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const box = useMemo(() => boardBox(card, size), [card, size]);

  function newRound() {
    rafs.current.forEach(cancelAnimationFrame); rafs.current.clear();
    dragRef.current = null; setDrag(null); setHint(null); setDone(false);
    setPartsLive(breakLetter(card, opts));
    stats.current = { assisted: false, lastAct: performance.now() };
  }

  // idle: the place of the first broken part glows (a prompt — the letter then counts as «с помощью»)
  useEffect(() => {
    const id = setInterval(() => {
      if (done || dragRef.current) return;
      if (performance.now() - stats.current.lastAct < IDLE_HINT_MS) return;
      const i = coverage(partsRef.current, targets).findIndex((j) => j < 0);
      if (i < 0 || hint === i) return;
      stats.current.assisted = true;
      setHint(i);
    }, 500);
    return () => clearInterval(id);
  }, [done, hint, targets]);

  const toSvg = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const touch = () => { stats.current.lastAct = performance.now(); setHint(null); };

  function onPointerDown(e) {
    if (dragRef.current || doneRef.current) return; // a second finger or the palm — ignored
    const t = e.target.closest?.("[data-part]");
    if (!t) return;
    const i = Number(t.dataset.part);
    const p = partsRef.current[i];
    if (!p) return;
    const at = toSvg(e);
    const role = t.dataset.end || grabRole(p, at);
    dragRef.current = { i, role, last: at, moved: 0, id: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
    setDrag({ i, role });
    touch();
  }

  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    const at = toSvg(e);
    const dx = at.x - d.last.x, dy = at.y - d.last.y;
    d.last = at; d.moved += Math.hypot(dx, dy);
    setPartsLive(partsRef.current.map((p, j) => (j === d.i ? moved(p, d.role, dx, dy) : p)));
    stats.current.lastAct = performance.now();
  }

  function onPointerUp(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.id) return;
    dragRef.current = null; setDrag(null);
    let p = partsRef.current[d.i];
    // a tap on a half-oval turns it round, on a slanted straight stroke mirrors its slant (only on the
    // level that mirrors, «Трудно»)
    if (d.moved < 3 && task.mirror && tapMirrors(p)) {
      p = p.line ? mirrorLine(p) : { ...p, mirror: !p.mirror };
      setPartsLive(partsRef.current.map((q, j) => (j === d.i ? p : q)));
      tone([660]);
    }
    settle(d.i);
  }

  // the magnet: a part let go near a free place it fits slides onto it; then — is the letter whole?
  function settle(i) {
    const p = partsRef.current[i];
    const to = snapTarget(partsRef.current, i, targets, MAGNET);
    if (!to) { check(); return; }
    // slide from where the part is now: a straight part's two ends; a shape by how far its middle is off
    const start = p.line
      ? { pa: { ...p.pa }, pb: { ...p.pb } }
      : { off: { x: p.cx + p.off.x - to.cx, y: p.cy + p.off.y - to.cy } };
    let t0 = null;                                  // the first frame's time
    const step = (now) => {
      if (t0 === null) t0 = now;
      const k = Math.max(0, Math.min(1, (now - t0) / SNAP_MS)), ease = 1 - (1 - k) * (1 - k);
      const mix = (a, b) => ({ x: a.x + (b.x - a.x) * ease, y: a.y + (b.y - a.y) * ease });
      const cur = k >= 1 ? to : p.line
        ? { ...to, pa: mix(start.pa, to.pa), pb: mix(start.pb, to.pb) }
        : { ...to, off: mix(start.off, { x: 0, y: 0 }) };
      setPartsLive(partsRef.current.map((q, j) => (j === i ? cur : q)));
      if (k < 1) { const id = requestAnimationFrame(step); rafs.current.add(id); return; }
      tone([523, 784]);
      check();
    };
    const id = requestAnimationFrame(step); rafs.current.add(id);
  }

  function check() {
    if (doneRef.current || !isSolved(partsRef.current, targets)) return;
    setDone(true); setHint(null);
    tone([523, 659, 784], 0.16);
    const assisted = stats.current.assisted;
    later(() => {
      onCorrect?.(card.id, card.id, assisted ? { assisted: true } : undefined);
      // the session moves on and normally mounts a fresh view; when it comes back to this same task
      // (one letter chosen) it does not, so break the letter again here
      later(newRound, 60);
    }, DONE_HOLD_MS);
  }

  function restart() {
    if (done) return;
    newRound();
  }

  const w = glyphWidth(card);
  // broken parts on top: where two parts meet (П's corner) the finger takes the broken one
  const order = useMemo(() => {
    const loose = new Set(looseParts(parts, targets));
    return parts.map((p, i) => i).sort((a, b) => Number(loose.has(a)) - Number(loose.has(b)));
  }, [parts, targets]);

  return (
    <div className="plw-root plf-root">
      <div className="plw-board-wrap" ref={wrapRef}>
        <svg
          ref={svgRef}
          className="plw-board"
          viewBox={`${box.x0} ${box.y0} ${box.w} ${box.h}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <Grid box={box} card={card} frame={task.frame !== false} />
          {hint != null && <path d={polyD(targets[hint].pts)} strokeWidth={INK_W + 6} className="plf-hint" />}
          <g className={done ? "plf-parts is-done" : "plf-parts"}>
            {order.map((i) => {
              const p = parts[i];
              const d = partD(p);
              return (
                <g key={i} transform={partTransform(p)}>
                  {!done && <path d={d} data-part={i} className="plf-hit" strokeWidth={HIT_W} />}
                  <path d={d} strokeWidth={INK_W} className={drag?.i === i ? "plf-part is-drag" : "plf-part"} />
                </g>
              );
            })}
            {/* the ends of every straight stroke: small rings — «the end can be pulled» */}
            {!done && order.map((i) => {
              const p = parts[i];
              if (!p.line) return null;
              const e = partEnds(p);
              return ["a", "b"].map((k) => (
                <circle key={`${i}${k}`} cx={e[k].x} cy={e[k].y} r={drag?.i === i && drag.role === k ? 5.5 : 4} data-part={i} data-end={k} className="plf-end" />
              ));
            })}
          </g>
        </svg>
      </div>
      <div className="plw-sample plf-sample" aria-label={`Образец: буква ${card.label ?? card.id}`}>
        <svg viewBox={`-14 -24 ${w + 28} 156`} className="plw-sample-glyph" aria-hidden="true">
          {card.strokes.map((s, i) => <path key={i} d={s.d} className="plw-sample-line" />)}
        </svg>
      </div>
      <nav className="plw-nav">
        {task.prevLabel ? (
          <button type="button" className="plw-nav-btn" onClick={(e) => { e.stopPropagation(); onPrevious?.(); }} aria-label={`Назад, к букве ${task.prevLabel}`}>
            <span className="plw-nav-arrow">‹</span><span className="plw-nav-letter">{task.prevLabel}</span>
          </button>
        ) : <span className="plw-nav-gap" />}
        <button type="button" className="plw-nav-btn plw-nav-btn--quiet" onClick={(e) => { e.stopPropagation(); restart(); }} disabled={done} aria-label="Сломать заново">↺</button>
        <button type="button" className="plw-nav-btn" onClick={(e) => onAdvance?.(e)} aria-label={task.nextLabel ? `Дальше, к букве ${task.nextLabel}` : "Дальше"}>
          {task.nextLabel && <span className="plw-nav-letter">{task.nextLabel}</span>}<span className="plw-nav-arrow">›</span>
        </button>
      </nav>
    </div>
  );
}
