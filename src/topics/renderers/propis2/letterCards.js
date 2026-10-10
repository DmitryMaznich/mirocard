// The letter cards of «Узнай букву» and «Строчная и заглавная» (copied into «Прописи 2» from «Прописи», 2026-10-10) draw a letter
// with the SAME views (propis/letters/*) — only the ink is «Прописи 2»'s: every letter as the constructor writes it alone (laid out by
// the engine: ш and ы are composed of parts there), moved into the card's own space (glyphs.js: viewBox 100 x 150, baseline 88, x-height 62..88).
import { layoutWideLinesIntoRows, WIDE_ZONE_UNITS } from "../propis/wordEngine.js";
import { samplePath } from "../propis/pathGeometry.js";
import { NATIVE_L3, TEXT_ROW_THIN_OFFSET } from "../propis/propisRuling.js";
import { LETTER_DATA } from "../propis/letters/letterData.js";

const ROW_BASELINE = NATIVE_L3 - TEXT_ROW_THIN_OFFSET; // wordEngine WIDE_BASELINE_Y
const CARD_BASELINE = 88;
const CARD_X_HEIGHT = 26;
const K = CARD_X_HEIGHT / WIDE_ZONE_UNITS;

const mapPoints = (d, fn) => {
  const nums = String(d).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  let i = 0;
  return String(d).replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, () => {
    const k = i;
    i += 1;
    if (k % 2 === 1) return "";
    const [x, y] = fn(Number(nums[k]), Number(nums[k + 1]));
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  }).replace(/ +/g, " ");
};

// The letters these modes show: both cases of every letter that has a capital, the lowercase of ъ ь ы.
export const CARD_LETTERS = LETTER_DATA.flatMap((l) => (l.params.has_upper ? [l.params.printed_upper, l.params.printed_lower] : [l.params.printed_lower]));

const cache = new WeakMap();
// glyphMap (pageTask.js buildGlyphMap) -> { letter: { strokes: [d], width, minX } } as glyphs.js buildGlyphMap gives for the old cards
export function cardGlyphs(glyphMap) {
  if (!glyphMap) return {};
  if (cache.has(glyphMap)) return cache.get(glyphMap);
  const out = {};
  for (const ch of CARD_LETTERS) {
    if (!glyphMap.get(ch)) continue;
    const placed = layoutWideLinesIntoRows([`${ch}#1`], glyphMap, undefined, false, 1).placed[0];
    const ink = placed?.segments?.flatMap((seg) => seg.strokes ?? []) ?? [];
    if (!ink.length) continue;
    const strokes = ink.map((s) => mapPoints(s.d, (x, y) => [x * K, CARD_BASELINE + (y - ROW_BASELINE) * K]));
    const xs = strokes.flatMap((d) => samplePath(d, 16).map((q) => q[0]));
    const minX = Math.min(...xs);
    out[ch] = { strokes, width: Math.max(...xs) - minX, minX };
  }
  cache.set(glyphMap, out);
  return out;
}
