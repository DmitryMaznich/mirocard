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

// Start point, direction of the first segment and total length of an M/L path.
function strokeGeom(d) {
  const nums = (d.match(/-?\d+\.?\d*/g) || []).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  const [x0, y0] = pts[0] ?? [0, 0];
  const [x1, y1] = pts[1] ?? [x0, y0];
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const seg = Math.hypot(x1 - x0, y1 - y0) || 1;
  return { start: [x0, y0], dir: [(x1 - x0) / seg, (y1 - y0) / seg], len, pts };
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
  const arrowId = `pl-arr-${letter.id}-${strokes.map((s) => s.n ?? "").join("")}`;

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
      {variant === "sample" && (
        <defs>
          <marker id={arrowId} viewBox="0 0 10 10" refX="6" refY="5" markerUnits="userSpaceOnUse" markerWidth="17" markerHeight="17" orient="auto">
            <path d="M0 1L9 5L0 9z" fill={ink} />
          </marker>
        </defs>
      )}

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
          markerEnd={variant === "sample" && markable[i] ? `url(#${arrowId})` : undefined}
        />
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
