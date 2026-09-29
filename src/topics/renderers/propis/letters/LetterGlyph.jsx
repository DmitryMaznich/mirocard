// One handwritten letter for the recognition modes ("Узнай букву", "Строчная и заглавная",
// "Мои буквы") — merged in from the former standalone "Письменные буквы" (written_letters)
// topic, 2026-09-29.
//
// That topic drew its letters as filled outlines extracted from a cursive FONT; this draws
// the same captured pen trajectories every other propis mode uses (topicRecord.cards,
// Жукова's "Пропись 1"), so the app shows one single model of each letter everywhere.
//
// Both systems share one native coordinate space (viewBox 0 0 100 150, x-height 62..88,
// baseline 88 — see propisRuling.js's NATIVE_* lines), so the views' ruling math carries
// over untouched. The only difference: captured letters start at x≈0 and are narrower than
// the font's fixed 100-unit advance, so each glyph is centred horizontally in its box.
//
// Propis 4-line system, ratio 2:1:2:
//  y=10   L1  ───  нижняя линия строки выше
//  y=62   L2  ───  верхняя граница строки написания
//  y=88   L3  ───  BASELINE
//  y=140  L4  ───  верхняя линия строки ниже

import { useMemo } from "react";
import {
  GLYPH_VBW, GLYPH_VBH, GLYPH_STROKE_W, C_BG, C_LINE_OUTER, C_LINE_TOP, C_LINE_BASE, C_INK,
  GlyphContext, buildGlyphMap, useGlyphs,
} from "./glyphs.js";

const L1 = 10;
const L2 = 62;
const L3 = 88;
const L4 = 140;

export function LetterGlyphProvider({ cards, children }) {
  const glyphs = useMemo(() => buildGlyphMap(cards), [cards]);
  return <GlyphContext.Provider value={glyphs}>{children}</GlyphContext.Provider>;
}

// Bare <path> elements for one letter, positioned by the caller (SortCaseView packs several
// into one shared SVG). `x` is where the glyph's own left edge lands.
export function GlyphStrokes({ glyph, x = 0, y = 0 }) {
  if (!glyph) return null;
  return (
    <g transform={`translate(${x - glyph.minX}, ${y})`}>
      {glyph.strokes.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={C_INK}
          strokeWidth={GLYPH_STROKE_W}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

// `size` is the box width in px for the canonical 100-unit box — the height is always
// size * 1.5, whatever the letter, so rows of letters stay on the same ruling.
export default function LetterGlyph({ letter, size = 100, className = "", bare = false }) {
  const glyphs = useGlyphs();
  const glyph = glyphs[letter];
  if (!glyph) return null;

  const w = size;
  const h = Math.round(size * GLYPH_VBH / GLYPH_VBW);

  return (
    <svg
      viewBox={`0 0 ${GLYPH_VBW} ${GLYPH_VBH}`}
      width={w}
      height={h}
      className={className}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      {!bare && <rect x={0} y={0} width={GLYPH_VBW} height={GLYPH_VBH} fill={C_BG} />}
      {!bare && <line x1={0} y1={L1} x2={GLYPH_VBW} y2={L1} stroke={C_LINE_OUTER} strokeWidth={0.8} />}
      {!bare && <line x1={0} y1={L2} x2={GLYPH_VBW} y2={L2} stroke={C_LINE_TOP}   strokeWidth={1.0} />}
      {!bare && <line x1={0} y1={L3} x2={GLYPH_VBW} y2={L3} stroke={C_LINE_BASE}  strokeWidth={1.5} />}
      {!bare && <line x1={0} y1={L4} x2={GLYPH_VBW} y2={L4} stroke={C_LINE_OUTER} strokeWidth={0.8} />}

      <GlyphStrokes glyph={glyph} x={(GLYPH_VBW - glyph.width) / 2} />
    </svg>
  );
}
