// Propis 4-line system, ratio 2:1:2 (from lined_paper_A4_landscape_standard.pdf):
//
//  y=10   L1  ───  нижняя линия строки выше
//         [wide gap = 2k = 52]
//  y=62   L2  ───  верхняя граница строки написания
//         [NARROW writing zone = k = 26]
//  y=88   L3  ───  BASELINE
//         [wide gap = 2k = 52]
//  y=140  L4  ───  верхняя линия строки ниже
//
// Letter paths extracted from ClassRoomCursive.ttf via fontTools.
// vbW=100 default; vbH=150 base; vbMinY for accents (Й, Ё) overflow.

import { LETTER_PATHS } from './letterPaths.js';

const L1 = 10;
const L2 = 62;
const L3 = 88;
const L4 = 140;

const C_BG   = "#fefef6";
const C_LINE_OUTER = "#b8d8e8";   // L1, L4 — thin outer lines
const C_LINE_TOP   = "#6ab4cc";   // L2 — top of writing zone
const C_LINE_BASE  = "#2a82a0";   // L3 — baseline (most prominent)
const C_FONT       = "#1d4ed8";

export default function HandwrittenLetter({ letter, size = 100, className = "" }) {
  const data = LETTER_PATHS[letter];
  if (!data) return null;

  const { path, vbW, vbH, vbMinY = 0 } = data;
  const w = size;
  const h = Math.round(size * vbH / vbW);

  return (
    <svg
      viewBox={`0 ${vbMinY} ${vbW} ${vbH}`}
      width={w}
      height={h}
      className={className}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <rect x={0} y={vbMinY} width={vbW} height={vbH} fill={C_BG} />

      <line x1={0} y1={L1} x2={vbW} y2={L1} stroke={C_LINE_OUTER} strokeWidth={0.8} />
      <line x1={0} y1={L2} x2={vbW} y2={L2} stroke={C_LINE_TOP}   strokeWidth={1.0} />
      <line x1={0} y1={L3} x2={vbW} y2={L3} stroke={C_LINE_BASE}  strokeWidth={1.5} />
      <line x1={0} y1={L4} x2={vbW} y2={L4} stroke={C_LINE_OUTER} strokeWidth={0.8} />

      <path d={path} fill={C_FONT} fillRule="nonzero" />
    </svg>
  );
}
