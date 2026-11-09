import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  TRACE_TUNING, strokeGeometry, halfWidth, canStart, createTracer, matchFreeStroke, polyD, polyLength, screenGlyph,
} from "./traceEngine";
import { Grid } from "./board";
import { boardBox, glyphWidth, useTone } from "./boardGeometry";

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

// A written letter for the lesson's record, small: each stroke as «x y x y …» in glyph units, whole
// numbers, a point kept only every 2 units of the way (a letter is a few hundred bytes).
// `w` is the letter's width on the screen (50 or 75), `given` — strokes the app drew («спрятанная буква»).
function workOf(card, inks, given, assisted) {
  const strokes = inks.map((pts) => {
    if (!pts?.length) return "";
    const kept = [pts[0]];
    for (const p of pts.slice(1)) {
      const q = kept[kept.length - 1];
      if (Math.hypot(p.x - q.x, p.y - q.y) >= 2) kept.push(p);
    }
    const last = pts[pts.length - 1];
    if (kept[kept.length - 1] !== last) kept.push(last);
    return kept.map((p) => `${Math.round(p.x)} ${Math.round(p.y)}`).join(" ");
  });
  return { kind: "print_letter", letter: card.label ?? card.id, w: glyphWidth(card), strokes, given, assisted: Boolean(assisted) };
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>;
}

/**
 * The task: the letter to write, as a sample card in the board's corner (owner, 2026-11-04: «задание
 * присутствует, а образца нет»). The same card is «Показать»: a tap writes the letter on the board, at
 * the child's scale. One element for «what» and «how», always in the same place.
 */
function SampleCard({ card, geo, onShow, disabled }) {
  const w = glyphWidth(card);
  return (
    <button type="button" className="plw-sample" onClick={onShow} disabled={disabled} aria-label={`Образец: буква ${card.label ?? card.id}. Нажми — покажу, как писать`}>
      <svg viewBox={`-14 -24 ${w + 28} 156`} className="plw-sample-glyph" aria-hidden="true">
        {geo.map((g, i) => <path key={i} d={polyD(g.pts)} className="plw-sample-line" />)}
      </svg>
      <span className="plw-sample-play"><PlayIcon /></span>
    </button>
  );
}

export default function ScreenWriteView({ task, onCorrect, onAdvance, onPrevious }) {
  const { level = "trace" } = task;
  const card = useMemo(() => screenGlyph(task.card), [task.card]);
  const t = halfWidth(task.width);
  const geo = useMemo(() => strokeGeometry(card), [card]);
  const n = geo.length;
  // strokes the app draws for the child: none since «Спрятанная буква» was removed (owner, 2026-11-04)
  const given = 0;
  const tone = useTone(task.sound !== false);
  const freshInks = useCallback(() => geo.map((g, i) => (i < given ? g.pts : null)), [geo, given]);

  const [cur, setCur] = useState(given);
  const [inks, setInks] = useState(freshInks);
  // the same lines, readable at once (the session gets the child's letter the moment it is done)
  const inksRef = useRef(null);
  if (inksRef.current === null) inksRef.current = freshInks();
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
    // the letter as the child wrote it, for «Мои буквы» at the end of the lesson (SessionSummary)
    const work = workOf(card, inksRef.current, given, assisted);
    later(() => {
      onCorrect?.(card.id, card.id, assisted ? { assisted: true, work } : { work });
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
    inksRef.current = inksRef.current.map((v, j) => (j === i ? pts : v));
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
    inksRef.current = freshInks();
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
          <Grid box={box} card={card} frame={task.frame !== false} guides={task.guides !== false} />
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
      </div>
      <SampleCard card={card} geo={geo} onShow={(e) => { e.stopPropagation(); showLetter(); }} disabled={!!demo || (done && level !== "watch")} />
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
