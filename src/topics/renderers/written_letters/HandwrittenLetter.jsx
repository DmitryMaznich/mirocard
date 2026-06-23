// 4-line propis coordinate system:
//  y= 6  L1  ──── верхняя зона (заглавные / асцендеры)
//  y=44  L2  ──── рабочая строка top (x-height)
//  y=82  L3  ──── baseline
//  y=112 L4  ──── нижняя зона (р, у, д, з, ф, ц, щ)
//
// Letter paths extracted from ClassRoomCursive.ttf via fontTools.
// vbW is 90 for most letters; wider for Ж, Ш, Щ, М etc.
// vbH is 120 normally, 132 for letters with deep descenders.

import { LETTER_PATHS } from './letterPaths.js';

const L1 = 6;
const L2 = 44;
const L3 = 82;
const L4 = 112;

const C_BG    = "#fefef6";
const C_ZONE  = "rgba(205,232,245,0.45)";
const C_OUTER = "#c5e2f2";
const C_L2    = "#9ecde8";
const C_L3    = "#5bafd0";
const C_FONT  = "#1d4ed8";

export default function HandwrittenLetter({ letter, size = 100, className = "" }) {
  const data = LETTER_PATHS[letter];
  if (!data) return null;

  const { path, vbW, vbH } = data;
  const w = size;
  const h = Math.round(size * vbH / vbW);

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      width={w}
      height={h}
      className={className}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <rect x={0} y={0} width={vbW} height={vbH} fill={C_BG} />

      {/* upper zone tint */}
      <rect x={0} y={L1} width={vbW} height={L2 - L1} fill={C_ZONE} />

      {/* lower zone tint */}
      <rect x={0} y={L3} width={vbW} height={vbH - L3} fill={C_ZONE} />

      <line x1={0} y1={L1} x2={vbW} y2={L1} stroke={C_OUTER} strokeWidth={1.0} />
      <line x1={0} y1={L2} x2={vbW} y2={L2} stroke={C_L2}    strokeWidth={1.4} />
      <line x1={0} y1={L3} x2={vbW} y2={L3} stroke={C_L3}    strokeWidth={1.8} />
      <line x1={0} y1={L4} x2={vbW} y2={L4} stroke={C_OUTER} strokeWidth={1.0} />

      <path d={path} fill={C_FONT} fillRule="nonzero" />
    </svg>
  );
}
