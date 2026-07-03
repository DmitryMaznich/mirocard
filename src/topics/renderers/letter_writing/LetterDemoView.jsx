import { useState, useRef, useEffect, useCallback } from "react";
import { ForwardArrowIcon } from "@/shared/components/ArrowIcons";

const STROKE_COLOR = "#1d4ed8";
const STROKE_WIDTH = 8;
const BADGE_R      = 5.5;
const TIP_R        = 4;
const BASE_SPEED   = 60; // SVG units per second at speedFactor=1.0

const BADGE_FILL = { idle: "#e5e7eb", active: "#1d4ed8", done: "#22c55e" };
const BADGE_TEXT = { idle: "#6b7280", active: "white",   done: "white"   };

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function parseStartPoint(d) {
  const m = d.match(/M\s*([\d.-]+)[,\s]+([\d.-]+)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 50];
}

function NotebookBg({ w, h }) {
  const lines = [];
  for (let y = 10; y <= h; y += 10) {
    lines.push(y);
  }
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} fill="#fefef6" />
      {lines.map((y) => (
        <line key={y} x1={0} y1={y} x2={w} y2={y} stroke="#cde8f5" strokeWidth="0.5" />
      ))}
      {/* cap line */}
      <line x1={0} y1={5}    x2={w} y2={5}    stroke="#f4b8b8" strokeWidth="0.8" />
      {/* baseline */}
      <line x1={0} y1={h-10} x2={w} y2={h-10} stroke="#9ec8e8" strokeWidth="0.8" />
      {/* margin */}
      <line x1={w * 0.12} y1={0} x2={w * 0.12} y2={h} stroke="#f4b8b8" strokeWidth="0.4" />
    </g>
  );
}

export default function LetterDemoView({ task, onAdvance }) {
  const { letter, viewBox, strokes } = task;
  const [, , vbW, vbH] = viewBox.split(" ").map(Number);

  const svgRef        = useRef(null);
  const rafRef        = useRef(null);
  const timersRef     = useRef([]);
  const strokeLens    = useRef([]);
  const [badgeStates, setBadgeStates] = useState(() => strokes.map(() => "idle"));
  const [tipPos,      setTipPos]      = useState(null);
  const [showAdvance, setShowAdvance] = useState(false);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Measure path lengths and auto-start on mount
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const paths = svg.querySelectorAll("[data-anim]");
    strokeLens.current = Array.from(paths).map((el) => {
      const len = el.getTotalLength();
      el.setAttribute("stroke-dasharray", len);
      el.setAttribute("stroke-dashoffset", len);
      return len;
    });

    const t = setTimeout(() => startAnim(1.0), 500);
    timersRef.current.push(t);

    return cleanup;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function resetStrokes() {
    const svg = svgRef.current;
    if (!svg) return;
    svg.querySelectorAll("[data-anim]").forEach((el, i) => {
      el.setAttribute("stroke-dashoffset", strokeLens.current[i]);
    });
  }

  function startAnim(speed) {
    cleanup();
    setShowAdvance(false);
    setTipPos(null);
    setBadgeStates(strokes.map(() => "idle"));
    resetStrokes();

    const pause = 350 / speed;

    function runStroke(i) {
      if (i >= strokes.length) {
        setTipPos(null);
        setShowAdvance(true);
        return;
      }
      setBadgeStates((prev) => {
        const next = [...prev];
        next[i] = "active";
        return next;
      });
      const t = setTimeout(() => {
        animStroke(i, speed, () => {
          setBadgeStates((prev) => {
            const next = [...prev];
            next[i] = "done";
            return next;
          });
          const t2 = setTimeout(() => runStroke(i + 1), pause);
          timersRef.current.push(t2);
        });
      }, pause);
      timersRef.current.push(t);
    }

    const t0 = setTimeout(() => runStroke(0), 300 / speed);
    timersRef.current.push(t0);
  }

  function animStroke(idx, speed, onDone) {
    const svg = svgRef.current;
    if (!svg) return;
    const el  = svg.querySelector(`[data-anim="${idx}"]`);
    if (!el)  return;
    const len = strokeLens.current[idx];
    const dur = (len / (BASE_SPEED * speed)) * 1000;
    const t0  = performance.now();

    function frame(now) {
      const raw = Math.min((now - t0) / dur, 1);
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

  return (
    <div className="lw-view">
      <div className="lw-card">
        <div className="lw-card-header">
          <span className="lw-letter-title">{letter}</span>
          <div className="lw-step-dots">
            {strokes.map((_, i) => (
              <span key={i} className={`lw-step-dot lw-step-dot--${badgeStates[i]}`} />
            ))}
          </div>
        </div>
        <svg ref={svgRef} viewBox={viewBox} className="lw-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="lw-demo-arr" viewBox="0 0 9 7" refX="8.5" refY="3.5"
              markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="7" orient="auto">
              <path d="M 0,0 L 9,3.5 L 0,7 Z" fill="#fbbf24" opacity="0.85" />
            </marker>
          </defs>
          <NotebookBg w={vbW} h={vbH} />

          {/* ghost with direction arrows */}
          {strokes.map((s, i) => (
            <path
              key={`g${i}`}
              d={s.d}
              fill="none"
              stroke={STROKE_COLOR}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.15}
              markerEnd="url(#lw-demo-arr)"
            />
          ))}

          {/* animated strokes — dashoffset set via DOM, NOT in JSX */}
          {strokes.map((s, i) => (
            <path
              key={`a${i}`}
              data-anim={i}
              d={s.d}
              fill="none"
              stroke={STROKE_COLOR}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* start badges */}
          {strokes.map((s, i) => {
            const [bx, by] = parseStartPoint(s.d);
            return (
              <g key={`b${i}`}>
                <circle
                  cx={bx} cy={by} r={BADGE_R}
                  fill={BADGE_FILL[badgeStates[i]]}
                  stroke="white" strokeWidth={0.8}
                />
                <text
                  x={bx} y={by + 1.8}
                  textAnchor="middle"
                  fontSize={5}
                  fontWeight="700"
                  fill={BADGE_TEXT[badgeStates[i]]}
                  style={{ userSelect: "none", pointerEvents: "none" }}
                >
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* pen tip */}
          {tipPos && (
            <circle cx={tipPos.x} cy={tipPos.y} r={TIP_R} fill="#fbbf24" opacity={0.9} />
          )}
        </svg>
      </div>

      <div className="lw-controls">
        <button className="lw-btn" onClick={() => startAnim(1.0)}>▶ Повторить</button>
        <button className="lw-btn lw-btn--secondary" onClick={() => startAnim(0.4)}>🐢 Медленно</button>
        {showAdvance && (
          <button className="lw-btn lw-btn--advance" onClick={onAdvance}>Дальше <ForwardArrowIcon size={15} /></button>
        )}
      </div>
    </div>
  );
}
