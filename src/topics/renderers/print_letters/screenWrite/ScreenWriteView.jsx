import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  TRACE_TUNING, strokeGeometry, halfWidth, canStart, createTracer, matchFreeStroke, polyD, polyLength,
} from "./traceEngine";

// «Пишу на экране» (mode screen_write): one copy of one letter per task, written with a finger.
// Three levels (owner, 2026-11-03): «Смотрю» (watch) — the letter writes itself; «Обвожу» (trace)
// — a track along the letter, the line is the finger's real path, a stroke lifted too early or
// leaving the track burns and is written again; «Сам» (free) — an empty cell, each stroke checked
// after the lift. Method and decisions: docs/print-letters-screen-writing.md; checking: traceEngine.js.
//
// The screen is one big grid board and nothing else (owner, 2026-11-04): no separate sample, no
// stroke strip. «Показать» on the board writes the letter right there, at the child's scale; under
// the board only the way to the previous / next letter. No error colours and no error sound — a
// burnt stroke fades to grey and shrinks back to its start.

const INK_W = 7;           // line width in glyph units (a letter is 100 tall)
const DEMO_MS = 9;         // the dot's pace when it writes a stroke, ms per unit
const DONE_HOLD_MS = 1100; // the finished letter stays on screen before the session hears about it

function useTone(enabled) {
  const ctxRef = useRef(null);
  return useCallback((freqs, dur = 0.09) => {
    if (!enabled) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = ctxRef.current ?? (ctxRef.current = new Ctx());
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + i * 0.09;
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
      });
    } catch { /* no audio — silent */ }
  }, [enabled]);
}

function glyphWidth(card) {
  return Number(String(card.viewBox ?? "0 0 50 100").split(/\s+/)[2]) || 50;
}

// The board shows the notebook grid edge to edge: the viewBox grows to the board's proportions
// around the letter's cell (half a cell of margin on every side, room for Ё's dots and Д's legs).
function boardBox(card, size) {
  const need = { x0: -50, y0: -50, w: 200, h: 200 };
  const ar = size?.w > 0 && size?.h > 0 ? size.w / size.h : need.w / need.h;
  let bw = need.w, bh = need.h;
  if (ar > bw / bh) bw = bh * ar; else bh = bw / ar;
  return { x0: need.x0 - (bw - need.w) / 2, y0: need.y0 - (bh - need.h) / 2, w: bw, h: bh };
}

// Ilyukhina's notebook cell (owner, 2026-11-04: «сделаем клетку как у неё»): the letter is exactly one
// big cell tall (1 cm in «Волшебные линии» №2 = 100 glyph units) and stands at the cell's left line.
// The division she asks the child to make «мысленно, глазами» — in half for a regular letter, in
// thirds for a wide one (⅔ of the cell) — is a thin red dashed vertical line through the whole board
// (and one horizontal at half the height where the letter needs it)
// (owner, 2026-11-04): red so it is read neither as part of the grid nor as a letter's path to trace.
// Earlier tries: a blue dashed line across the cell (read as «trace me»), ticks on the cell's edges.
const CELL = 100;
function cellDivisions(card, geo) {
  const wide = glyphWidth(card) > CELL / 2 + 1;
  const v = wide ? [CELL / 3, (2 * CELL) / 3] : [CELL / 2];
  // one horizontal line too, at half the height — only for a letter with a stroke starting or ending
  // there (Е's middle bar, Н Ч, the half-ovals of Р Ь Б В …; owner: «нам оно понадобится для буквы Е»)
  const mid = geo.some((g) => [g.pts[0], g.pts[g.pts.length - 1]].some((p) => Math.abs(p.y - CELL / 2) < 0.6));
  return { v, h: mid ? [CELL / 2] : [] };
}

function Grid({ box, card, geo }) {
  const lines = [];
  const x1 = box.x0 + box.w, y1 = box.y0 + box.h;
  for (let x = Math.floor(box.x0 / CELL) * CELL; x <= x1; x += CELL) {
    lines.push(<line key={`x${x}`} x1={x} y1={box.y0} x2={x} y2={y1} className="plw-grid-cell" />);
  }
  for (let y = Math.floor(box.y0 / CELL) * CELL; y <= y1; y += CELL) {
    lines.push(<line key={`y${y}`} x1={box.x0} y1={y} x2={x1} y2={y} className="plw-grid-cell" />);
  }
  const div = cellDivisions(card, geo);
  return (
    <g>
      <rect x={box.x0} y={box.y0} width={box.w} height={box.h} className="plw-paper" />
      <rect x={0} y={0} width={CELL} height={CELL} className="plw-cell-own" />
      {lines}
      {div.v.map((x) => <line key={`dv${x}`} x1={x} y1={box.y0} x2={x} y2={y1} className="plw-grid-div" />)}
      {div.h.map((y) => <line key={`dh${y}`} x1={box.x0} y1={y} x2={x1} y2={y} className="plw-grid-div" />)}
    </g>
  );
}

/** A small arrow beside the start of a stroke, pointing along it. */
function StartArrow({ g, className }) {
  if (g.isDot || g.length <= 8) return null;
  const i = Math.min(g.pts.length - 2, Math.round(Math.min(18, g.length * 0.35)));
  const a = g.pts[i], b = g.pts[i + 1];
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const nl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const cx = a.x + (-(b.y - a.y) / nl) * 11, cy = a.y + ((b.x - a.x) / nl) * 11;
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${ang})`}>
      <path d="M -6 0 L 5 0 M 1 -4 L 5.5 0 L 1 4" className={className} />
    </g>
  );
}

/** A burnt stroke: turns grey, shrinks back to where it started, disappears. */
function BurnPath({ pts, onDone }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const len = polyLength(pts) || 1;
    el.style.strokeDasharray = `${len} ${len + 10}`;
    el.style.strokeDashoffset = "0";
    const raf = requestAnimationFrame(() => {
      el.classList.add("is-burning");
      el.style.strokeDashoffset = String(-len);
    });
    const timer = setTimeout(onDone, 700);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <path ref={ref} className="plw-ink plw-burn" d={polyD(pts)} strokeWidth={INK_W} />;
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>;
}

export default function ScreenWriteView({ task, onCorrect, onAdvance, onPrevious }) {
  const { card, level = "trace" } = task;
  const t = halfWidth(task.width);
  const geo = useMemo(() => strokeGeometry(card), [card]);
  const n = geo.length;
  const given = task.hidden && level !== "watch" && n > 1 ? n - 1 : 0;
  const tone = useTone(task.sound !== false);
  const freshInks = useCallback(() => geo.map((g, i) => (i < given ? g.pts : null)), [geo, given]);

  const [cur, setCur] = useState(given);
  const [inks, setInks] = useState(freshInks);
  const [done, setDone] = useState(false);
  const [nudged, setNudged] = useState(false);
  const [burning, setBurning] = useState([]);
  const [demo, setDemo] = useState(null);       // { i, k } — the dot writing stroke i, up to sample k

  // the pointer handlers and the idle timer read the current state through this ref
  const live = useRef({ cur: given, done: false, demo: false, nudged: false });
  useLayoutEffect(() => { Object.assign(live.current, { cur, done, demo: !!demo, nudged }); }, [cur, done, demo, nudged]);
  const active = useRef(null);
  const stats = useRef({ prompted: false, burnsHere: 0, demoed: false, lastAct: 0 });
  useEffect(() => { stats.current.lastAct = performance.now(); }, []);
  const timers = useRef([]);
  const rafs = useRef(new Set());
  const burnId = useRef(0);
  const demoRun = useRef(0);
  const svgRef = useRef(null);
  const liveRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState(null);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    rafs.current.forEach(cancelAnimationFrame);
  }, []);
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

  // the dot writes strokes `from…to` one after another, right on the board; onEnd after the last
  const runDots = useCallback((from, to, { onStroke, onEnd } = {}) => {
    const run = ++demoRun.current;
    rafs.current.forEach(cancelAnimationFrame); rafs.current.clear();
    const one = (i) => {
      if (run !== demoRun.current) return;
      if (i > to) { setDemo(null); onEnd?.(); return; }
      const g = geo[i];
      const t0 = performance.now(), dur = Math.max(450, g.length * DEMO_MS);
      const step = (now) => {
        if (run !== demoRun.current) return;
        const p = Math.min(1, (now - t0) / dur);
        const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
        setDemo({ i, k: Math.round(e * (g.pts.length - 1)) });
        if (p < 1) { const id = requestAnimationFrame(step); rafs.current.add(id); return; }
        onStroke?.(i);
        later(() => one(i + 1), 450);
      };
      const id = requestAnimationFrame(step); rafs.current.add(id);
    };
    one(from);
  }, [geo]);

  const showStroke = useCallback((i) => {
    runDots(i, i, { onEnd: () => { stats.current.lastAct = performance.now(); } });
  }, [runDots]);

  // «Смотрю»: the whole letter writes itself and stays on the board
  const playWatch = useCallback(() => {
    setInks(geo.map(() => null)); setCur(0); setDone(false);
    runDots(0, n - 1, {
      onStroke: (i) => { setInks((prev) => prev.map((v, j) => (j === i ? geo[i].pts : v))); setCur(i + 1); tone([660]); },
      onEnd: () => setDone(true),
    });
  }, [geo, n, runDots, tone]);

  // «Показать» (trace / free): the dot writes the whole letter over the board, the child's lines stay;
  // seeing it counts as help for this copy
  const showLetter = () => {
    if (level === "watch") { playWatch(); return; }
    if (live.current.done || active.current) return;
    stats.current.prompted = true;
    runDots(0, n - 1, { onEnd: () => { stats.current.lastAct = performance.now(); } });
  };

  useEffect(() => {
    if (level !== "watch") return undefined;
    const id = setTimeout(playWatch, 400);
    return () => clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // idle: first the start dot pulses, later the dot writes the stroke once (a prompt)
  useEffect(() => {
    if (level === "watch") return undefined;
    const id = setInterval(() => {
      const L = live.current, s = stats.current;
      if (L.done || L.demo || active.current) return;
      const idle = performance.now() - s.lastAct;
      if (idle > TRACE_TUNING.idleDemoMs && !s.demoed) {
        s.demoed = true; s.prompted = true; s.lastAct = performance.now();
        showStroke(L.cur);
      } else if (idle > TRACE_TUNING.idleNudgeMs && !L.nudged) {
        setNudged(true);
      }
    }, 500);
    return () => clearInterval(id);
  }, [level, showStroke]);

  const toSvg = (e) => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };
  const setLive = (pts) => liveRef.current?.setAttribute("d", pts ? polyD(pts) : "");

  function letterDone() {
    setDone(true);
    tone([523, 659, 784], 0.16);
    const assisted = stats.current.prompted;
    later(() => {
      onCorrect?.(card.id, card.id, assisted ? { assisted: true } : undefined);
      // The session moves on and normally mounts a fresh view; when it comes back to this same
      // task (one letter, one copy — the session loops) it does not, so start a fresh copy here.
      later(() => newCopy(), 60);
    }, DONE_HOLD_MS);
  }

  function newCopy() {
    clearBoard();
    stats.current = { prompted: false, burnsHere: 0, demoed: false, lastAct: performance.now() };
  }

  function nextStroke() {
    stats.current.burnsHere = 0;
    setNudged(false);
    const next = live.current.cur + 1;
    live.current.cur = next;
    setCur(next);
    if (next >= n) letterDone();
  }

  function finishStroke(a) {
    a.over = true;
    const i = live.current.cur;
    const pts = a.pts.slice();
    setInks((prev) => prev.map((v, j) => (j === i ? pts : v)));
    setLive(null);
    tone([660]);
    nextStroke();
  }

  function burn(a) {
    a.over = true;
    const pts = a.pts.slice();
    setLive(null);
    if (pts.length > 1) setBurning((prev) => [...prev, { id: ++burnId.current, pts }]);
    const s = stats.current;
    s.burnsHere += 1;
    if (level === "free") {
      // «Сам»: the stroke that was meant is shown once by the dot
      s.prompted = true; setNudged(true); showStroke(live.current.cur);
    } else if (s.burnsHere >= TRACE_TUNING.burnsBeforeDemo) {
      s.burnsHere = 0; s.prompted = true; showStroke(live.current.cur);
    }
  }

  function clearBoard() {
    demoRun.current++; rafs.current.forEach(cancelAnimationFrame); rafs.current.clear();
    active.current = null; setLive(null); setDemo(null);
    live.current.cur = given; live.current.done = false;
    setCur(given); setInks(freshInks()); setNudged(false); setBurning([]); setDone(false);
  }

  // «Заново»: the same copy from a clean board (no penalty)
  function restart() {
    if (live.current.done) return;
    clearBoard();
    stats.current.burnsHere = 0; stats.current.lastAct = performance.now();
  }

  function onPointerDown(e) {
    if (active.current) return;                     // a second finger or the palm — ignored
    stats.current.lastAct = performance.now();
    const L = live.current;
    if (level === "watch" || L.done || L.demo || L.cur >= n) return;
    const p = toSvg(e);
    const g = geo[L.cur];
    if (level === "trace" && !canStart(g, p, t)) { setNudged(true); return; } // not at the start dot — nothing is drawn
    const a = { id: e.pointerId, pts: [p], tracer: level === "trace" ? createTracer(g, t) : null, over: false };
    active.current = a;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browsers */ }
    setLive(a.pts);
    if (a.tracer && g.isDot) finishStroke(a);       // the dots of Ё — a touch writes them
  }

  function onPointerMove(e) {
    const a = active.current;
    if (!a || e.pointerId !== a.id || a.over) return;
    const native = e.nativeEvent;
    const evs = native.getCoalescedEvents?.() ?? [];
    for (const ev of evs.length ? evs : [native]) {
      const p = toSvg(ev);
      a.pts.push(p);
      if (a.tracer) {
        const r = a.tracer.push(p);
        if (r === "done") { finishStroke(a); return; }
        if (r === "burn") { burn(a); return; }   // left the track
      }
    }
    setLive(a.pts);
    stats.current.lastAct = performance.now();
  }

  function onPointerUp(e) {
    const a = active.current;
    if (!a || e.pointerId !== a.id) return;
    active.current = null;
    stats.current.lastAct = performance.now();
    if (a.over) return;
    if (a.tracer) {
      if (a.tracer.lift() === "done") finishStroke(a); else burn(a); // lifted too early — burns
    } else if (matchFreeStroke(a.pts, geo[live.current.cur], t)) {
      finishStroke(a);
    } else {
      burn(a);
    }
  }

  const showTrack = level === "trace" && !done;
  const marksFor = !done && cur < n && level !== "watch" && !demo && (level === "trace" || nudged);

  return (
    <div className="plw-root">
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
          <Grid box={box} card={card} geo={geo} />
          {showTrack && geo.map((g, i) => (i < cur ? null : (
            <g key={`t${i}`} className={i === cur ? "plw-track is-current" : "plw-track"}>
              <path d={polyD(g.pts)} className="plw-track-band" strokeWidth={t * 2} />
              <path d={polyD(g.pts)} className="plw-track-axis" />
            </g>
          )))}
          <g className={done ? "plw-inks is-done" : "plw-inks"}>
            {inks.map((pts, i) => (pts ? <path key={i} d={polyD(pts)} strokeWidth={INK_W} className={i < given ? "plw-ink is-given" : "plw-ink"} /> : null))}
          </g>
          {burning.map((b) => (
            <BurnPath key={b.id} pts={b.pts} onDone={() => setBurning((prev) => prev.filter((x) => x.id !== b.id))} />
          ))}
          <path ref={liveRef} className="plw-ink" strokeWidth={INK_W} />
          {marksFor && (
            <g>
              <circle cx={geo[cur].pts[0].x} cy={geo[cur].pts[0].y} r={5.5} className={nudged ? "plw-start is-nudged" : "plw-start"} />
              <StartArrow g={geo[cur]} className="plw-arrow" />
            </g>
          )}
          {demo && (
            <g className={level === "watch" ? "plw-demo is-watch" : "plw-demo"}>
              {/* strokes the dot has already written in this showing */}
              {level !== "watch" && geo.slice(0, demo.i).map((g, i) => <path key={i} d={polyD(g.pts)} strokeWidth={INK_W} className="plw-demo-trail" />)}
              <path d={polyD(geo[demo.i].pts, demo.k)} strokeWidth={INK_W} className="plw-demo-trail" />
              <circle cx={geo[demo.i].pts[demo.k].x} cy={geo[demo.i].pts[demo.k].y} r={6} className="plw-demo-dot" />
            </g>
          )}
        </svg>
        <button
          type="button"
          className="plw-show"
          onClick={(e) => { e.stopPropagation(); showLetter(); }}
          disabled={!!demo || (done && level !== "watch")}
          aria-label="Показать, как писать"
        >
          <PlayIcon /><span>Показать</span>
        </button>
      </div>
      <nav className="plw-nav">
        {task.prevLabel ? (
          <button type="button" className="plw-nav-btn" onClick={(e) => { e.stopPropagation(); onPrevious?.(); }} aria-label={`Назад, к букве ${task.prevLabel}`}>
            <span className="plw-nav-arrow">‹</span><span className="plw-nav-letter">{task.prevLabel}</span>
          </button>
        ) : <span className="plw-nav-gap" />}
        {level !== "watch" ? (
          <button type="button" className="plw-nav-btn plw-nav-btn--quiet" onClick={(e) => { e.stopPropagation(); restart(); }} disabled={done} aria-label="Написать заново">↺</button>
        ) : <span className="plw-nav-gap" />}
        {task.nextLabel ? (
          <button type="button" className={`plw-nav-btn${level === "watch" && done ? " is-ready" : ""}`} onClick={(e) => onAdvance?.(e)} aria-label={`Дальше, к букве ${task.nextLabel}`}>
            <span className="plw-nav-letter">{task.nextLabel}</span><span className="plw-nav-arrow">›</span>
          </button>
        ) : (
          <button type="button" className={`plw-nav-btn${level === "watch" && done ? " is-ready" : ""}`} onClick={(e) => onAdvance?.(e)} aria-label="Дальше">
            <span className="plw-nav-arrow">›</span>
          </button>
        )}
      </nav>
    </div>
  );
}
