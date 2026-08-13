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
      {/* Small pen: a rounded gold body tapering to a pointed ink-colored tip, held at a
          fixed writing angle. First attempt (a thin shaft+dot, ~7 units) was reported as
          reading as an invisible speck on a real phone — measured true on-screen size is
          well under 10px there, so a bigger, bolder FILLED silhouette (not thin strokes,
          which anti-alias away at this scale) was needed. Sized ~24 units — visible next
          to the letter without dominating it — chosen from a 3-way screenshot mockup
          compared against a real captured letter at true scale (2026-08-13). */}
      <g data-pr-tip opacity="0">
        <g transform="rotate(-55)">
          <path d="M 0 0 L -2.6 -4.5 L -2.6 -21 Q -2.6 -24 0 -24.5 Q 2.6 -24 2.6 -21 L 2.6 -4.5 Z" fill={NIB_COLOR} />
          <path d="M -2.6 -4.5 L 0 0 L 2.6 -4.5 Z" fill={INK_COLOR} />
        </g>
      </g>
    </g>
  );
}
