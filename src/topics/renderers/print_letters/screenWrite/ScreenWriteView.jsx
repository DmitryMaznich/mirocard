import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  TRACE_TUNING, strokeGeometry, halfWidth, canStart, createTracer, matchFreeStroke, polyD, polyLength,
} from "./traceEngine";

// «Пишу на экране» (mode screen_write): one copy of one letter per task, written with a finger.
// Three levels (owner, 2026-11-03): «Смотрю» (watch) — the letter writes itself; «Обвожу» (trace)
// — a track along the letter, the line is the finger's real path, a stroke lifted too early or
// leaving the track burns and is written again; «Сам» (free) — an empty cell, each stroke checked
// after the lift. Method and decisions: docs/print-letters-screen-writing.md; checking: traceEngine.js.
// No error colours and no error sound — a burnt stroke fades to grey and shrinks back to its start.

const INK_W = 7;          // line width in glyph units (a letter is 100 tall)
const DEMO_MS = 9;        // the dot's pace when it writes a stroke, ms per unit
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
// around the letter (plus a cell of margin on every side, room for Ё's dots and Д's legs).
function boardBox(card, size) {
  const w = glyphWidth(card);
  const need = { x0: -50, y0: -50, w: Math.ceil((w + 50) / 50) * 50 + 50, h: 200 };
  const ar = size?.w > 0 && size?.h > 0 ? size.w / size.h : need.w / need.h;
  let bw = need.w, bh = need.h;
  if (ar > bw / bh) bw = bh * ar; else bh = bw / ar;
  return { x0: need.x0 - (bw - need.w) / 2, y0: need.y0 - (bh - need.h) / 2, w: bw, h: bh };
}

function Grid({ box }) {
  const lines = [];
  const x1 = box.x0 + box.w, y1 = box.y0 + box.h;
  for (let x = Math.floor(box.x0 / 25) * 25; x <= x1; x += 25) {
    lines.push(<line key={`x${x}`} x1={x} y1={box.y0} x2={x} y2={y1} className={x % 50 === 0 ? "plw-grid-cell" : "plw-grid-half"} />);
  }
  for (let y = Math.floor(box.y0 / 25) * 25; y <= y1; y += 25) {
    lines.push(<line key={`y${y}`} x1={box.x0} y1={y} x2={x1} y2={y} className={y % 50 === 0 ? "plw-grid-cell" : "plw-grid-half"} />);
  }
  // the letter's top and bottom — the writing line, a little stronger (as on the printed sheet)
  [0, 100].forEach((y) => lines.push(<line key={`r${y}`} x1={box.x0} y1={y} x2={x1} y2={y} className="plw-grid-row" />));
  return (
    <g>
      <rect x={box.x0} y={box.y0} width={box.w} height={box.h} className="plw-paper" />
      {lines}
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

function SamplePanel({ card, geo }) {
  const svgRef = useRef(null);
  const w = glyphWidth(card);
  const play = () => {
    const paths = [...(svgRef.current?.querySelectorAll("path[data-i]") ?? [])];
    let delay = 150;
    paths.forEach((p, i) => {
      const len = (geo[i].length || 1) + 1;
      p.style.transition = "none";
      p.style.strokeDasharray = String(len);
      p.style.strokeDashoffset = String(len);
      const dur = Math.max(350, geo[i].length * DEMO_MS);
      setTimeout(() => { p.style.transition = `stroke-dashoffset ${dur}ms ease-in-out`; p.style.strokeDashoffset = "0"; }, delay);
      delay += dur + 350;
    });
  };
  return (
    <button type="button" className="plw-sample" onClick={play} aria-label="Показать, как писать букву">
      <svg ref={svgRef} viewBox={`-26 -38 ${w + 52} 176`} className="plw-sample-svg">
        {geo.map((g, i) => <path key={i} data-i={i} d={polyD(g.pts)} className="plw-sample-line" />)}
        {geo.map((g, i) => {
          // the number sits behind the start (against the stroke's direction), so numbers of strokes
          // starting at the same point (П: 1 and 2) do not cover each other
          const s0 = g.pts[0], s1 = g.pts[Math.min(g.pts.length - 1, 4)];
          const dl = Math.hypot(s1.x - s0.x, s1.y - s0.y) || 1;
          const p = dl > 0.5 ? { x: s0.x - ((s1.x - s0.x) / dl) * 12, y: s0.y - ((s1.y - s0.y) / dl) * 12 } : { x: s0.x, y: s0.y - 12 };
          return (
            <g key={`b${i}`}>
              <StartArrow g={g} className="plw-sample-arrow" />
              <circle cx={s0.x} cy={s0.y} r={3.5} className="plw-sample-dot" />
              <circle cx={p.x} cy={p.y} r={7.5} className="plw-sample-badge" />
              <text x={p.x} y={p.y + 3.6} className="plw-sample-num">{i + 1}</text>
            </g>
          );
        })}
      </svg>
      <span className="plw-sample-cap">▶ Смотри</span>
    </button>
  );
}

function StrokeStrip({ geo, cur, done, given }) {
  const chips = [];
  geo.forEach((g, i) => {
    if (i > 0) chips.push(<span key={`a${i}`} className="plw-strip-arrow">›</span>);
    const xs = g.pts.map((p) => p.x), ys = g.pts.map((p) => p.y);
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const sz = Math.max(maxx - minx, maxy - miny, 20) + 16;
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const cls = ["plw-chip", (i < cur || done) && "is-done", i === cur && !done && "is-active", i < given && "is-given"].filter(Boolean).join(" ");
    chips.push(
      <div key={i} className={cls}>
        <svg viewBox={`${cx - sz / 2} ${cy - sz / 2} ${sz} ${sz}`}>
          <path d={polyD(g.pts)} className="plw-chip-line" strokeWidth={sz / 9} />
        </svg>
        <span className="plw-chip-num">{i + 1}</span>
      </div>,
    );
  });
  chips.push(<span key="end" className="plw-strip-arrow">›</span>);
  chips.push(
    <div key="star" className={`plw-strip-star${done ? " is-done" : ""}`}>
      <svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z" /></svg>
    </div>,
  );
  return <div className="plw-strip">{chips}</div>;
}

export default function ScreenWriteView({ task, onCorrect, onAdvance }) {
  const { card, level = "trace" } = task;
  const t = halfWidth(task.width);
  const geo = useMemo(() => strokeGeometry(card), [card]);
  const n = geo.length;
  const given = task.hidden && level !== "watch" && n > 1 ? n - 1 : 0;
  const tone = useTone(task.sound !== false);

  const [cur, setCur] = useState(given);
  const [inks, setInks] = useState(() => geo.map((g, i) => (i < given ? g.pts : null)));
  const [done, setDone] = useState(false);
  const [nudged, setNudged] = useState(false);
  const [burning, setBurning] = useState([]);
  const [demo, setDemo] = useState(null);       // { i, k } — the dot writing stroke i, up to sample k
  const [watched, setWatched] = useState(false);

  // the pointer handlers and the idle timer read the current state through this ref
  const live = useRef({ cur: given, done: false, demo: false, nudged: false });
  useLayoutEffect(() => { Object.assign(live.current, { cur, done, demo: !!demo, nudged }); }, [cur, done, demo, nudged]);
  const active = useRef(null);
  const stats = useRef({ prompted: false, burnsHere: 0, demoed: false, lastAct: 0 });
  useEffect(() => { stats.current.lastAct = performance.now(); }, []);
  const timers = useRef([]);
  const rafs = useRef(new Set());
  const burnId = useRef(0);
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

  // the dot writes stroke i once; onEnd after it has
  const runDot = useCallback((i, onEnd) => {
    const g = geo[i];
    const t0 = performance.now(), dur = Math.max(450, g.length * DEMO_MS);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      setDemo({ i, k: Math.round(e * (g.pts.length - 1)) });
      if (p < 1) { const id = requestAnimationFrame(step); rafs.current.add(id); } else onEnd?.();
    };
    const id = requestAnimationFrame(step); rafs.current.add(id);
  }, [geo]);

  const showStroke = useCallback((i) => {
    runDot(i, () => later(() => { setDemo(null); stats.current.lastAct = performance.now(); }, 400));
  }, [runDot]);

  // «Смотрю»: the whole letter writes itself, stroke after stroke
  const watchRun = useRef(0);
  const playWatch = useCallback(() => {
    const run = ++watchRun.current;
    rafs.current.forEach(cancelAnimationFrame); rafs.current.clear();
    setInks(geo.map(() => null)); setCur(0); setDone(false); setWatched(false); setDemo(null);
    const next = (i) => {
      if (run !== watchRun.current) return;
      if (i >= n) { setDemo(null); setDone(true); setWatched(true); return; }
      setCur(i);
      runDot(i, () => {
        if (run !== watchRun.current) return;
        setInks((prev) => prev.map((v, j) => (j === i ? geo[i].pts : v)));
        tone([660]);
        later(() => next(i + 1), 550);
      });
    };
    later(() => next(0), 400);
  }, [geo, n, runDot, tone]);

  useEffect(() => {
    if (level !== "watch") return undefined;
    const id = setTimeout(playWatch, 0);
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
    later(() => onCorrect?.(card.id, card.id, assisted ? { assisted: true } : undefined), DONE_HOLD_MS);
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

  function onPointerDown(e) {
    if (active.current) return;                     // a second finger or the palm — ignored
    stats.current.lastAct = performance.now();
    if (level === "watch") { if (!live.current.demo) playWatch(); return; }
    const L = live.current;
    if (L.done || L.demo || L.cur >= n) return;
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
  const rootCls = ["plw-root", task.lefty && "plw-root--lefty"].filter(Boolean).join(" ");

  return (
    <div className={rootCls}>
      <SamplePanel card={card} geo={geo} />
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
          <Grid box={box} />
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
              <path d={polyD(geo[demo.i].pts, demo.k)} strokeWidth={INK_W} className="plw-demo-trail" />
              <circle cx={geo[demo.i].pts[demo.k].x} cy={geo[demo.i].pts[demo.k].y} r={6} className="plw-demo-dot" />
            </g>
          )}
        </svg>
        {level === "watch" && watched && (
          <div className="plw-watch-actions">
            <button type="button" className="plw-btn plw-btn--secondary" onClick={(e) => { e.stopPropagation(); playWatch(); }}>Ещё раз</button>
            <button type="button" className="plw-btn" onClick={(e) => onAdvance?.(e)}>Дальше</button>
          </div>
        )}
      </div>
      <StrokeStrip geo={geo} cur={cur} done={done} given={given} />
    </div>
  );
}
