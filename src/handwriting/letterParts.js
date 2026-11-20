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
  // a copybook letter marked in tools/handwriting/cyrillic/letter_elements.json (the deck puts it on the glyph as `trajectory`): its parts are
  // its ELEMENTS (owner 2026-11-19/20); their ends are positions on the path ({ seg, t }), exact on the letter as any row places it
  if (glyph.trajectory && !glyph.upright) {
    const els = letterPaths(glyph).filter((p) => p.kind === "ink").map(({ stroke, from, to }) => ({ stroke, from, to }));
    cache.set(glyph, els);
    return els;
  }
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
  if (typeof from === "object" && from !== null) return subPathD(d, from, to);
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
  if (glyph.trajectory && !glyph.upright) return splitMarked(strokes, glyph, hidden);
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

// ── Elements and the pen's trajectory (docs/propis2-letter-parts.md, owner 2026-11-19) ──────────────────────────────────────────────
// A letter has what stays on paper (its ELEMENTS: р = the stick and the hook) and the way the pen went over it. Two techniques write the
// same elements: `joined` (default, the owner taught his son so): the path as captured — р goes down the stick, back UP it to where the hook
// begins (a RETRACE: on paper, over ink already drawn, adding none) and on into the hook; `lifted` (the way schools lean now): every element on
// its own from its own start dot; between them the pen is lifted (its way through the air is not shown). `glyph.trajectory` (tools/handwriting/cyrillic/
// letter_elements.json) marks per stroke `retrace: [[a, b]…]` and `cuts: [a…]` (an element begins without a retrace), positions counted in
// path segments from the stroke's start. The parts a row keeps (`letterPieces`) of a marked letter are its elements.

// the share of the stroke's length at a position (kept for the review sheets and the old share-based cuts): a number of segments (2 = the end of
// the 2nd segment after M, 2.5 = the middle of the 3rd by its curve parameter), { seg, y } or { seg, top: true } — see anchorPos
export function segmentShare(d, at) {
  const { len } = polyOf(d);
  const total = len[len.length - 1];
  if (!total) return 0;
  const p = anchorPos(d, at);
  const i = Math.min(len.length - 1, Math.round((p.seg + p.t) * PER_SEGMENT));
  return len[i] / total;
}

// ── positions on a path: { seg, t } — the segment (0-based, of the path as cubics: every L / Q / C one segment) and the curve parameter on it.
// A row places a letter by mapping its points (the fit to the lines, the widening along the slant, the move — wordEngine): a cubic's curve
// parameter stays where it was, so a position found on the glyph's own path is the same point of the letter on the placed one, exactly.
const SEGS = new Map(); // d -> [[p0, p1, p2, p3], …]
export function cubicSegs(d) {
  if (!SEGS.has(d)) {
    const t = toCubicPathD(d).match(/[MC]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
    const segs = [];
    let cur = null;
    for (let i = 0; i < t.length;) {
      if (t[i] === "M") { cur = [+t[i + 1], +t[i + 2]]; i += 3; continue; }
      if (t[i] === "C") { i += 1; continue; }
      const n = t.slice(i, i + 6).map(Number); i += 6;
      segs.push([cur, [n[0], n[1]], [n[2], n[3]], [n[4], n[5]]]);
      cur = [n[4], n[5]];
    }
    if (SEGS.size > 4000) SEGS.clear();
    SEGS.set(d, segs);
  }
  return SEGS.get(d);
}
const bez = (P, t) => [0, 1].map((i) => (1 - t) ** 3 * P[0][i] + 3 * (1 - t) ** 2 * t * P[1][i] + 3 * (1 - t) * t * t * P[2][i] + t ** 3 * P[3][i]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// de Casteljau: the cubic split at t, [left, right]
function splitCubic(P, t) {
  const a = lerp(P[0], P[1], t), b = lerp(P[1], P[2], t), c = lerp(P[2], P[3], t), e = lerp(a, b, t), f = lerp(b, c, t), m = lerp(e, f, t);
  return [[P[0], a, e, m], [m, f, c, P[3]]];
}
const posValue = (p) => p.seg + p.t;
// a position from a mark of letter_elements.json on the glyph's own path: a number of segments (k = the start of the k-th segment counted from 0,
// i.e. the end of the k-th after M; k.5 = the middle of the next by its parameter), { seg, y } — the first point from segment `seg` on at the
// height y (a guide line in the capture frame: 10 the top line, 36 the middle line, 62 the baseline), { seg, top: true } — the highest point
// of segment `seg`
export function anchorPos(d, at) {
  const segs = cubicSegs(d);
  const n = segs.length;
  if (typeof at === "number") {
    const seg = Math.floor(at), t = at - seg;
    return seg >= n ? { seg: n - 1, t: 1 } : { seg: Math.max(0, seg), t: seg < 0 ? 0 : t };
  }
  if (at && at.top) {
    const P = segs[Math.min(n - 1, at.seg)];
    let best = 0, by = Infinity;
    for (let k = 0; k <= 400; k += 1) { const y = bez(P, k / 400)[1]; if (y < by) { by = y; best = k / 400; } }
    return { seg: Math.min(n - 1, at.seg), t: best };
  }
  if (at && Number.isFinite(at.y)) {
    for (let i = Math.max(0, at.seg); i < n; i += 1) {
      const P = segs[i];
      let prev = bez(P, 0)[1] - at.y;
      for (let k = 1; k <= 64; k += 1) {
        const cur = bez(P, k / 64)[1] - at.y;
        if (prev === 0) return { seg: i, t: (k - 1) / 64 };
        if (prev * cur <= 0) {
          let lo = (k - 1) / 64, hi = k / 64;
          for (let r = 0; r < 40; r += 1) { const m = (lo + hi) / 2; const v = bez(P, m)[1] - at.y; if ((v > 0) === (prev > 0)) lo = m; else hi = m; }
          return { seg: i, t: (lo + hi) / 2 };
        }
        prev = cur;
      }
    }
    throw new Error(`the path never reaches y=${at.y} after segment ${at.seg}`);
  }
  throw new Error("not a position: " + JSON.stringify(at));
}
export const pointAtPos = (d, pos) => bez(cubicSegs(d)[pos.seg], pos.t);
// the exact piece of a path between two positions, as cubics (no faceting, the curve itself)
export function subPathD(d, a, b) {
  const segs = cubicSegs(d);
  const f = (q) => `${q[0].toFixed(3)} ${q[1].toFixed(3)}`;
  const out = [];
  for (let i = a.seg; i <= b.seg; i += 1) {
    let P = segs[i];
    const t0 = i === a.seg ? a.t : 0, t1 = i === b.seg ? b.t : 1;
    if (t1 - t0 <= 1e-9) continue;
    if (t1 < 1) P = splitCubic(P, t1)[0];
    if (t0 > 0) P = splitCubic(P, t0 / t1)[1];
    out.push(P);
  }
  if (!out.length) { const q = pointAtPos(d, a); return `M ${f(q)} C ${f(q)} ${f(q)} ${f(q)}`; }
  return `M ${f(out[0][0])} ` + out.map((P) => `C ${f(P[1])} ${f(P[2])} ${f(P[3])}`).join(" ");
}

// the letter's own strokes without its join to the next letter where the app splits it off (glyphOverrides.js `tailStroke`: a stroke of its
// own, б э; `tailSplit`: the last `tailSplitCount` commands of a stroke, о ю ф ъ ь): a letter alone, as a row of parts writes it, has no join.
// The engine splits the same way (wordEngine wideGlyphLocalCompute), so these strokes match the row's placed ones one by one.
export function ownStrokes(glyph) {
  const st = glyph?.strokes ?? [];
  if (Number.isInteger(glyph?.tailStroke) && st[glyph.tailStroke]) return st.filter((_, i) => i !== glyph.tailStroke);
  if (Number.isInteger(glyph?.tailSplit) && st[glyph.tailSplit]) {
    const parts = String(st[glyph.tailSplit].d).trim().split(/ (?=[LQC] )/);
    const n = glyph.tailSplitCount ?? 1;
    if (parts.length - n >= 2) return st.map((s, i) => (i === glyph.tailSplit ? { ...s, d: parts.slice(0, parts.length - n).join(" ") } : s));
  }
  return st;
}

// [{ kind: "ink" | "retrace", stroke, from, to, element? }] in writing order, `from` / `to` positions ({ seg, t }) on the letter's own strokes
// (ownStrokes: its join to the next letter left out): the ink pieces carry the number of the element they are; a stroke with nothing marked is
// one element
const PATHS = new WeakMap();
export function letterPaths(glyph) {
  if (glyph && PATHS.has(glyph)) return PATHS.get(glyph);
  const out = [];
  let element = 0;
  ownStrokes(glyph).forEach((st, si) => {
    const spec = glyph.trajectory?.strokes?.[si] ?? {};
    const pos = (at) => anchorPos(st.d, at);
    // `links` (ж): a line INSIDE the letter between two of its elements that is not part of either — written by the joined hand (a line on
    // the paper), left out by the lifted one; unlike a retrace it need not run along an element's line
    const retr = [
      // (a third entry "ahead" says outright that the pen goes up the line of the element it is about to write — я: part of that way runs
      // over its own rise before the loop, so the rule by the ink already drawn would take it for a way back)
      ...(spec.retrace ?? []).map(([a, b, kind]) => [pos(a), pos(b), false, kind === "ahead"]),
      ...(spec.links ?? []).map(([a, b]) => [pos(a), pos(b), true, false]),
    ].sort((p, q) => posValue(p[0]) - posValue(q[0]));
    const cuts = (spec.cuts ?? []).map(pos);
    const end = { seg: cubicSegs(st.d).length - 1, t: 1 };
    let at = { seg: 0, t: 0 };
    const ink = (from, to) => {
      const edges = [from, ...cuts.filter((c) => posValue(c) > posValue(from) && posValue(c) < posValue(to)).sort((p, q) => posValue(p) - posValue(q)), to];
      for (let k = 0; k + 1 < edges.length; k += 1) if (posValue(edges[k + 1]) - posValue(edges[k]) > 1e-9) out.push({ kind: "ink", stroke: si, from: edges[k], to: edges[k + 1], element: element++ });
    };
    for (const [a, b, link, ahead] of retr) {
      ink(at, a);
      out.push({ kind: "retrace", stroke: si, from: a, to: b, ...(link ? { link: true } : {}), ...(ahead ? { ahead: true } : {}) });
      at = b;
    }
    ink(at, end);
  });
  if (glyph) PATHS.set(glyph, out);
  return out;
}

// A placed MARKED letter written only in part (a row's `#p`): its strokes cut at the ends of its elements; an element not written is hidden,
// and so is a retrace or link next to one (it belongs to the writing of the two elements it lies between: with one of them left out the pen
// has no way to go there). Consecutive pieces written alike are joined back into one (one line, one start dot).
function splitMarked(strokes, glyph, hidden) {
  const paths = letterPaths(glyph);
  const inks = paths.filter((p) => p.kind === "ink");
  const out = [];
  strokes.forEach((s, si) => {
    const mine = paths.filter((p) => p.stroke === si);
    const runs = [];
    mine.forEach((p, k) => {
      let h;
      if (p.kind === "ink") h = hidden.has(p.element);
      else {
        const before = [...mine.slice(0, k)].reverse().find((q) => q.kind === "ink"), after = mine.slice(k + 1).find((q) => q.kind === "ink");
        h = (before && hidden.has(before.element)) || (after && hidden.has(after.element)) || !before || !after;
      }
      const last = runs[runs.length - 1];
      if (last && last.hidden === h) last.to = p.to; else runs.push({ from: p.from, to: p.to, hidden: h });
    });
    for (const r of runs) out.push({ ...s, d: subPathD(s.d, r.from, r.to), ...(r.hidden ? { hidden: true } : {}) });
  });
  void inks;
  return out;
}

// The moves of the pen writing the letter in a technique, in order, over the given strokes (the glyph's own, or as placed on a row — the
// same order and shape): { kind: "ink", d, element, startDot } — draws; { kind: "retrace", d, ink? } — the pen on paper along the line of an
// element (joined only): over ink already there it adds nothing, ahead of the element it is about to write (`ink: true`) it leaves the line; { kind: "lift", from, to } — the pen leaves the paper and is put down elsewhere: its way through
// the air is NOT shown (owner, 2026-11-19: «просто там закончилось и потом началось в начале второго штриха»). A start dot marks every place the pen touches
// down: the start of each stroke, and in `lifted` the start of every element. `continues: true` — the move goes on from the previous one with
// the pen on the paper: a player must run it as ONE motion with it, at the same speed and without a pause (owner, 2026-11-19: «при
// непрерывном соединении стыки траектории должны быть незаметными»).
export function letterMoves(glyph, technique = "joined", strokes = ownStrokes(glyph)) {
  const moves = [];
  let last = null; // [x, y] where the pen is
  let lastStroke = -1;
  const drawn = []; // points of the ink drawn so far
  for (const p of letterPaths(glyph)) {
    const d = strokes[p.stroke].d;
    if (p.kind === "retrace") {
      if (technique === "joined") {
        // over ink already drawn (р п: back up the stick) the pen adds nothing; AHEAD of an element (и: up the line the second stick then
        // comes down) it leaves its trace — on paper the line is there as soon as the pen went up (owner, 2026-11-19: «после первого штриха
        // перо идёт вверх по наклонной до верхней линии»)
        const rd = piecePathD(d, p.from, p.to);
        const over = samplePath(toCubicPathD(rd), 6).filter((q) => drawn.some((r) => Math.hypot(r[0] - q[0], r[1] - q[1]) < 1)).length;
        const ahead = p.link || p.ahead || over < samplePath(toCubicPathD(rd), 6).length / 2;
        moves.push({ kind: "retrace", d: rd, continues: true, ...(ahead ? { ink: true } : {}), ...(p.link ? { link: true } : {}) });
        last = pointAtPos(d, p.to);
      }
      continue;
    }
    const start = pointAtPos(d, p.from);
    // (lifted: every element from its own start dot, also one that goes on from the point where the last one ended)
    const touchDown = p.stroke !== lastStroke || technique === "lifted";
    if (touchDown && last && Math.hypot(start[0] - last[0], start[1] - last[1]) > 0.5) moves.push({ kind: "lift", from: last, to: start });
    const ink = piecePathD(d, p.from, p.to);
    moves.push({ kind: "ink", d: ink, element: p.element, startDot: Boolean(touchDown), ...(touchDown ? {} : { continues: true }) });
    drawn.push(...samplePath(toCubicPathD(ink), 12));
    last = pointAtPos(d, p.to);
    lastStroke = p.stroke;
  }
  return moves;
}

// A COMPOSED letter (`glyph.compose`, ш = 6 + 6 + 6) has no line of its own: the row lays its parts out and joins them as letters in a word.
// Its elements are those parts, the joins between them the pen's way from one to the next. `strokes`: the parts as the row placed them;
// `trajectory`: the row's trajectory of the letter (the parts and, between them, the joins). Joined: one start, every join run with the pen
// down — leaving its line if it goes over blank paper (ш: up along the next stick); lifted: every part from its own start dot.
// `parts` (optional, letter_elements.json): which pieces of the trajectory are the elements, by index — when a part brings its own join along
// (ы: the tail of its left part runs up to the top of the right stick, a piece of the part's own ink); by default the pieces drawn on the
// page (`strokes`) are the elements and the rest are joins. Pieces of no length are skipped.
// An entry of `parts` may be a list: several pieces that make ONE element (ы: its left part AND the line from its loop up to the right stick —
// «соединение между штрихами — часть буквы», owner 2026-11-20); the pieces after the first go on with the pen down in either technique.
export function composedMoves(strokes, trajectory, technique = "joined", parts = null) {
  const elementOf = new Map();
  (parts ?? []).forEach((p, e) => (Array.isArray(p) ? p : [p]).forEach((i) => elementOf.set(i, e)));
  const drawnD = new Set(strokes.map((s) => s.d));
  const isPart = (t, i) => (parts ? elementOf.has(i) : drawnD.has(t.d));
  const moves = [];
  let element = 0, last = null;
  const drawn = [];
  for (const [i, t] of trajectory.entries()) {
    const pts = samplePath(toCubicPathD(t.d), 6);
    if (Math.max(...pts.map((q) => Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]))) < 0.01) continue;
    if (!isPart(t, i)) {
      if (technique !== "joined") continue;
      const over = pts.filter((q) => drawn.some((r) => Math.hypot(r[0] - q[0], r[1] - q[1]) < 1)).length;
      moves.push({ kind: "retrace", d: t.d, continues: true, ...(over < pts.length / 2 ? { ink: true } : {}) });
      last = pts.at(-1);
      continue;
    }
    // (a piece of the same element as the one before goes on with the pen down, whatever the technique)
    const e = parts ? elementOf.get(i) : element;
    const sameElement = parts && moves.length && moves.filter((m) => m.kind === "ink").at(-1)?.element === e;
    const touchDown = !moves.length || (technique === "lifted" && !sameElement);
    if (touchDown && last && Math.hypot(pts[0][0] - last[0], pts[0][1] - last[1]) > 0.5) moves.push({ kind: "lift", from: last, to: pts[0] });
    moves.push({ kind: "ink", d: t.d, element: e, startDot: touchDown, ...(touchDown ? {} : { continues: true }) });
    if (!parts) element += 1;
    drawn.push(...samplePath(toCubicPathD(t.d), 12));
    last = pts.at(-1);
  }
  return moves;
}

