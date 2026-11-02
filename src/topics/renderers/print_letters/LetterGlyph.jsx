import { useState, useRef, useEffect, useCallback } from "react";

const STROKE_COLOR = "#1d4ed8";
const BADGE_R      = 6.5;
const TIP_R        = 4.5;
const BASE_SPEED   = 60; // SVG units per second

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function parseStartPoint(d) {
  const m = d.match(/M\s*([\d.-]+)[,\s]+([\d.-]+)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 50];
}

// Glyph geometry lives directly on the notebook grid (tools/print_letters/
// topic.json): 1 cell = 50 units, a letter is 2 cells tall (y 0..100) and
// `cells` wide (most letters 1 cell, wide ones like Ш — 2). Its viewBox is
// exactly that box, so every stroke that sits on a cell boundary in the data
// lands on a printed grid line — no cropping, no per-axis stretching, and the
// same proportions everywhere the letter is drawn (rows, label tile).
export const UNITS_PER_CELL = 50;

export function letterCells(letter) {
  return Math.max(1, Number(letter?.cells) || 1);
}

export function letterFrame(letter) {
  return [0, 0, letterCells(letter) * UNITS_PER_CELL, 2 * UNITS_PER_CELL];
}

const BADGE_FILL = { idle: "#e5e7eb", active: "#1d4ed8", done: "#22c55e" };
const BADGE_TEXT = { idle: "#6b7280", active: "white",   done: "white"   };

// Shared animated SVG letter — one visual building block reused across every
// page type (intro / dotted / fading / independent). `variant` controls how
// the guide stroke itself is drawn; the stroke-order animation on tap is the
// same everywhere so a child always sees the same motor plan for a letter.
export default function LetterGlyph({
  letter,
  frame,                   // [x, y, w, h] — the WHOLE letter's grid box; see letterFrame() above
  heightMm,
  widthMm,
  color       = STROKE_COLOR,
  variant     = "solid",   // "solid" | "dotted" | "fading"
  opacity     = 1,
  showNumbers = false,
  showArrows  = true,
  tappable    = true,
  autoPlay    = false,
  label,
}) {
  const { strokes = [] } = letter;
  const [vbX, vbY, vbW, vbH] = frame ?? letterFrame(letter);
  const wMm = widthMm ?? (heightMm * vbW) / vbH;
  const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;

  const svgRef     = useRef(null);
  const rafRef      = useRef(null);
  const timersRef   = useRef([]);
  const strokeLens  = useRef([]);
  const [badgeStates, setBadgeStates] = useState(() => strokes.map(() => "idle"));
  const [tipPos, setTipPos]           = useState(null);
  const [playing, setPlaying]         = useState(false);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    // Only the pen-demo overlay (not the always-visible guide stroke) is
    // measured and dash-animated, so the idle look (solid/dotted/faded
    // guide) never depends on whether a play has ever run.
    const paths = svg.querySelectorAll("[data-lg-anim]");
    strokeLens.current = Array.from(paths).map((el) => {
      const len = el.getTotalLength();
      el.setAttribute("stroke-dasharray", len);
      el.setAttribute("stroke-dashoffset", len);
      return len;
    });
    if (autoPlay) {
      const t = setTimeout(() => play(), 300);
      timersRef.current.push(t);
    }
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter.id]);

  function resetStrokes() {
    const svg = svgRef.current;
    if (!svg) return;
    svg.querySelectorAll("[data-lg-anim]").forEach((el, i) => {
      el.setAttribute("stroke-dashoffset", strokeLens.current[i]);
    });
  }

  function play() {
    cleanup();
    setPlaying(true);
    setTipPos(null);
    setBadgeStates(strokes.map(() => "idle"));
    resetStrokes();
    const pause = 300;

    function runStroke(i) {
      if (i >= strokes.length) {
        setTipPos(null);
        setPlaying(false);
        return;
      }
      setBadgeStates((prev) => { const n = [...prev]; n[i] = "active"; return n; });
      const t = setTimeout(() => {
        animStroke(i, () => {
          setBadgeStates((prev) => { const n = [...prev]; n[i] = "done"; return n; });
          const t2 = setTimeout(() => runStroke(i + 1), pause);
          timersRef.current.push(t2);
        });
      }, pause);
      timersRef.current.push(t);
    }
    const t0 = setTimeout(() => runStroke(0), 150);
    timersRef.current.push(t0);
  }

  function animStroke(idx, onDone) {
    const svg = svgRef.current;
    if (!svg) return;
    const el = svg.querySelector(`[data-lg-anim="${idx}"]`);
    if (!el) { onDone(); return; }
    const len = strokeLens.current[idx];
    const dur = (len / BASE_SPEED) * 1000;
    const t0  = performance.now();
    function frame(now) {
      const raw   = Math.min((now - t0) / dur, 1);
      const eased = easeInOut(raw);
      el.setAttribute("stroke-dashoffset", len * (1 - eased));
      const pt = el.getPointAtLength(eased * len);
      setTipPos({ x: pt.x, y: pt.y });
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        el.setAttribute("stroke-dashoffset", 0);
        setTipPos(null);
        onDone();
      }
    }
    rafRef.current = requestAnimationFrame(frame);
  }

  // Real mm, not screen px — this glyph is meant to print at an actual
  // physical size (SVG width/height accept CSS length units, so "Nmm" is a
  // true physical size the browser's print pipeline honors directly).
  const strokeW = variant === "dotted" ? 7 : 9;
  return (
    <svg
      ref={svgRef}
      viewBox={viewBox}
            width={`${wMm}mm`}
      height={`${heightMm}mm`}
      className={`pl-glyph pl-glyph--${variant}${tappable ? " pl-glyph--tappable" : ""}`}
      style={{ display: "block", flexShrink: 0, opacity, cursor: tappable ? "pointer" : "default", overflow: "visible" }}
      onClick={tappable && !playing ? play : undefined}
      role={tappable ? "button" : "img"}
      aria-label={label ? `Буква ${label}` : undefined}
    >
      <defs>
        <marker id={`pl-arr-${letter.id}`} viewBox="0 0 9 7" refX="8.5" refY="3.5"
          markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="7" orient="auto">
          <path d="M 0,0 L 9,3.5 L 0,7 Z" fill="#fbbf24" opacity="0.85" />
        </marker>
      </defs>

      {/* ghost outline with direction arrows — always full strength so the
          motor plan stays legible even when the guide stroke itself fades */}
      {showArrows && strokes.map((s, i) => (
        <path key={`g${i}`} d={s.d} fill="none"
          stroke={color} strokeWidth={strokeW}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.14}
          markerEnd={`url(#pl-arr-${letter.id})`} />
      ))}

      {/* guide stroke — always visible, solid/dotted/faded per page type.
          Independent of the tap-to-animate overlay below. */}
      {strokes.map((s, i) => (
        <path
          key={`guide${i}`}
          d={s.d}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={variant === "dotted" ? "3 9" : undefined}
        />
      ))}

      {/* pen-demo overlay — solid, drawn progressively on tap/autoplay, then
          hidden again so the guide underneath (e.g. dotted) shows through */}
      {strokes.map((s, i) => (
        <path
          key={`a${i}`}
          data-lg-anim={i}
          d={s.d}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={playing ? 1 : 0}
        />
      ))}

      {/* Several printed-letter strokes often start at the exact same corner
          (both strokes of «Г», the left bar and left stick of «П»…). Stacking
          badges there would hide all but the last one, so repeats of the
          same start point cascade diagonally with a leader line back to the
          real point. */}
      {showNumbers && (() => {
        const seen = new Map();
        return strokes.map((s, i) => {
          const [bx, by] = parseStartPoint(s.d);
          const key = `${bx},${by}`;
          const dup = seen.get(key) || 0;
          seen.set(key, dup + 1);
          const ox = bx + dup * 11;
          const oy = by + dup * 11;
          return (
            <g key={`b${i}`}>
              {dup > 0 && (
                <line x1={bx} y1={by} x2={ox} y2={oy} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="1.5 2" />
              )}
              <circle cx={ox} cy={oy} r={BADGE_R} fill={BADGE_FILL[badgeStates[i]]} stroke="white" strokeWidth={0.8} />
              <text x={ox} y={oy + 2} textAnchor="middle" fontSize={6.5} fontWeight="700"
                fill={BADGE_TEXT[badgeStates[i]]} style={{ userSelect: "none", pointerEvents: "none" }}>
                {i + 1}
              </text>
            </g>
          );
        });
      })()}

      {tipPos && <circle cx={tipPos.x} cy={tipPos.y} r={TIP_R} fill="#fbbf24" opacity={0.9} />}
    </svg>
  );
}
