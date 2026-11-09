// Glyph data for LetterGlyph.jsx: which captured letter card draws which letter, and the
// shared ruling colours. Kept out of the component file so it only exports components.

import { createContext, useContext } from "react";
import { samplePath } from "../pathGeometry.js";

export const GLYPH_VBW = 100;
export const GLYPH_VBH = 150;

export const C_BG         = "#fefef6";
export const C_LINE_OUTER = "#b8d8e8";   // L1, L4 — thin outer lines
export const C_LINE_TOP   = "#6ab4cc";   // L2 — top of writing zone
export const C_LINE_BASE  = "#2a82a0";   // L3 — baseline (most prominent)
export const C_INK        = "#1d4ed8";   // same ink as propisRuling.js's INK_COLOR

// Native-unit pen width. propisRuling.js's STROKE_W (2) is tuned for letters rendered at
// tetrad-row scale; these cards show a single letter much smaller (a 63-120px wide box), where
// 2 units reads as a hairline next to the old filled font glyphs. Tuned by screenshot.
export const GLYPH_STROKE_W = 3.4;

const cache = new WeakMap();

// label -> { strokes: [d...], width, minX } for every standalone letter card. "о"'s joint
// variants (variantOf) are wordEngine lookup data, never a letter of their own.
export function buildGlyphMap(cards) {
  if (!Array.isArray(cards)) return {};
  if (cache.has(cards)) return cache.get(cards);
  const map = {};
  for (const card of cards) {
    if (card?.type !== "letter" || card.variantOf || !Array.isArray(card.strokes)) continue;
    const strokes = card.strokes.map((s) => s.d).filter(Boolean);
    if (!strokes.length) continue;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const d of strokes) {
      for (const [x] of samplePath(d, 12)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    map[card.label] = { strokes, width: maxX - minX, minX };
  }
  cache.set(cards, map);
  return map;
}

export const GlyphContext = createContext({});

export function useGlyphs() {
  return useContext(GlyphContext);
}
