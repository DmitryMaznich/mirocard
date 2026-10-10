// «Прописи 2» glyph facts that differ from the shared tools/propis/wide.json (which the frozen v1 copybook also builds from).
//
// The exit rise that joins a letter to the next one is not part of every letter. For о б ю э ф в it is a canonical
// connector appended to the letter (the very same curve on all of them), so the letter written ALONE has none and with it only when a
// letter follows. For г п т и н к л м, and also с х ж (confirmed: it is part of the letter even though the curve looks the same)... the final hook is the letter's own stroke and stays. (Found by looking for that exact
// connector as the last curve of every captured letter; see docs/propis2.md.)
//   tailSplit  — index of the stroke whose last curve is the connector
//   tailStroke — index of a stroke that IS the connector (a stroke of its own in the capture)
//   tailLift   — the connector gets the "end above the dashed line" lift the letter's exit used to get
//   tailContinuous — the pen does not lift between the letter and its connector
//   joinFrom   — {stroke}: the letter ends on its own side (У: the lower hook curls up-left and is part of the letter, never cut); the connector to the next
//                letter is a stroke of its own from the LOWEST point of that stroke: the curve of `joinLike` (о), its end on the grid point where the exit of
//                `joinEndLike` (Ч: the same start as У) arrives (the mid dashed line x the next slant line, the same for every connector)
import DIGIT_GLYPHS from "./digitGlyphs.json";

export const P2_GLYPH_OVERRIDES = {
  "о": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "ю": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "ф": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "в": { tailSplit: 0, tailLift: true, tailContinuous: true },
  "ь": { tailSplit: 0, tailSplitCount: 5, tailLift: true, tailContinuous: true, joinAtStart: true, joinStraight: true },
  // ъ: the connector of the previous letter goes up to the START of ъ, its flag, not to the stem
  "ъ": { tailSplit: 0, tailLift: true, tailContinuous: true, joinAtStart: true, exitNudge: 24 },
  // repeatCells (the step of the copies when a sample is multiplied across the row): wide.json's step for б р х ж is smaller than the
  // letter itself, the copies ran into each other (gap -0.15..-0.28 of a cell); one cell more gives them the gap of the other letters (~0.7)
  "б": { tailStroke: 1, tailLift: true, repeatCells: 4 },
  "р": { repeatCells: 4 },
  "х": { repeatCells: 4 },
  "ж": { repeatCells: 5 },
  "э": { tailStroke: 2, tailLift: true },
  // capital У: whole, with its hook; the connector leaves its lowest point like о's and arrives where Ч's exit does (У is «как Ч»)
  "У": { joinFrom: { stroke: 0 }, joinLikeLabel: "о", joinEndLikeLabel: "Ч" },
};

// Digits and signs (+ - = < >) captured on 2026-10-06 (tools/propis/captures/digits_signs_raw_2026-10-06.json). Their labels carry a «№»
// (№5, №+): the wide.json already has ELEMENTS called 5 6 7 8, and «+» is the engine's chain operator, so a plain character cannot name them.
// The text field shows and takes ordinary digits (fieldText.js turns them into these labels and back). Never joined to a neighbour.
// Capitals Ё and Й were never captured (2026-10-10, needed by «Строчная и заглавная» / «Узнай букву»): they are made from Е and И with
// the marks of ё and й (its dot strokes / its breve) set above the capital: centred over the top of the capital, as far above its top
// as they are above the lowercase letter, a quarter larger. Built only when the capture lacks them.
const MARKED_CAPITALS = [
  { label: "Ё", base: "Е", marksFrom: "ё", lower: "е" },
  { label: "Й", base: "И", marksFrom: "й", lower: "и" },
];
const MARK_SCALE = 1.25;
const SLANT = 0.4663; // tan of the grid's slant (23 units of lean per 50 of height)
// the coordinate pairs of the paths (end and control points): bounds good enough to place marks; samplePath reads only M and C, and
// these glyphs also have L and Q
const pointsOf = (strokes) => strokes.flatMap((s) => { const n = (String(s.d).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number); return n.flatMap((v, i) => (i % 2 ? [] : [[v, n[i + 1]]])); });
// every coordinate pair of an absolute M/C/L path, mapped
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
export function markedCapital(baseGlyph, markedLower, plainLower, label, markScale = MARK_SCALE) {
  if (!baseGlyph || !markedLower || !plainLower) return null;
  const n = plainLower.strokes.length;
  const marks = markedLower.strokes.slice(n);
  if (!marks.length) return null;
  const mp = pointsOf(marks);
  const mx = (Math.min(...mp.map((q) => q[0])) + Math.max(...mp.map((q) => q[0]))) / 2;
  const my = (Math.min(...mp.map((q) => q[1])) + Math.max(...mp.map((q) => q[1]))) / 2;
  const lowerTop = Math.min(...pointsOf(plainLower.strokes).map((q) => q[1]));
  const cp = pointsOf(baseGlyph.strokes);
  const capTop = Math.min(...cp.map((q) => q[1]));
  const cy = capTop - (lowerTop - my) * markScale;
  // Where the marks stand: centred BETWEEN the two slanted lines that bound the top of the letter, taken at the height of the marks.
  // A point (x, y) lies on the slant line that is at x + SLANT * (y - cy) at height cy. Й: the two stems of И (the line of the left stem
  // through the foot of the hook, and of the right stem through its top). Ё: the left and the right edge of Е's upper loop (its «hat»,
  // everything above the waist). Without the slant the marks looked shifted left (2026-10-10).
  const onLine = (q) => q[0] + SLANT * (q[1] - cy);
  let left, right;
  if (label === "Й") {
    const topRight = cp.filter((q) => q[1] < capTop + 6).reduce((a, q) => (q[0] > a[0] ? q : a));
    const apexLeft = cp.filter((q) => q[1] < capTop + 14 && q[0] < topRight[0] - 12).reduce((a, q) => (q[1] > a[1] ? q : a)); // the lowest top-left point = where the hook turns into the left stem
    left = onLine(apexLeft); right = onLine(topRight);
  } else {
    const hat = cp.filter((q) => q[1] < capTop + 40);
    left = Math.min(...hat.map(onLine)); right = Math.max(...hat.map(onLine));
  }
  const cxLean = (left + right) / 2;
  const moved = marks.map((s) => ({ ...s, d: mapPoints(s.d, (x, y) => [cxLean + (x - mx) * markScale, cy + (y - my) * markScale]) }));
  const dots = markedLower.noDotStrokes ? { noDotStrokes: moved.map((_, i) => baseGlyph.strokes.length + i) } : {};
  return { ...baseGlyph, label, aliases: undefined, strokes: [...baseGlyph.strokes, ...moved], sourceLabel: `${label}: ${baseGlyph.label} + отметки ${markedLower.label}`, ...dots };
}
const withMarkedCapitals = (glyphs) => {
  const byLabel = new Map(glyphs.map((g) => [g.label, g]));
  const made = MARKED_CAPITALS.filter((m) => !byLabel.has(m.label)).map((m) => markedCapital(byLabel.get(m.base), byLabel.get(m.marksFrom), byLabel.get(m.lower), m.label, m.scale)).filter(Boolean);
  return made.length ? [...glyphs, ...made] : glyphs;
};

export const withGlyphOverrides = (glyphs) => {
  const patched = [...withMarkedCapitals((glyphs ?? []).map((g) => (P2_GLYPH_OVERRIDES[g.label] ? { ...g, ...P2_GLYPH_OVERRIDES[g.label] } : g))), ...(glyphs?.length ? DIGIT_GLYPHS : [])];
  // `joinLikeLabel` -> the (already patched) glyph whose connector is borrowed
  return patched.map((g) => (g.joinLikeLabel ? { ...g, joinLike: patched.find((x) => x.label === g.joinLikeLabel), joinEndLike: patched.find((x) => x.label === g.joinEndLikeLabel) } : g));
};
