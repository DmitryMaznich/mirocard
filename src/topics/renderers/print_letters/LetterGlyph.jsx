import { useState, useRef, useEffect, useCallback } from "react";
import { letterCells } from "./model";

// Print palette, chosen to read the same on a colour and a black-and-white
// printer: the sample in dark navy (prints near-black), the tracing guide in
// a light grey-blue (prints light grey), the start dot green — "green = start
// here" is the usual handwriting-workbook convention, and in b/w it is still
// a solid dark dot.
export const INK = "#1f3a8a";
export const GUIDE = "#8fa3c8";
export const START = "#15803d";

const START_R    = 9;   // start dot
const BADGE_R    = 11;  // numbered start dot (≈2.2mm across on paper)
const SHIFT      = 26;  // a start that lies on an earlier element moves this far along its own line
const TINY       = 10;  // strokes shorter than this (Ё's dots) get no marks
const TIP_R      = 6;
const BASE_SPEED = 60;  // SVG units per second

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Start point, direction of the first segment, total length and a sampled outline of a stroke.
// Paths use M, L and C (straight lines and the cubic arcs of ovals and half-ovals); arcs are sampled
// so the length and the "does this start lie on an earlier stroke" test work for them too.
function strokeGeom(d) {
  const tokens = d.match(/[MLC]|-?\d*\.?\d+/g) || [];
  const pts = [];
  let dir = null;
  let cmd = "M";
  let cur = [0, 0];
  let k = 0;
  const num = () => Number(tokens[k++]);
  const setDir = (to) => {
    if (dir) return;
    const len = Math.hypot(to[0] - cur[0], to[1] - cur[1]);
    if (len > 1e-6) dir = [(to[0] - cur[0]) / len, (to[1] - cur[1]) / len];
  };
  while (k < tokens.length) {
    if (/^[MLC]$/.test(tokens[k])) cmd = tokens[k++];
    if (cmd === "M") { cur = [num(), num()]; pts.push(cur); cmd = "L"; continue; }
    if (cmd === "L") { const to = [num(), num()]; setDir(to); pts.push(to); cur = to; continue; }
    if (cmd === "C") {
      const c1 = [num(), num()], c2 = [num(), num()], to = [num(), num()];
      setDir(Math.hypot(c1[0] - cur[0], c1[1] - cur[1]) > 1e-6 ? c1 : c2);
      for (let t = 1; t <= 12; t++) {
        const u = t / 12, a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, e = u ** 3;
        pts.push([a * cur[0] + b * c1[0] + c * c2[0] + e * to[0], a * cur[1] + b * c1[1] + c * c2[1] + e * to[1]]);
      }
      cur = to;
      continue;
    }
    k++;
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { start: pts[0] ?? [0, 0], dir: dir ?? [0, 1], len, pts };
}

// A thin red arrow beside a stroke, showing which way to write it (owner, 2026-11-03: «красные
// тонкие стрелки… с хвостом и крошечным наконечником»): it runs parallel to the stroke, ARROW_GAP
// units off it on the side away from the letter's centre, along the middle of a straight line (from
// 30% to 70% of it) or near the start of an arc (8–40%, where the direction is decided), and ends
// in a small open «V» head.
const ARROW = "#dc2626";
const ARROW_GAP = 9;
const ARROW_HEAD = 5.5;
const ARROW_MIN = 30; // shorter strokes (Ц's tail, Д's feet, Ё's dots, Й's breve) get none
function guideArrow(g, cx, cy, arc, skip = 0) {
  const { pts } = g;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const at = (s) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const t = (s - cum[i - 1]) / seg;
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    return { p: [ax + (bx - ax) * t, ay + (by - ay) * t], d: [(bx - ax) / len, (by - ay) / len] };
  };
  // start past the numbered start dot (`skip` along the stroke), so the dot never hides the tail
  const s0 = Math.min(Math.max(arc ? 0.08 * L : 0.3 * L, skip), L * 0.6);
  const s1 = Math.min(Math.max(arc ? 0.4 * L : 0.7 * L, s0 + 20), L - 3);
  const mid = at((s0 + s1) / 2);
  // the outer side: the normal pointing away from the letter's centre (a centred stroke — Н's bar,
  // Ж's stick — gets it above / to the right)
  let n = [-mid.d[1], mid.d[0]];
  const away = (mid.p[0] + n[0] - cx) ** 2 + (mid.p[1] + n[1] - cy) ** 2 - ((mid.p[0] - n[0] - cx) ** 2 + (mid.p[1] - n[1] - cy) ** 2);
  if (away < -1e-6 || (Math.abs(away) <= 1e-6 && (n[1] > 0 || (n[1] === 0 && n[0] < 0)))) n = [-n[0], -n[1]];
  const steps = arc ? 10 : 1;
  const line = [];
  for (let k = 0; k <= steps; k++) {
    const q = at(s0 + ((s1 - s0) * k) / steps);
    // along an arc every point takes the normal pointing away from the letter's centre — the arrow
    // follows the curve outside it without kinks
    const nn = arc ? (() => {
      const m = [-q.d[1], q.d[0]];
      const out = (q.p[0] + m[0] - cx) ** 2 + (q.p[1] + m[1] - cy) ** 2 >= (q.p[0] - m[0] - cx) ** 2 + (q.p[1] - m[1] - cy) ** 2;
      return out ? m : [-m[0], -m[1]];
    })() : n;
    line.push([q.p[0] + nn[0] * ARROW_GAP, q.p[1] + nn[1] * ARROW_GAP]);
  }
  const [ex, ey] = line[line.length - 1];
  const [px, py] = line[line.length - 2];
  const dl = Math.hypot(ex - px, ey - py) || 1;
  const [dx, dy] = [(ex - px) / dl, (ey - py) / dl];
  const head = (sgn) => {
    const a = (sgn * 28 * Math.PI) / 180;
    const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
    return [ex - rx * ARROW_HEAD, ey - ry * ARROW_HEAD];
  };
  const f = (v) => Math.round(v * 100) / 100;
  const [h1, h2] = [head(1), head(-1)];
  return `M${line.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}M${f(h1[0])} ${f(h1[1])}L${f(ex)} ${f(ey)}L${f(h2[0])} ${f(h2[1])}`;
}

function onPolyline([px, py], pts) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2)) : 0;
    if (Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))) < 1) return true;
  }
  return false;
}

// Glyph geometry lives directly on the notebook grid (tools/print_letters/
// topic.json): 1 cell = 50 units, a letter is 2 cells tall (y 0..100) and
// `cells` wide (most letters 1 cell, wide ones like Ш — 2). Its viewBox is
// exactly that box, so every stroke that sits on a cell boundary in the data
// lands on a printed grid line — no cropping, no per-axis stretching, and the
// same proportions everywhere the letter is drawn (rows, label tile).
export const UNITS_PER_CELL = 50;

export function letterFrame(letter) {
  return [0, 0, letterCells(letter) * UNITS_PER_CELL, 2 * UNITS_PER_CELL];
}

// One printed letter (or a subset of its elements). Variants:
//   sample — solid ink with the motor plan: an arrow at the end of each
//            element, a green dot where it starts, and its number (when the
//            row has more than one element, numbered by the element's place
//            in the whole letter, `stroke.n`). Tap plays the stroke order.
//   dotted — light dotted guide to trace over.
//   trace  — light solid guide (faded copies; `opacity` per copy).
//   starts — only the green start dot over a faint trace of the element.
//   plain  — solid strokes in `color`, no marks (label tile, panel header).
// `dots` (sample, dotted, trace): a green dot where each stroke starts — numbered on the sample,
// plain on a contour; false hides them (the row's «точки» option, model.js copyPlan).
export default function LetterGlyph({
  letter,
  frame,          // [x, y, w, h] — the WHOLE letter's grid box; see letterFrame()
  heightMm,
  widthMm,
  variant  = "plain",
  color,
  opacity  = 1,
  tappable = false,
  weight,         // stroke width override in glyph units (bold letter on the plate)
  label,
  dots,           // start dots on/off; default: on for sample and starts, off for contours
}) {
  const { strokes = [] } = letter;
  const [vbX, vbY, vbW, vbH] = frame ?? letterFrame(letter);
  const wMm = widthMm ?? (heightMm * vbW) / vbH;
  const geoms = strokes.map((s) => strokeGeom(s.d));
  const markable = geoms.map((g) => g.len >= TINY);
  const showDots = dots ?? (variant === "sample" || variant === "starts");
  const numbered = variant === "sample" && showDots && markable.filter(Boolean).length > 1;
  // Where each element's start mark goes: at its start point, unless that
  // point lies on an element drawn earlier in this glyph (Н's crossbar starts
  // on the left stick, П's second stick at the bar's corner) — then a little
  // way along its own line, so the mark clearly belongs to it.
  const marks = geoms.map((g, i) => {
    const shared = geoms.slice(0, i).some((e) => onPolyline(g.start, e.pts));
    return shared && numbered ? [g.start[0] + g.dir[0] * SHIFT, g.start[1] + g.dir[1] * SHIFT] : g.start;
  });
  // The direction arrows of the sample (see guideArrow): beside each stroke, on the letter's outer
  // side, so they never sit on another stroke.
  const [cx, cy] = [vbX + vbW / 2, vbY + vbH / 2];
  const arrows = variant === "sample" ? geoms.map((g, i) => {
    if (g.len < ARROW_MIN) return null;
    const moved = marks[i][0] !== g.start[0] || marks[i][1] !== g.start[1];
    const skip = showDots ? (moved ? SHIFT : 0) + (numbered ? BADGE_R : START_R) + 4 : 0;
    return guideArrow(g, cx, cy, /C/.test(strokes[i].d), skip);
  }) : [];

  const svgRef     = useRef(null);
  const rafRef     = useRef(null);
  const timersRef  = useRef([]);
  const strokeLens = useRef([]);
  const [active, setActive]   = useState(-1);
  const [tipPos, setTipPos]   = useState(null);
  const [playing, setPlaying] = useState(false);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    strokeLens.current = Array.from(svg.querySelectorAll("[data-lg-anim]")).map((el) => {
      const len = el.getTotalLength();
      el.setAttribute("stroke-dasharray", len);
      el.setAttribute("stroke-dashoffset", len);
      return len;
    });
    return cleanup;
  }, [letter.id, cleanup]);

  function play() {
    cleanup();
    setPlaying(true);
    setTipPos(null);
    const svg = svgRef.current;
    svg?.querySelectorAll("[data-lg-anim]").forEach((el, i) => el.setAttribute("stroke-dashoffset", strokeLens.current[i]));
    const pause = 300;
    function runStroke(i) {
      if (i >= strokes.length) { setActive(-1); setTipPos(null); setPlaying(false); return; }
      setActive(i);
      const t = setTimeout(() => animStroke(i, () => {
        const t2 = setTimeout(() => runStroke(i + 1), pause);
        timersRef.current.push(t2);
      }), pause);
      timersRef.current.push(t);
    }
    const t0 = setTimeout(() => runStroke(0), 150);
    timersRef.current.push(t0);
  }

  function animStroke(idx, onDone) {
    const el = svgRef.current?.querySelector(`[data-lg-anim="${idx}"]`);
    if (!el) { onDone(); return; }
    const len = strokeLens.current[idx];
    const dur = (len / BASE_SPEED) * 1000;
    const t0 = performance.now();
    function step(now) {
      const raw = Math.min((now - t0) / dur, 1);
      const eased = easeInOut(raw);
      el.setAttribute("stroke-dashoffset", len * (1 - eased));
      const pt = el.getPointAtLength(eased * len);
      setTipPos({ x: pt.x, y: pt.y });
      if (raw < 1) rafRef.current = requestAnimationFrame(step);
      else { el.setAttribute("stroke-dashoffset", 0); setTipPos(null); onDone(); }
    }
    rafRef.current = requestAnimationFrame(step);
  }

  const ink = color ?? (variant === "sample" || variant === "plain" ? INK : GUIDE);
  const strokeW = weight ?? (variant === "dotted" ? 7 : variant === "starts" ? 5 : 9);
  const canPlay = tappable && variant === "sample";

  return (
    <svg
      ref={svgRef}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      width={`${wMm}mm`}
      height={`${heightMm}mm`}
      className={`pl-glyph pl-glyph--${variant}${canPlay ? " pl-glyph--tappable" : ""}`}
      style={{ display: "block", flexShrink: 0, opacity, cursor: canPlay ? "pointer" : undefined, overflow: "visible" }}
      onClick={canPlay && !playing ? play : undefined}
      role={canPlay ? "button" : "img"}
      aria-label={label ? `Буква ${label}` : undefined}
    >

      {strokes.map((s, i) => (
        <path
          key={`s${i}`}
          d={s.d}
          fill="none"
          stroke={ink}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={variant === "dotted" ? "1 10" : undefined}
          opacity={variant === "starts" ? 0.3 : 1}
        />
      ))}

      {arrows.map((d, i) => d && (
        <path key={`g${i}`} d={d} fill="none" stroke={ARROW} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none" }} />
      ))}

      {canPlay && strokes.map((s, i) => (
        <path key={`a${i}`} data-lg-anim={i} d={s.d} fill="none" stroke={START} strokeWidth={9}
          strokeLinecap="round" strokeLinejoin="round" opacity={playing ? 1 : 0} />
      ))}

      {/* Start marks. With several elements the green start dot carries the
          element's number (its place in the whole letter): the number sits ON
          the element it belongs to, never floating in the blank cell between
          rows where it could be read as part of the row above. */}
      {showDots && variant !== "plain" && geoms.map((g, i) => {
        if (!markable[i]) return null;
        const [mx, my] = marks[i];
        if (!numbered) return <circle key={`d${i}`} cx={mx} cy={my} r={START_R} fill={START} />;
        const on = active === i;
        return (
          <g key={`d${i}`} style={{ pointerEvents: "none" }}>
            <circle cx={mx} cy={my} r={BADGE_R} fill={START} stroke={on ? INK : "#ffffff"} strokeWidth={on ? 4 : 2} />
            <text x={mx} y={my + 5} textAnchor="middle" fontSize={15} fontWeight="800" fontFamily="Nunito, sans-serif" fill="#ffffff">
              {strokes[i].n ?? i + 1}
            </text>
          </g>
        );
      })}

      {tipPos && <circle cx={tipPos.x} cy={tipPos.y} r={TIP_R} fill={START} />}
    </svg>
  );
}
