import { useState, useRef, useEffect } from "react";

const STROKE_COLOR  = "#1d4ed8";
const STROKE_WIDTH  = 8;
const BADGE_R       = 5.5;
const TRACE_COLOR   = "#3b82f6";
const TRACE_WIDTH   = 9;

function parseStartPoint(d) {
  const m = d.match(/M\s*([\d.-]+)[,\s]+([\d.-]+)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 50];
}

function NotebookBg({ w, h }) {
  const lines = [];
  for (let y = 10; y <= h; y += 10) lines.push(y);
  return (
    <g>
      <rect x={0} y={0} width={w} height={h} fill="#fefef6" />
      {lines.map((y) => (
        <line key={y} x1={0} y1={y} x2={w} y2={y} stroke="#cde8f5" strokeWidth="0.5" />
      ))}
      <line x1={0} y1={5}    x2={w} y2={5}    stroke="#f4b8b8" strokeWidth="0.8" />
      <line x1={0} y1={h-10} x2={w} y2={h-10} stroke="#9ec8e8" strokeWidth="0.8" />
      <line x1={w * 0.12} y1={0} x2={w * 0.12} y2={h} stroke="#f4b8b8" strokeWidth="0.4" />
    </g>
  );
}

export default function LetterTraceView({ task, onAdvance }) {
  const { letter, viewBox, strokes } = task;
  const [, , vbW, vbH] = viewBox.split(" ").map(Number);

  const svgRef       = useRef(null);
  const isDrawing    = useRef(false);
  // Each element: array of {x, y} points forming one stroke
  const [userStrokes, setUserStrokes] = useState([]);
  const currentLine  = useRef([]);

  // Convert DOM coords to SVG coords
  function toSVGPoint(e) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt  = svg.createSVGPoint();
    const src = e.touches ? e.touches[0] : e;
    pt.x = src.clientX;
    pt.y = src.clientY;
    try {
      const ctm = svg.getScreenCTM();
      if (!ctm) return null;
      const svgPt = pt.matrixTransform(ctm.inverse());
      return { x: svgPt.x, y: svgPt.y };
    } catch {
      return null;
    }
  }

  function handlePointerDown(e) {
    e.preventDefault();
    const pt = toSVGPoint(e);
    if (!pt) return;
    isDrawing.current = true;
    currentLine.current = [pt];
  }

  function handlePointerMove(e) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const pt = toSVGPoint(e);
    if (!pt) return;
    currentLine.current = [...currentLine.current, pt];
    // Force a re-render to show the growing line
    setUserStrokes((prev) => {
      if (prev.length === 0) return [currentLine.current];
      return [...prev.slice(0, -1), currentLine.current];
    });
  }

  function handlePointerUp(e) {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const finalLine = currentLine.current;
    currentLine.current = [];
    if (finalLine.length > 1) {
      setUserStrokes((prev) => {
        // Replace the last in-progress line with the finished one, or append
        const already = prev.length > 0 && prev[prev.length - 1] === finalLine;
        return already ? prev : [...prev.slice(0, -1), finalLine];
      });
    }
    // Start a fresh slot for the next stroke
    setUserStrokes((prev) => [...prev]);
  }

  function handleClear() {
    setUserStrokes([]);
    currentLine.current = [];
    isDrawing.current   = false;
  }

  function pointsToD(pts) {
    if (pts.length < 2) return "";
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  }

  return (
    <div className="lw-view">
      <div className="lw-card">
        <div className="lw-card-header">
          <span className="lw-letter-title">{letter}</span>
          <div className="lw-step-dots">
            {strokes.map((_, i) => (
              <span key={i} className="lw-step-dot" />
            ))}
          </div>
        </div>
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="lw-svg"
          xmlns="http://www.w3.org/2000/svg"
          style={{ cursor: "crosshair" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <defs>
            <marker id="lw-trace-arr" viewBox="0 0 9 7" refX="8.5" refY="3.5"
              markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="7" orient="auto">
              <path d="M 0,0 L 9,3.5 L 0,7 Z" fill="#fbbf24" opacity="0.9" />
            </marker>
          </defs>
          <NotebookBg w={vbW} h={vbH} />

          {/* Ghost letter — dashed with direction arrows */}
          {strokes.map((s, i) => (
            <path
              key={`g${i}`}
              d={s.d}
              fill="none"
              stroke={STROKE_COLOR}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 5"
              opacity={0.25}
              markerEnd="url(#lw-trace-arr)"
            />
          ))}

          {/* Start badges with numbers */}
          {strokes.map((s, i) => {
            const [bx, by] = parseStartPoint(s.d);
            return (
              <g key={`b${i}`}>
                <circle cx={bx} cy={by} r={BADGE_R}
                  fill="#e5e7eb" stroke="white" strokeWidth={0.8} />
                <text x={bx} y={by + 1.8} textAnchor="middle" fontSize={5}
                  fontWeight="700" fill="#6b7280"
                  style={{ userSelect: "none", pointerEvents: "none" }}>
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* User drawn strokes */}
          {userStrokes.map((pts, i) => {
            const d = pointsToD(pts);
            if (!d) return null;
            return (
              <path
                key={`u${i}`}
                d={d}
                fill="none"
                stroke={TRACE_COLOR}
                strokeWidth={TRACE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.8}
              />
            );
          })}
        </svg>
      </div>

      <div className="lw-controls">
        <button className="lw-btn lw-btn--secondary" onClick={handleClear}>✕ Стереть</button>
        <button className="lw-btn lw-btn--done" onClick={onAdvance}>Готово →</button>
      </div>
    </div>
  );
}
