import { useRef } from "react";
import { INK_COLOR, NIB_COLOR, STROKE_W, TIP_R } from "./propisRuling.js";
import { useLoopingStrokes } from "./useLoopingStrokes.js";

// Renders one trajectory's looping handwriting animation: a faint static background copy
// of every stroke, the same strokes redrawn as an animated dash-offset reveal, and a
// moving pen-tip dot. No <svg>/viewBox of its own — the caller positions it (a plain <g>
// inside its own coordinate space): WordAnimatedCard.jsx wraps it in a per-word <svg>,
// WriteTextView.jsx wraps it in a <g transform> inside its shared multi-row grid <svg>.
export default function AnimatedStrokes({ trajectory, delayMs = 200, loopPauseMs = 1400 }) {
  const gRef = useRef(null);
  const dependencyKey = trajectory.strokes.map((s) => s.d).join("|");
  useLoopingStrokes(gRef, dependencyKey, { delayMs, loopPauseMs });

  return (
    <g ref={gRef}>
      {trajectory.strokes.map((s, i) => (
        <path key={`g${i}`} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={STROKE_W}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
      ))}
      {trajectory.strokes.map((s, i) => (
        <path key={`a${i}`} data-pr-anim={i} data-pr-continuous={s.continuous ? "1" : undefined}
          d={s.d} fill="none" stroke={INK_COLOR}
          strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <circle data-pr-tip r={TIP_R} cx="0" cy="0" fill={NIB_COLOR} opacity="0" />
    </g>
  );
}
