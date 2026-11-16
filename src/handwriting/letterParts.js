// The PARTS of a letter a row may write alone (`propis2` row panel «Что пишем», owner 2026-11-16: «всю букву, или только одну петельку, или
// только один штрих»). A part is a piece of one of the letter's strokes, { stroke, from, to } in shares of that stroke's length.
//  - the print letters (`upright`, tools/handwriting/cyrillic/build-print.mjs): every stroke is a part — they are drawn stroke by stroke;
//  - the copybook hand: most letters are ONE line (34 of the 59 Russian ones), so a stroke is cut where an element of the school method
//    begins — at the top: the pen comes up to the top of the letter's band and turns down again (и: two «палочки с закруглением»,
//    а: the oval and the hook, у: the hook and the stick with the loop). `glyph.partCuts` (shares of each stroke's length, per stroke) is the
//    owner's own cut where the automatic one is wrong (none yet).
import { samplePath, toCubicPathD } from "./pathGeometry.js";

const PER_SEGMENT = 24;
// a turn counts when the pen came up at least this much (of the x-height, 52 units in the capture frame) before it and goes down as much after
const UNIT = 52;
const PROMINENCE = 0.45;
const BOTTOM_PROMINENCE = 0.85;
// no cut this near either end of a stroke (the lead-in, the exit)
const END_SHARE = 0.1;
// the turn must be SHARP: the pen comes up a line and goes down it again (и, the stem of а) — the directions just before and just after
// (over TURN_SPAN units of the path) nearly opposite. The top of an oval (о, е, the bowl of а) is passed smoothly: no element starts there.
const TURN_SPAN = 7;
const TURN_COS = -0.35;

const POLY = new Map(); // d -> { pts, len: cumulative lengths }
function polyOf(d) {
  if (!POLY.has(d)) {
    const pts = samplePath(toCubicPathD(d), PER_SEGMENT);
    const len = [0];
    for (let i = 1; i < pts.length; i += 1) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    if (POLY.size > 4000) POLY.clear();
    POLY.set(d, { pts, len });
  }
  return POLY.get(d);
}

// the shares of the stroke's length where the pen turns SHARPLY: at the top (it came up a line and goes down it — и, the stem of а) or at the
// bottom (it went down a stick and comes back up it — п т р ь: the arch or the loop that follows is an element of its own); a turn with a rise
// (fall) of PROMINENCE x-heights on both sides
export function autoCuts(d) {
  const { pts, len } = polyOf(d);
  const total = len[len.length - 1];
  if (!total || pts.length < 5) return [];
  const cuts = [];
  let lastCut = 0;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const y = pts[i][1];
    const top = y <= pts[i - 1][1] && y < pts[i + 1][1];
    const bottom = y >= pts[i - 1][1] && y > pts[i + 1][1];
    if (!top && !bottom) continue;
    const share = len[i] / total;
    if (share < END_SHARE || share > 1 - END_SHARE) continue;
    // how far the pen went the other way since the last cut, and goes on until it turns back past this point
    const away = (q) => (top ? q[1] - y : y - q[1]);
    let before = -Infinity;
    for (let k = lastCut; k < i; k += 1) before = Math.max(before, away(pts[k]));
    let after = -Infinity;
    for (let k = i + 1; k < pts.length; k += 1) { after = Math.max(after, away(pts[k])); if (away(pts[k]) < 0) break; }
    // (at the bottom the pen must go up the WHOLE stick again: the short flick out of и's last stick, the lead-in of л м, are no elements)
    const need = (top ? PROMINENCE : BOTTOM_PROMINENCE) * UNIT;
    if (!(before >= need && after >= need)) continue;
    const back = pointAt(pts, len, len[i] - TURN_SPAN), ahead = pointAt(pts, len, len[i] + TURN_SPAN);
    const vin = [pts[i][0] - back[0], pts[i][1] - back[1]], vout = [ahead[0] - pts[i][0], ahead[1] - pts[i][1]];
    const cos = (vin[0] * vout[0] + vin[1] * vout[1]) / (Math.hypot(...vin) * Math.hypot(...vout) || 1);
    if (cos <= TURN_COS) { cuts.push(share); lastCut = i; }
  }
  return cuts;
}

function pointAt(pts, len, s) {
  const c = Math.max(0, Math.min(len[len.length - 1], s));
  let i = 1;
  while (i < len.length - 1 && len[i] < c) i += 1;
  const t = len[i] === len[i - 1] ? 0 : (c - len[i - 1]) / (len[i] - len[i - 1]);
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
}

// The automatic cut of the copybook hand is OFF in the app (owner, 2026-11-16: «многие буквы неправильно, отшлифуем позже»): a copybook letter
// has parts only where they are given by hand (`glyph.partCuts`); the review sheet (tools/propis2/parts-review) and the tests turn it on.
let AUTO_CUTS = false;
export const setAutoCuts = (on) => { AUTO_CUTS = Boolean(on); };

// [{ stroke, from, to }] — the letter's parts in writing order; a letter of one part has nothing to pick
const PIECES = { on: new WeakMap(), off: new WeakMap() };
export function letterPieces(glyph) {
  if (!glyph?.strokes?.length) return [];
  const cache = AUTO_CUTS ? PIECES.on : PIECES.off;
  if (cache.has(glyph)) return cache.get(glyph);
  const out = [];
  glyph.strokes.forEach((st, si) => {
    const cuts = glyph.upright ? [] : (glyph.partCuts?.[si] ?? (AUTO_CUTS ? autoCuts(st.d) : []));
    const edges = [0, ...cuts, 1];
    for (let k = 0; k + 1 < edges.length; k += 1) out.push({ stroke: si, from: edges[k], to: edges[k + 1] });
  });
  cache.set(glyph, out);
  return out;
}

// the piece of a path between two shares of its length, as a polyline (the cut pieces of a copybook letter); the whole path is returned as it is
export function piecePathD(d, from, to) {
  if (from <= 0 && to >= 1) return d;
  const { pts, len } = polyOf(d);
  const total = len[len.length - 1];
  const a = from * total, b = to * total;
  const at = (s) => {
    let i = 1;
    while (i < len.length - 1 && len[i] < s) i += 1;
    const t = len[i] === len[i - 1] ? 0 : (s - len[i - 1]) / (len[i] - len[i - 1]);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
  };
  const inner = pts.filter((_, i) => len[i] > a && len[i] < b);
  const f = (q) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`;
  return [at(a), ...inner, at(b)].map((q, i) => `${i ? "L" : "M"} ${f(q)}`).join(" ");
}

// A placed letter's strokes split into its parts, the ones not written (`hidden`, a Set of part indices) marked hidden; consecutive parts of a
// stroke that are written alike are joined back into one piece (one line, one start dot). `strokes`: the letter's strokes as placed on the row
// (the same order and shape as the glyph's own, moved).
export function splitIntoParts(strokes, glyph, hidden) {
  const pieces = letterPieces(glyph);
  const out = [];
  strokes.forEach((s, si) => {
    const mine = pieces.map((p, i) => ({ ...p, i })).filter((p) => p.stroke === si);
    const runs = [];
    for (const p of mine) {
      const h = hidden.has(p.i);
      const last = runs[runs.length - 1];
      if (last && last.hidden === h) last.to = p.to; else runs.push({ from: p.from, to: p.to, hidden: h });
    }
    for (const r of runs) out.push({ ...s, d: piecePathD(s.d, r.from, r.to), ...(r.hidden ? { hidden: true } : {}) });
  });
  return out;
}
