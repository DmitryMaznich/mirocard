import { useRef } from "react";
import { INK_COLOR, NIB_COLOR, STROKE_W } from "./propisRuling.js";
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
      {/* Small pen: a gold shaft held at a fixed writing angle, plus the actual contact
          point in the ink color — reads as "a pen touching the paper" even at the tiny
          real on-screen size this animation runs at (verified via screenshot mockup,
          2026-08-13: a plain/bigger dot or an oriented arrowhead were indistinguishable
          blobs at true scale; this silhouette was the only one that still read as a pen). */}
      <g data-pr-tip opacity="0">
        <line x1="0.6" y1="-0.9" x2="4.5" y2="-5.2" stroke={NIB_COLOR} strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="4.5" cy="-5.2" r="0.7" fill={NIB_COLOR} />
        <circle cx="0" cy="0" r="0.75" fill={INK_COLOR} />
      </g>
    </g>
  );
}
