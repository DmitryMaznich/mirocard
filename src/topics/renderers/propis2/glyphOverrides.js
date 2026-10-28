// `propis2` glyph facts that differ from the shared tools/propis/wide.json (which the archived `propis` («Прописи старые») also builds from).
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
  // steepExit: the connector runs a little along the bottom and then rises STRAIGHT at the angle of а's exit, into the same end point
  // (it was one flat curve from the bottom of the oval, the joins after о lay much flatter than after а и; 2026-10-12)
  "о": { tailSplit: 0, steepExit: true, tailLift: true, tailContinuous: true },
  "ю": { tailSplit: 0, steepExit: true, tailLift: true, tailContinuous: true },
  "ф": { tailSplit: 0, steepExit: true, tailLift: true, tailContinuous: true },
  "в": { tailSplit: 0, steepExit: true, tailLift: true, tailContinuous: true },
  // е: the curl at the bottom opened a little, still down to the baseline; the exit and the end point stay (a sharp corner / a rise from the lowest
  // point were tried and refused, 2026-10-27). `noLiftExit` (2026-10-28, owner): the exit arrives on the middle dashed line EXACTLY, not 2.2 units above it
  // as the exits of the other letters do (wordEngine.js lifts every exit above the line, as in the workbook; the captured exit of е ends on the line)
  "е": { softHook: 0.35, noLiftExit: true },
  // the same for ё (its path is е1 + two dots): its exit ends on the middle line too
  "ё": { noLiftExit: true },
  // т п р к: the connector of the letter before ends ON the glyph's first slanted stem, so the pen goes from there straight up the stem (2026-10-27;
  // measured on the real grid: the arch rise of п р ran 1.1 right of the stem, т 1.6, к 0.5, н ш щ й ю were already on it)
  "т": { touchFirstLine: true },
  "п": { touchFirstLine: true },
  "к": { touchFirstLine: true },
  // ь = ъ without the flag (2026-10-28, owner): the same lower part from the reduced в, two variants, see `bellyFrom` below; the join to the start (the top of the stem) stays straight
  // ы = ы1 (ь with the knot at the top of the oval and the connector from it) + ы2 (see `yerLoop`)
  "ы": { compose: ["ы1", "ы2"] },
  // ы2, the stick of ы: the connector of ы1 ends at the TOP of its stem (the start), arriving rising up along the way of the stem (`joinReverse`: the stem opens downwards, the connector comes from below) — a narrow wedge with the stem
  "ы2": { joinAtStart: true, joinReverse: true, joinArrive: 1 },
  "ь": { bellyFrom: { label: "в", kv: 0.5, ku: 0.6 }, tailSplit: 0, tailSplitCount: 2, tailNoAlign: true, steepExit: true, tailLift: true, tailContinuous: true, joinAtStart: true, joinStraight: true, exitNudge: 24 },
  // ъ: the connector of the previous letter goes up to the START of ъ, its flag, not to the stem
  "ъ": { bellyFrom: { label: "в", kv: 0.5, ku: 0.6 }, tailSplit: 0, tailSplitCount: 2, tailNoAlign: true, steepExit: true, tailLift: true, tailContinuous: true, joinAtStart: true, exitNudge: 24, stemOnLine: true, startDrop: 7, snapNotRight: 0.2, joinArrive: 1 },
  // repeatCells (the step of the copies when a sample is multiplied across the row): wide.json's step for б р х ж is smaller than the
  // letter itself, the copies ran into each other (gap -0.15..-0.28 of a cell); one cell more gives them the gap of the other letters (~0.7)
  "б": { tailStroke: 1, tailLift: true, repeatCells: 4 },
  "р": { repeatCells: 4, touchFirstLine: true },
  "у": { straightTail: 32 },
  "д": { straightTail: 31 },
  "з": { straightTail: 57 },
  "х": { repeatCells: 4 },
  "ж": { repeatCells: 5 },
  "э": { tailStroke: 2, tailLift: true },
  // capital У: whole, with its hook; the connector leaves its lowest point like о's and arrives where Ч's exit does (У is «как Ч»)
  "У": { joinFrom: { stroke: 0 }, joinLikeLabel: "о", joinEndLikeLabel: "Ч" },
  // startLift (capture units): the letter starts that much higher, on its own opening line. г: it starts exactly where the exit of
  // the letter before it ends when nothing stretches that exit: 2.2 engine units above the dashed middle line (wordEngine's exit lift),
  // = 2.2 / WIDE_SCALE (48/52) capture units above the capture's mid line (y 36). Two letters written apart then glue into one line
  // (а + г = «аг»), no connector is pulled up to г. (A 1 mm lift, 13, tried first on 2026-10-12, made every previous exit stretch.)
  // г is an alias of the element «г1» in wide.json: an override keyed by an alias makes the letter a glyph of its own, the element
  // stays as captured. joinAtStart: a previous exit that ends a little lower (ш) is still brought to that start (no gap)
  "г": { startLift: 2.2 * 52 / 48, joinAtStart: true },
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

// `startLift`: the first stroke opens with a straight line (M x y L ...): its start point moves up that line by `lift` units of height
export function liftStart(glyph, lift) {
  const m = String(glyph.strokes?.[0]?.d ?? "").match(/^M\s*(-?[\d.]+)\s+(-?[\d.]+)\s*L\s*(-?[\d.]+)\s+(-?[\d.]+)/);
  if (!m || !(lift > 0)) return glyph;
  const [x0, y0, x1, y1] = m.slice(1).map(Number);
  if (y0 - y1 <= lift) return glyph;
  const t = lift / (y0 - y1);
  const d = `M ${(x0 + (x1 - x0) * t).toFixed(2)} ${(y0 - lift).toFixed(2)} ${glyph.strokes[0].d.slice(glyph.strokes[0].d.indexOf("L"))}`;
  return { ...glyph, anchorY: y0, strokes: [{ ...glyph.strokes[0], d }, ...glyph.strokes.slice(1)] };
}
// `startDrop`: the opposite of `startLift`: the opening straight line (M x y L ...) is continued BACKWARDS, so the letter starts `drop` units of
// height lower, on the same line (ъ: its flag starts a quarter of the row below the top line, not right under it)
export function dropStart(glyph, drop) {
  const m = String(glyph.strokes?.[0]?.d ?? "").match(/^M\s*(-?[\d.]+)\s+(-?[\d.]+)\s*L\s*(-?[\d.]+)\s+(-?[\d.]+)/);
  if (!m || !(drop > 0)) return glyph;
  const [x0, y0, x1, y1] = m.slice(1).map(Number);
  if (!(y0 - y1 > 0.5)) return glyph;
  const t = drop / (y0 - y1);
  const d = `M ${(x0 - (x1 - x0) * t).toFixed(2)} ${(y0 + drop).toFixed(2)} ${glyph.strokes[0].d.slice(glyph.strokes[0].d.indexOf("L"))}`;
  return { ...glyph, strokes: [{ ...glyph.strokes[0], d }, ...glyph.strokes.slice(1)] };
}
// `bellyFrom` { label, kv, ku } (ъ): the whole lower part of the letter — from the foot of the stem on — is the lower part of the letter `label` (в), reduced
// to half the height of the row. в has the same stem as ъ (the same top, the same slanted line), and its stem flows into the oval at (152.2, 36) along its
// own heading, so the stem runs into the belly without a corner; the oval then goes round once and comes back to that point ON the stem line, where the one turn
// ends (a letter nothing follows); the connector is the second pass over the bottom and the exit — the last two cubics of the path (`tailSplitCount: 2`),
// drawn only when a letter follows. The reduction is made across the slant: u = x + tan25°·y stays, so the stem line stays a line and the point where the
// oval meets it stays on it (kv: height, ku: width, about the stem line and the baseline). The exit ends where the captured exit of ъ ended, so the letters
// after ъ keep their places. Indices are those of the captured paths: ъ 0–14 the flag, 15 the stem, 57 the exit; в 18 the end of the stem, 19–22 the oval, 23 its
// second pass over the bottom (2026-10-28, owner: «взять уменьшенное нижнее пузо от в»).
const parseCmds = (d) => {
  const toks = String(d).match(/[MLQC]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const cmds = [];
  for (const t of toks) { if (/[MLQC]/i.test(t)) cmds.push({ c: t, n: [] }); else cmds[cmds.length - 1]?.n.push(Number(t)); }
  return cmds;
};
export function yerBelly(glyph, source, { kv = 0.5, ku = 1 } = {}) {
  const yc = parseCmds(glyph.strokes?.[0]?.d), vc = parseCmds(source?.strokes?.[0]?.d);
  // the stem is the first long straight segment (ъ: command 15 after the flag, ь: command 1, the letter starts at the top of the stem); 43 commands from it to the end
  let stemAt = -1;
  for (let i = 1; i < yc.length && stemAt < 0; i += 1) if (yc[i].c === "L" && Math.hypot(yc[i].n[0] - yc[i - 1].n.slice(-2)[0], yc[i].n[1] - yc[i - 1].n.slice(-2)[1]) > 25) stemAt = i;
  if (stemAt < 1 || yc.length - stemAt !== 43 || vc.length !== 25 || yc[yc.length - 1].c !== "L") return glyph;
  const top = yc[stemAt - 1].n.slice(-2); // the top of the stem
  const U = top[0] + SLANT * top[1]; // the stem line: x + tan·y = U
  const base = Math.max(...vc.slice(18).flatMap((c) => c.n.filter((_, i) => i % 2))); // the bottom of the oval, the baseline of the capture
  const map = (x, y) => { const v = base - kv * (base - y), u = U + ku * (x + SLANT * y - U); return [u - SLANT * v, v]; };
  const mapN = (n) => n.flatMap((v, i) => (i % 2 ? [] : map(v, n[i + 1])));
  const f = (v) => v.toFixed(2);
  const show = (c, n) => `${c} ${n.map(f).join(" ")}`;
  const [sx, sy] = map(...vc[18].n.slice(-2)); // the point of the stem where the oval begins and ends
  const head = yc.slice(0, stemAt).map(({ c, n }) => show(c, n));
  const oval = [19, 20, 21, 22].map((i) => show("C", mapN(vc[i].n)));
  const again = mapN(vc[23].n); // the second pass over the bottom, the same numbers as the first
  const [bx, by] = again.slice(-2);
  // the end of the exit: в's, reduced the same way and carried up its slanted line to the height of ъ's captured exit end (the exit must end above the middle line),
  // so that the exit rises OUTSIDE the oval and not through it
  const [exv, eyv] = vc[24].n.slice(-2), ey = yc[yc.length - 1].n[1];
  const ex = U + ku * (exv + SLANT * eyv - U) - SLANT * ey;
  const ch = Math.hypot(ex - bx, ey - by);
  const exit = show("C", [bx + ch * 0.35, by, ex - ch * 0.35, ey + ch * 0.3, ex, ey]);
  const d = [...head, show("L", [sx, sy]), ...oval, show("C", again), exit].join(" ");
  return steepenExit({ ...glyph, strokes: [{ ...glyph.strokes[0], d }, ...glyph.strokes.slice(1)] });
}
// The exit of а in the capture: its last straight piece, (135.46, 56.28) -> (153.61, 36) — the angle every connector should rise at.
const EXIT_RUN = 153.61 - 135.46;
const EXIT_RISE = 56.28 - 36;
// `steepExit`: the LAST cubic of the stroke (`tailSplit`, the connector from the bottom of the letter to the exit point E) is redrawn:
// it leaves the bottom of the letter rising a little (EXIT_LEAVE_DEG; the captured one left flat along the bottom) and arrives at E
// along а's exit, so it meets the mid dashed line at the angle of и г ш. One cubic, end point unchanged. (A first try, a run along
// the bottom and then a straight rise, looked broken; 2026-10-12.)
const EXIT_LEAVE_DEG = 15;
export function steepenExit(glyph) {
  const si = glyph.tailSplit ?? 0;
  const d = String(glyph.strokes?.[si]?.d ?? "");
  const at = d.lastIndexOf("C");
  if (at < 0) return glyph;
  const before = (d.slice(0, at).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  const [x0, y0] = before.slice(-2);
  const [ex, ey] = (d.slice(at).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number).slice(-2);
  const len = Math.hypot(EXIT_RUN, EXIT_RISE);
  const ux = EXIT_RUN / len, uy = -EXIT_RISE / len;
  const th = (EXIT_LEAVE_DEG * Math.PI) / 180;
  const chord = Math.hypot(ex - x0, ey - y0);
  const k1 = chord * 0.35, k2 = chord * 0.35;
  const f = (v) => v.toFixed(2);
  const c = `C ${f(x0 + Math.cos(th) * k1)} ${f(y0 - Math.sin(th) * k1)} ${f(ex - ux * k2)} ${f(ey - uy * k2)} ${f(ex)} ${f(ey)}`;
  const strokes = glyph.strokes.map((st, i) => (i === si ? { ...st, d: `${d.slice(0, at)}${c}` } : st));
  return { ...glyph, strokes };
}
// `straightTail` {from}: the descender's tail (у д з) leaves the loop at the `from`-th coordinate pair of the LAST stroke and runs
// to the exit point in one cubic, arriving along а's exit (the tail ran flat from deep under the line; 2026-10-12)
export function straightenTail(glyph, from) {
  const si = glyph.strokes.length - 1;
  const d = String(glyph.strokes[si].d);
  const re = /-?\d*\.?\d+(?:e-?\d+)?/gi;
  const all = [...d.matchAll(re)];
  const ix = all[from * 2], iy = all[from * 2 + 1];
  const [x0, y0] = [Number(ix[0]), Number(iy[0])];
  const [ex, ey] = all.slice(-2).map((m) => Number(m[0]));
  const head = d.slice(0, iy.index + iy[0].length);
  const f = (v) => v.toFixed(2);
  // leaves the loop along the loop's own direction there (from the previous pair), arrives along а's exit
  const [px, py] = [Number(all[from * 2 - 2][0]), Number(all[from * 2 - 1][0])];
  const chord = Math.hypot(ex - x0, ey - y0);
  const il = Math.hypot(x0 - px, y0 - py) || 1;
  const k = chord * 0.3;
  const len = Math.hypot(EXIT_RUN, EXIT_RISE);
  const tail = `C ${f(x0 + ((x0 - px) / il) * k)} ${f(y0 + ((y0 - py) / il) * k)} ${f(ex - (EXIT_RUN / len) * k)} ${f(ey + (EXIT_RISE / len) * k)} ${f(ex)} ${f(ey)}`;
  return { ...glyph, strokes: glyph.strokes.map((st, i) => (i === si ? { ...st, d: `${head} ${tail}` } : st)) };
}
// `softHook` k (0..1): the small curl at the bottom of е (the last cubic of the stroke, from the foot of the left stem round the lowest point
// into the straight exit) is opened a little: its control points move k of the way toward the chord, then are pushed down again until the
// curl reaches the same depth (the baseline). The end point, the exit and the depth stay, the curl is only less crooked (2026-10-27).
export function softenHook(glyph, k) {
  const si = 0;
  const d = String(glyph.strokes?.[si]?.d ?? "");
  const at = d.lastIndexOf("C");
  if (at < 0 || !(k > 0)) return glyph;
  const num = (str) => (str.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  const before = num(d.slice(0, at));
  const cub = num(d.slice(at)).slice(0, 6);
  if (before.length < 2 || cub.length < 6) return glyph;
  const p0 = before.slice(-2), c1 = [cub[0], cub[1]], c2 = [cub[2], cub[3]], p3 = [cub[4], cub[5]];
  const lowest = (a, b) => { let m = -Infinity; for (let i = 0; i <= 100; i += 1) { const t = i / 100, u = 1 - t; m = Math.max(m, u * u * u * p0[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * p3[1]); } return m; };
  const ch1 = [p0[0] + (p3[0] - p0[0]) / 3, p0[1] + (p3[1] - p0[1]) / 3], ch2 = [p0[0] + (2 * (p3[0] - p0[0])) / 3, p0[1] + (2 * (p3[1] - p0[1])) / 3];
  let n1 = [c1[0] + (ch1[0] - c1[0]) * k, c1[1] + (ch1[1] - c1[1]) * k], n2 = [c2[0] + (ch2[0] - c2[0]) * k, c2[1] + (ch2[1] - c2[1]) * k];
  const depth = lowest(c1, c2);
  for (let i = 0; i < 200; i += 1) {
    const diff = depth - lowest(n1, n2);
    if (Math.abs(diff) < 0.05) break;
    n1 = [n1[0], n1[1] + diff * 0.6]; n2 = [n2[0], n2[1] + diff * 0.6];
  }
  const f = (v) => v.toFixed(2);
  const rest = d.slice(at).replace(/^C\s*(?:-?\d*\.?\d+(?:e-?\d+)?\s*){6}/i, "");
  const nd = `${d.slice(0, at)}C ${f(n1[0])} ${f(n1[1])} ${f(n2[0])} ${f(n2[1])} ${f(p3[0])} ${f(p3[1])}${rest}`;
  return { ...glyph, strokes: glyph.strokes.map((st, i) => (i === si ? { ...st, d: nd } : st)) };
}
// `stemOnLine` (ъ): the letter is placed so that its STEM lies on a slanted line of the grid, not the start of its flag (the flag starts 0.56 of
// a cell from the stem's line, so with the start on a line the stem stood between two lines). The glyph gets `stemAnchor`, the top of the stem
// (the start of the first long straight segment of the stroke); the layout snaps that point's line (wordEngine.js, `stemDx`). The shape and the
// size of the letter do not change.
export function markStem(glyph) {
  const d = String(glyph.strokes?.[0]?.d ?? "");
  const toks = d.match(/[MLQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  let prev = null;
  for (let i = 0; i < toks.length; i += 1) {
    if (/[MLQC]/i.test(toks[i])) {
      let j = i + 1; const n = [];
      while (j < toks.length && !/[MLQCZ]/i.test(toks[j])) { n.push(Number(toks[j])); j += 1; }
      if (toks[i] === "L" && prev && Math.hypot(n[0] - prev[0], n[1] - prev[1]) > 25) return { ...glyph, stemAnchor: prev };
      if (n.length >= 2) prev = [n[n.length - 2], n[n.length - 1]];
    }
  }
  return glyph;
}
const applyOverride = (g, { startLift, steepExit, straightTail, softHook, stemOnLine, startDrop, ...rest }) => {
  let out = liftStart({ ...g, ...rest }, startLift);
  if (startDrop) out = dropStart(out, startDrop);
  if (stemOnLine) out = markStem(out);
  if (softHook != null) out = softenHook(out, softHook);
  if (steepExit) out = steepenExit(out);
  if (straightTail != null) out = straightenTail(out, straightTail);
  return out;
};
// `noOverrides`: a glyph of a variant deck made from another source (the Bulgarian letters traced from a font, tools/propis2/variants/bg):
// the fixes above are for the shapes of THIS bank (stroke / coordinate indices of the captured letters) and would break it
const withOverride = (g) => {
  if (g.noOverrides) return [g];
  const own = P2_GLYPH_OVERRIDES[g.label] ? applyOverride(g, P2_GLYPH_OVERRIDES[g.label]) : g;
  const split = (g.aliases ?? []).filter((a) => P2_GLYPH_OVERRIDES[a]);
  if (!split.length) return [own];
  const aliases = g.aliases.filter((a) => !split.includes(a));
  return [{ ...own, aliases: aliases.length ? aliases : undefined }, ...split.map((a) => applyOverride({ ...g, label: a, aliases: undefined }, P2_GLYPH_OVERRIDES[a]))];
};

// `yerLoop(soft)`: the left part of ы, `ы1` (2026-10-28), drawn after the school copybook (Горецкий / «Школа России») and the pen's path the owner traced over its photo.
// It is ь up to the bottom of the oval (the stem and the lower lobe of в, reduced, see `yerBelly`); then the school form: the right side of the oval, almost straight along the slant, goes up, on to the left along its top, curls into a
// small LOOP against the stem (counter-clockwise: left, down, right), crosses its own top edge and leaves to the right as the CONNECTOR, a concave rise to the TOP of the
// next stem (`ы2`), where it meets the stem coming down in a narrow wedge. The oval is a little over half the row (its top at 0.59 of the height, the knot at 0.55).
// The points are the owner's trace converted to the capture's units (calibrated on the stem line and the baseline of the photo). The connector is the tail (the last cubic: it
// is drawn because ы2 always follows; the layout redraws it to end at the start of ы2: `joinAtStart` + `joinReverse` there). ь itself in words is unchanged.
// Built from the patched ь (8 commands: M, L to the foot of the belly, 4 cubics of the oval, the replayed bottom, the exit); only the first four are kept (stem, three cubics of the oval up to its top).
const Y_LOOP_POINTS = [
  [157.15, 34.15], [155.8, 33.8], [154.6, 34.0], [153.85, 34.55], [154.45, 35.15], [155.62, 35.66], [156.82, 35.13], // the loop against the stem (flattened: its upper and lower lines run almost along each other, no hole)
];
const Y_LINK = [[168.3, 30.0], [175.95, 21.5], [181.47, 10.15]]; // c1, c2, the top of ы2's stem (one slanted line to the right of ь's)
export function yerLoop(soft) {
  const c = parseCmds(soft?.strokes?.[0]?.d);
  if (c.length !== 8 || c[1].c !== "L" || c.slice(2).some((x) => x.c !== "C")) return null;
  const f = (v) => v.toFixed(2);
  const show = (cm, n) => `${cm} ${n.map(f).join(" ")}`;
  const top = c[0].n.slice(-2);
  const dx = top[0] - 164.35, dy = top[1] - 10; // the trace is in the frame of the captured ь (its stem top at 164.35, 10): move it with the glyph
  // the oval is ь's own as far as its top (the right side and the round top, 3 cubics: foot -> bottom -> right -> top); the loop goes on from the top
  const T = c[4].n.slice(-2);
  const P = [T, ...Y_LOOP_POINTS.map(([x, y]) => [x + dx, y + dy])];
  // Catmull-Rom through the points -> cubics (the ends repeated)
  const segs = P.slice(0, -1).map((p1, i) => {
    const p0 = P[Math.max(0, i - 1)], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    return ["C", [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]]];
  });
  const link = ["C", Y_LINK.flatMap(([x, y]) => [x + dx, y + dy])];
  const d = [show("M", c[0].n), show("L", c[1].n), show("C", c[2].n), show("C", c[3].n), show("C", c[4].n), ...segs.map((sg) => show(...sg)), show(...link)].join(" ");
  const { tailNoAlign, bellyFrom, aliases, ...rest } = soft;
  return { ...rest, label: "ы1", sourceLabel: "ы1: левая часть «ы» по школьной прописи и траектории владельца (овал, петля у стойки, соединение к верху правой стойки)", tailSplit: 0, tailSplitCount: 1, tailLift: false, noLiftExit: true, strokes: [{ ...soft.strokes[0], d }] };
}

export const withGlyphOverrides = (glyphs) => {
  const raw = new Map((glyphs ?? []).map((g) => [g.label, g]));
  const belly = (g) => (g.bellyFrom && raw.get(g.bellyFrom.label) ? yerBelly(g, raw.get(g.bellyFrom.label), g.bellyFrom) : g);
  const patched = [...withMarkedCapitals((glyphs ?? []).flatMap(withOverride).map(belly)), ...(glyphs?.length ? DIGIT_GLYPHS : [])];
  // ы = ы1 + ы2: its left part is built from the patched ь (see yerLoop)
  const loop = yerLoop(patched.find((g) => g.label === "ь"));
  if (loop) patched.push(loop);
  // `joinLikeLabel` -> the (already patched) glyph whose connector is borrowed
  return patched.map((g) => (g.joinLikeLabel ? { ...g, joinLike: patched.find((x) => x.label === g.joinLikeLabel), joinEndLike: patched.find((x) => x.label === g.joinEndLikeLabel) } : g));
};
