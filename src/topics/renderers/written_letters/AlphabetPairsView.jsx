import { useRef, useLayoutEffect } from "react";
import HandwrittenLetter from "./HandwrittenLetter";

const VBW = 100;
const VBH = 150;
const L2  = 62;
const L3  = 88;
const L4  = 140;

// Letter size chosen so SVG height ≈ one propis pitch (L4-L2 span of STIM_H).
// STIM_H = round(120 * 150/100) = 180; PITCH_PX = round(78/150 * 180) = 94px.
// We set SVG height = PITCH_PX exactly by using it as background-size period,
// so every flex-wrap row lands on the same propis lines throughout the screen.
const STIM_H   = Math.round(120 * VBH / VBW);                // 180px (canonical)
const PITCH_PX = Math.round((L4 - L2) / VBH * STIM_H);       // 94px

// Closest integer size giving SVG_H ≈ PITCH_PX
const LETTER_SIZE = 63;
const LETTER_H    = Math.round(LETTER_SIZE * VBH / VBW);      // 95px (≈ PITCH_PX)

// Background uses LETTER_H as its period so rows stay in phase across the screen.
const BG_PITCH = LETTER_H;                                    // 95px

const L2_PX = Math.round(L2 / VBH * LETTER_H);  // position of L2 guide inside SVG
const L3_PX = Math.round(L3 / VBH * LETTER_H);  // position of L3 baseline inside SVG
const COMMA_MB = LETTER_H - L3_PX;              // margin-bottom to sit comma on baseline

export default function AlphabetPairsView({ task }) {
  const rootRef  = useRef(null);
  const firstRef = useRef(null);

  const { pairs = [] } = task;

  useLayoutEffect(() => {
    const root  = rootRef.current;
    const first = firstRef.current;
    if (!root || !first) return;
    const align = () => {
      const rr = root.getBoundingClientRect();
      const fr = first.getBoundingClientRect();
      const svgTopY = fr.top - rr.top;
      // With background-attachment:local the background origin is content-area
      // (after padding), so subtract padding-top before computing phase.
      const pt = parseFloat(getComputedStyle(root).paddingTop) || 0;
      const l2Phase = ((svgTopY - pt + L2_PX) % BG_PITCH + BG_PITCH) % BG_PITCH;
      const l3Phase = ((svgTopY - pt + L3_PX) % BG_PITCH + BG_PITCH) % BG_PITCH;
      root.style.backgroundSize     = `auto, 100% ${BG_PITCH}px, 100% ${BG_PITCH}px`;
      root.style.backgroundPosition = `0 0, 0 ${l2Phase}px, 0 ${l3Phase}px`;
    };
    align();
    window.addEventListener("resize", align);
    return () => window.removeEventListener("resize", align);
  }, [task]);

  return (
    <div ref={rootRef} className="wl-alpha-screen">
      <div className="wl-alpha-flow">
        {pairs.map((pair, i) => (
          <div
            key={pair.upper + i}
            ref={i === 0 ? firstRef : undefined}
            className="wl-alpha-item"
          >
            <HandwrittenLetter letter={pair.upper} size={LETTER_SIZE} bare />
            <HandwrittenLetter letter={pair.lower} size={LETTER_SIZE} bare />
            {i < pairs.length - 1 && (
              <span className="wl-alpha-comma" style={{ marginBottom: COMMA_MB }}>
                ,
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
