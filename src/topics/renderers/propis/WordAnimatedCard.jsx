import { useRef } from "react";
import { INK_COLOR, NIB_COLOR, STROKE_W, TIP_R, GUIDE_LINES, NATIVE_L3 } from "./propisRuling.js";
import { useLoopingStrokes } from "./useLoopingStrokes.js";

const GUIDE_THIN_W = 0.4;
const GUIDE_BOLD_W = 0.9;
const GUIDE_COLOR = "#6fa3e0";

export default function WordAnimatedCard({ trajectory }) {
  const gRef = useRef(null);
  const dependencyKey = trajectory.strokes.map((s) => s.d).join("|");
  useLoopingStrokes(gRef, dependencyKey, { delayMs: 200, loopPauseMs: 1400 });

  return (
    <svg
      className="propis-practice-card-svg"
      viewBox={trajectory.viewBox}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="0" y="0" width="100%" height="100%" className="propis-paper" />
      {GUIDE_LINES.map((g) => (
        <line
          key={g.line}
          x1="0" y1={g.y} x2={trajectory.totalWidthUnits} y2={g.y}
          stroke={GUIDE_COLOR}
          strokeWidth={g.y === NATIVE_L3 ? GUIDE_BOLD_W : GUIDE_THIN_W}
        />
      ))}
      <g ref={gRef}>
        {trajectory.strokes.map((s, i) => (
          <path key={`g${i}`} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={STROKE_W}
            strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
        ))}
        {trajectory.strokes.map((s, i) => (
          <path key={`a${i}`} data-pr-anim={i} d={s.d} fill="none" stroke={INK_COLOR}
            strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        <circle data-pr-tip r={TIP_R} cx="0" cy="0" fill={NIB_COLOR} opacity="0" />
      </g>
    </svg>
  );
}
