// How far a glyph reaches above and below the writing band on the NARROW row (the engine's own layout, so the
// numbers are the ones the page shows). «Прописи 2» uses it to keep the wide ruling to the letters that stay
// inside the row, as in the methodology sheets (no capitals, no б в д з р у ф ц щ, no ! ?).
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";
import { NATIVE_L3, TEXT_ROW_PITCH, TEXT_ROW_THIN_OFFSET } from "../propis/propisRuling.js";

export const NARROW_SCALE = 0.5;
export const ROW_BASE = NATIVE_L3 - TEXT_ROW_THIN_OFFSET; // baseline of the narrow band (row-local 64)
export const ROW_TOP = ROW_BASE - (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET) * NARROW_SCALE; // thin top line (40)
const TOLERANCE = 4; // a loop or a dot may stand a few units outside (г, т, ё, й, ч…); a whole ascender/tail may not

export function bboxOf(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of strokes) {
    const nums = d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
      minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

// Strokes of one glyph laid out alone on the narrow ruling ([] if the engine cannot lay it out).
export function narrowStrokes(glyphMap, label) {
  try {
    const { placed } = layoutWideLinesIntoRows([label], glyphMap, undefined, false, NARROW_SCALE);
    return (placed[0]?.segments?.[0]?.trajectory?.strokes ?? []).map((st) => st.d).filter(Boolean);
  } catch {
    return [];
  }
}

export const staysInRow = (box) => Boolean(box) && box.minY >= ROW_TOP - TOLERANCE && box.maxY <= ROW_BASE + TOLERANCE;

// Labels of the letters and marks of a glyph map that must NOT be used on the wide ruling (they leave the row).
// Elements are not restricted. Memoised per glyph map.
const cache = new WeakMap();
export function outsideRowLabels(glyphMap) {
  if (cache.has(glyphMap)) return cache.get(glyphMap);
  const out = new Set();
  for (const [label, g] of glyphMap) {
    // letters (some, like р л м я, are stored with kind "element": a letter is any one-character Cyrillic label) and marks
    const isLetter = /^[А-Яа-яЁё]$/.test(label);
    if (!isLetter && g.kind !== "letter" && g.kind !== "punct" && g.kind !== "digit") continue; // digits are as tall as capitals
    // marks: the full stop and the comma stand on the baseline (the comma's tail dips a little, as in a notebook);
    // ! and ? are as tall as a capital and do not belong on the wide ruling
    if (g.kind === "punct") { if (!".,".includes(label)) out.add(label); continue; }
    if (!staysInRow(bboxOf(narrowStrokes(glyphMap, label)))) out.add(label);
  }
  cache.set(glyphMap, out);
  return out;
}
