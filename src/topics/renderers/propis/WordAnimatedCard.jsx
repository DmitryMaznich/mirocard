import { GUIDE_LINES, NATIVE_L3 } from "./propisRuling.js";
import AnimatedStrokes from "./AnimatedStrokes.jsx";

const GUIDE_THIN_W = 0.4;
const GUIDE_BOLD_W = 0.9;
const GUIDE_COLOR = "#6fa3e0";

export default function WordAnimatedCard({ trajectory }) {
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
      <AnimatedStrokes trajectory={trajectory} />
    </svg>
  );
}
