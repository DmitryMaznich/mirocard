import { useRef, useState } from "react";

const STROKE_COLOR = "#ef4444";
const STROKE_WIDTH = 4;
// How much of the cell's width the drag must span, left to right, before
// the gesture counts as a completed cross-out.
const COMPLETE_SPREAD_RATIO = 0.7;

function pointsToPath(points) {
  if (points.length < 2) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

// Transparent gesture-capture overlay for one digit cell. Renders nothing
// visible until the child starts dragging — the underlying .col-digit cell
// looks completely ordinary until then. Reports the finished hand-drawn
// path (not a synthetic straight line) back to the caller via onComplete
// the instant the completion condition is met, so success can fire
// mid-gesture rather than waiting for pointer-up.
export default function CrossoutGesture({ cellWidth, cellHeight, onComplete }) {
  const svgRef = useRef(null);
  const isDrawing = useRef(false);
  const completed = useRef(false);
  const [points, setPoints] = useState([]);

  function toLocalPoint(e) {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function isComplete(pts) {
    if (pts.length < 2) return false;
    const xs = pts.map((p) => p.x);
    const spread = Math.max(...xs) - Math.min(...xs);
    const netRightward = pts[pts.length - 1].x > pts[0].x;
    return spread >= cellWidth * COMPLETE_SPREAD_RATIO && netRightward;
  }

  function handlePointerDown(e) {
    e.preventDefault();
    const pt = toLocalPoint(e);
    if (!pt) return;
    isDrawing.current = true;
    completed.current = false;
    setPoints([pt]);
  }

  function handlePointerMove(e) {
    e.preventDefault();
    if (!isDrawing.current || completed.current) return;
    const pt = toLocalPoint(e);
    if (!pt) return;
    setPoints((prev) => {
      const next = [...prev, pt];
      if (isComplete(next)) {
        completed.current = true;
        isDrawing.current = false;
        onComplete?.(pointsToPath(next));
      }
      return next;
    });
  }

  function handlePointerUp() {
    isDrawing.current = false;
    // Incomplete attempt: the line disappears, no penalty, retry immediately.
    if (!completed.current) setPoints([]);
  }

  const d = pointsToPath(points);

  return (
    <svg
      ref={svgRef}
      className="col-crossout-gesture"
      width={cellWidth}
      height={cellHeight}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {d && (
        <path d={d} fill="none" stroke={STROKE_COLOR} strokeWidth={STROKE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
