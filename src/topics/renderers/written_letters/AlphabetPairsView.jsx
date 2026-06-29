import { useRef, useLayoutEffect } from "react";
import HandwrittenLetter from "./HandwrittenLetter";

const VBW = 100;
const VBH = 150;
const L2  = 62;
const L3  = 88;
const L4  = 140;

// Same pitch constant as MatchPairView
const PITCH_PX = Math.round((L4 - L2) / VBH * Math.round(120 * VBH / VBW));  // 94px

function letterSize(cols) {
  if (cols === 1) return 100;
  if (cols === 3) return 42;
  return 63; // 2 cols: SVG height ≈ PITCH_PX so rows land on the same background lines
}

function pairLetterGap(cols) {
  return cols === 1 ? 20 : cols === 3 ? 6 : 10;
}

export default function AlphabetPairsView({ task }) {
  const rootRef  = useRef(null);
  const firstRef = useRef(null);

  const { pairs = [], columns = 2 } = task;
  const cols  = Number(columns);
  const size  = letterSize(cols);
  const svgH  = Math.round(size * VBH / VBW);

  useLayoutEffect(() => {
    const root  = rootRef.current;
    const first = firstRef.current;
    if (!root || !first) return;
    const align = () => {
      const rr = root.getBoundingClientRect();
      const fr = first.getBoundingClientRect();
      const svgTopY = fr.top - rr.top;
      const l2Y = svgTopY + Math.round(L2 / VBH * svgH);
      const l3Y = svgTopY + Math.round(L3 / VBH * svgH);
      const l2Phase = ((l2Y % PITCH_PX) + PITCH_PX) % PITCH_PX;
      const l3Phase = ((l3Y % PITCH_PX) + PITCH_PX) % PITCH_PX;
      root.style.backgroundSize     = `auto, 100% ${PITCH_PX}px, 100% ${PITCH_PX}px`;
      root.style.backgroundPosition = `0 0, 0 ${l2Phase}px, 0 ${l3Phase}px`;
    };
    align();
    window.addEventListener("resize", align);
    return () => window.removeEventListener("resize", align);
  }, [task, svgH]);

  return (
    <div ref={rootRef} className="wl-alpha-screen">
      <div
        className="wl-alpha-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, auto)`,
          gap: `0 ${pairLetterGap(cols) * 3}px`,
        }}
      >
        {pairs.map((pair, i) => (
          <div
            key={pair.upper + i}
            ref={i === 0 ? firstRef : undefined}
            className="wl-alpha-pair"
            style={{ gap: pairLetterGap(cols) }}
          >
            <HandwrittenLetter letter={pair.upper} size={size} bare />
            <HandwrittenLetter letter={pair.lower} size={size} bare />
          </div>
        ))}
      </div>
    </div>
  );
}
