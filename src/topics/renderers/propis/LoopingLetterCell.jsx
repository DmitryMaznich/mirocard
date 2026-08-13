import { useRef } from "react";
import { LINE_MM, UNIT_H, L2, L3, LETTER_BASELINE_UNIT, LETTER_XHEIGHT_UNIT_SPAN, INK_COLOR, NIB_COLOR, STROKE_W } from "./propisRuling.js";
import { useLoopingStrokes } from "./useLoopingStrokes.js";

// One item's animated sample, looping forever until unmounted.
export default function LoopingLetterCell({ item, delayMs = 0, loopPauseMs = 1400 }) {
  const gRef = useRef(null);
  useLoopingStrokes(gRef, item.id, { delayMs, loopPauseMs });

  const [vbMinX, vbMinY] = (item.viewBox || "0 0 100 150").split(" ").map(Number);

  // Scale so the letter's own x-height body (LETTER_XHEIGHT_UNIT_SPAN, its main body
  // excluding ascenders/descenders) matches the ruling's узкая строка exactly — not the
  // letter's whole 150-unit box against the whole row, which underscales the body.
  const rulingNarrowMm = ((L3 - L2) / UNIT_H) * LINE_MM;
  const scale = rulingNarrowMm / LETTER_XHEIGHT_UNIT_SPAN;

  // Re-anchor onto the ruling's actual baseline guide (L3) instead of relying on the
  // letter's baked-in baseline (LETTER_BASELINE_UNIT, from the original font-formation
  // system) to already land there — the two diverge under the current row zones.
  const targetBaselineMm = (L3 / UNIT_H) * LINE_MM;
  const naiveBaselineMm  = LETTER_BASELINE_UNIT * scale;
  const baselineShiftMm  = targetBaselineMm - naiveBaselineMm;

  return (
    <g ref={gRef} transform={`translate(0 ${baselineShiftMm}) scale(${scale}) translate(${-vbMinX} ${-vbMinY})`}>
      {item.strokes.map((s, i) => (
        <path key={`g${i}`} d={s.d} fill="none" stroke={INK_COLOR} strokeWidth={STROKE_W}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
      ))}
      {item.strokes.map((s, i) => (
        <path key={`a${i}`} data-pr-anim={i} d={s.d} fill="none" stroke={INK_COLOR}
          strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* Small pen: a rounded gold body tapering to a pointed ink-colored tip, held at a
          fixed writing angle — see AnimatedStrokes.jsx for the sizing rationale and the
          reasoning behind this exact shape (shared visual language across the topic). */}
      <g data-pr-tip opacity="0">
        <g transform="rotate(-55)">
          <path d="M 0 0 L -2.6 -4.5 L -2.6 -21 Q -2.6 -24 0 -24.5 Q 2.6 -24 2.6 -21 L 2.6 -4.5 Z" fill={NIB_COLOR} />
          <path d="M -2.6 -4.5 L 0 0 L 2.6 -4.5 Z" fill={INK_COLOR} />
        </g>
      </g>
    </g>
  );
}
