import { useRef } from "react";
import { INK_COLOR, NIB_COLOR, STROKE_W } from "./propisRuling.js";
import { useLoopingStrokes } from "./useLoopingStrokes.js";

// tipSize="large" real-world scale check: this file's native units are always 6/mm
// (propisRuling.js's UNIT_H=150 per LINE_MM=25mm — the same scale every captured letter's
// own path data uses). 120 units = 20mm = the front ~2cm of an actual ballpoint pen (the
// part a hand would recognize: the metal cone + a couple mm of the plastic barrel it sits
// in), not the whole pen and not just the ball. Only PrintPageView.jsx opts into this —
// added 2026-09-13 specifically because that view renders the notebook page at true
// physical mm scale (real print-page geometry, propisRuling.js's PRINT_* constants), where
// the original ~24-unit (4mm) tip reads as an unrecognizable speck next to a real-size
// page on a tablet. The default ("normal") tip is untouched deliberately: it was already
// tuned and confirmed against the OTHER views' own (much smaller, non-physical) on-screen
// scale (see its own comment below, 2026-08-13) — resizing it there would undo that.
const TIP_PATHS = {
  normal: [
    { d: "M 0 0 L -2.6 -4.5 L -2.6 -21 Q -2.6 -24 0 -24.5 Q 2.6 -24 2.6 -21 L 2.6 -4.5 Z", fill: "nib" },
    { d: "M -2.6 -4.5 L 0 0 L 2.6 -4.5 Z", fill: "ink" },
  ],
  // Ball housing (dark metal) -> cone (brass/gold, NIB_COLOR) -> a sliver of the plastic
  // barrel (INK_COLOR, doubling as "this pen writes in this color") it plugs into, cut off
  // at the 20mm mark rather than drawing the rest of a full-length pen.
  large: [
    { d: "M 0 0 L -4 -10 L 4 -10 Z", fill: "#3f3f46" },
    { d: "M -4 -10 L -20 -74 L 20 -74 L 4 -10 Z", fill: "nib" },
    { d: "M -20 -74 L -26 -114 Q -26 -120 0 -121 Q 26 -120 26 -114 L 20 -74 Z", fill: "ink" },
  ],
};

// Renders one trajectory's looping handwriting animation: a faint static background copy
// of every stroke, the same strokes redrawn as an animated dash-offset reveal, and a
// moving pen-tip dot. No <svg>/viewBox of its own — the caller positions it (a plain <g>
// inside its own coordinate space): WordAnimatedCard.jsx wraps it in a per-word <svg>,
// WriteTextView.jsx wraps it in a <g transform> inside its shared multi-row grid <svg>.
export default function AnimatedStrokes({ trajectory, delayMs = 200, loopPauseMs = 1400, tipSize = "normal" }) {
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
          compared against a real captured letter at true scale (2026-08-13).
          tipSize="large" (2026-09-13, PrintPageView.jsx only) swaps this for the front
          ~2cm of an actual pen at true scale — see TIP_PATHS' own comment above. */}
      <g data-pr-tip opacity="0">
        <g transform="rotate(55)">
          {TIP_PATHS[tipSize].map((p, i) => (
            <path key={i} d={p.d} fill={p.fill === "nib" ? NIB_COLOR : p.fill === "ink" ? INK_COLOR : p.fill} />
          ))}
        </g>
      </g>
    </g>
  );
}
