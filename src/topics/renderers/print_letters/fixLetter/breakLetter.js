import { strokeGeometry } from "../screenWrite/traceEngine";

// «Почини букву» (mode fix_letter, docs/print-letters-fix-letter.md): a letter with some of its strokes
// knocked out of place; the child puts them back. This module holds the pure part — which strokes break
// and how, what a drag moves, where a let-go part snaps, when the letter is whole — so it can be tested
// on every letter.
//
// TARGETS are the strokes of the glyph where they belong (the same strokes the sheets and «Пишу на
// экране» use). PARTS are what the child moves:
//  - a straight part (`M x,y L x,y`) is just its two ends (pa, pb): the middle drags both, near an end
//    drags that end (owner, 2026-11-04: «все части должны двигаться и передвигаться концы»);
//  - a SLANTED straight part can be mirrored too, like a half-oval (owner, 2026-11-06: «tap… зеркалило по
//    вертикали и штрихи, которые прямые… для буквы И самая частая ошибка — наклон в другую сторону»): a tap
//    flips it about the vertical through its middle («/» ↔ «\»); broken that way only where the flipped
//    stroke still touches the other strokes with both ends, as the right one does — И's diagonal becomes
//    the child's «N», while Л's or К's leg would hang in the air (see `slantMirrorable`);
//  - any other part (a half-oval, К's corner) is a shape moved whole (off) and maybe mirrored (a tap
//    turns a half-oval round). The ovals of О Ю С Э are cut in two at half height (owner, 2026-11-04:
//    «овалы О, Ю, С, Э разрезать пополам по горизонтали и зеркалить половинки»): a top and a bottom arc.
//    A half that looks the same from both sides (О's, Ю's) mirrors upside down, the others (С's, Э's —
//    the С/Э confusion) sideways.
// The letter is checked by its SHAPE, not by which part stands where (owner, 2026-11-04: «у Е три
// одинаковых штриха… нужно сверять именно форму буквы, а не какой штрих где установлен»): a part snaps
// into ANY free target it matches — a straight part into any straight target its two ends are near (in
// either direction, any length — ends can be pulled), a shape into any target of the same shape — and the
// letter is whole when every target is covered by a part.

export const MAGNETS = { strong: 14, normal: 9 };     // a part let go this close to a target snaps in
const MIN_LEN = 20;                                    // Ё's dots and Й's breve are too small to drag
const STRAIGHT = /^\s*M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*L\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*$/i;
const EXACT = 0.5;                                     // a part this close to a target stands on it
const KEY_N = 48;                                      // shapes are compared as this many evenly spaced points
const SPLIT = new Set(["О", "Ю", "С", "Э"]);           // letters whose oval is cut at half height
const OVAL = /овал/;

const Z = () => ({ x: 0, y: 0 });
export const vlen = (v) => Math.hypot(v.x, v.y);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function glyphWidthOf(card) {
  return Number(String(card?.viewBox ?? "0 0 50 100").split(/\s+/)[2]) || 50;
}

function bboxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// `pts` evenly spaced along the polyline, `n` of them
function resample(pts, n) {
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + dist(pts[k - 1], pts[k]));
  const L = cum[cum.length - 1] || 0;
  const out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const target = (L * k) / (n - 1);
    while (j < pts.length - 1 && cum[j] < target) j++;
    const a = pts[j - 1] ?? pts[0], b = pts[j] ?? a;
    const span = cum[j] - cum[j - 1];
    const f = span > 0 ? Math.min(1, Math.max(0, (target - cum[j - 1]) / span)) : 0;
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return out;
}
const polyLen = (pts) => pts.reduce((sum, q, k) => (k ? sum + dist(pts[k - 1], q) : 0), 0);

// The oval (or С/Э's open arc) cut at the height y0 into a top and a bottom arc.
function cutAtHeight(pts, y0) {
  const closed = dist(pts[0], pts[pts.length - 1]) < 1;
  const ring = closed ? pts.slice(0, -1) : pts.slice();
  const n = ring.length;
  const cross = [];                                    // { k, p }: between ring[k] and ring[k+1]
  const last = closed ? n : n - 1;
  for (let k = 0; k < last; k++) {
    const a = ring[k], b = ring[(k + 1) % n];
    if ((a.y - y0) * (b.y - y0) <= 0 && a.y !== b.y) {
      const f = (y0 - a.y) / (b.y - a.y);
      cross.push({ k, p: { x: a.x + (b.x - a.x) * f, y: y0 } });
    }
  }
  if (closed) {
    if (cross.length < 2) return null;
    const [c1, c2] = cross;
    const arcA = [c1.p], arcB = [c2.p];
    for (let k = c1.k + 1; k <= c2.k; k++) arcA.push(ring[k]);
    arcA.push(c2.p);
    for (let k = c2.k + 1; k <= c1.k + n; k++) arcB.push(ring[k % n]);
    arcB.push(c1.p);
    return [arcA, arcB];
  }
  if (cross.length < 1) return null;
  const c = cross[0];
  return [[...ring.slice(0, c.k + 1), c.p], [c.p, ...ring.slice(c.k + 1)]];
}

// A shape target: its points for drawing, a fixed-size outline for comparing, and how it mirrors.
function shapeTarget(i, d, name, pts, half) {
  const bb = bboxOf(pts);
  const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
  const key = resample(pts, KEY_N);
  // the same seen from the other side (О's arcs)? then it mirrors upside down
  const sideways = key.map((q) => ({ x: 2 * cx - q.x, y: q.y }));
  const symmetric = Math.min(...[key, key.slice().reverse()].map((k2) => Math.max(...k2.map((q, j) => dist(q, sideways[j]))))) < 1.5;
  return { i, d, name, pts, key, len: polyLen(pts), line: null, cx, cy, wide: bb.w > bb.h, half, flip: symmetric ? "y" : "x" };
}

/** The strokes of a letter where they belong (the ovals of О Ю С Э as two arcs each). */
export function letterTargets(card) {
  const geo = strokeGeometry(card);
  const split = SPLIT.has(card.id ?? card.label);
  const out = [];
  card.strokes.forEach((s, si) => {
    const m = String(s.d).match(STRAIGHT);
    const name = s.name ?? "";
    if (m) {
      const bb = bboxOf(geo[si].pts);
      out.push({
        i: out.length, d: s.d, name, pts: geo[si].pts, len: geo[si].length,
        line: { a: { x: +m[1], y: +m[2] }, b: { x: +m[3], y: +m[4] } },
        cx: bb.x + bb.w / 2, cy: bb.y + bb.h / 2, wide: bb.w > bb.h, half: false,
      });
      return;
    }
    if (split && OVAL.test(name)) {
      const bb = bboxOf(geo[si].pts);
      const halves = cutAtHeight(geo[si].pts, bb.y + bb.h / 2);
      if (halves) {
        // the top arc first
        halves.sort((h1, h2) => bboxOf(h1).y - bboxOf(h2).y);
        halves.forEach((h, k) => out.push(shapeTarget(out.length, s.d, `${k ? "нижняя" : "верхняя"} половина: ${name}`, h, true)));
        return;
      }
    }
    out.push(shapeTarget(out.length, s.d, name, geo[si].pts, /полуовал/.test(name)));
  });
  return out;
}

/** A part standing on target t. */
function partOn(t, i = t.i) {
  return t.line
    ? { i, line: true, pa: { ...t.line.a }, pb: { ...t.line.b }, len: t.len, name: t.name, slant: isSlanted({ line: true, pa: t.line.a, pb: t.line.b }) }
    : { i, line: false, pts: t.pts, key: t.key, cx: t.cx, cy: t.cy, half: t.half, flip: t.flip, len: t.len, name: t.name, off: Z(), mirror: false };
}

/** The parts of a letter, all in place. */
export function letterParts(card) {
  return letterTargets(card).map((t) => partOn(t));
}

/** Where a shape part's outline points are now (moved, maybe mirrored about its own middle). */
export function shapePoints(p, pts = p.key) {
  const fx = p.mirror && p.flip !== "y", fy = p.mirror && p.flip === "y";
  return pts.map((q) => ({ x: (fx ? 2 * p.cx - q.x : q.x) + p.off.x, y: (fy ? 2 * p.cy - q.y : q.y) + p.off.y }));
}

/** How far part p is from standing on target t (Infinity: different kind of stroke or shape). */
export function matchDistance(p, t) {
  if (p.line !== Boolean(t.line)) return Infinity;
  if (p.line) {
    const { a, b } = t.line;
    return Math.min(Math.max(dist(p.pa, a), dist(p.pb, b)), Math.max(dist(p.pa, b), dist(p.pb, a)));
  }
  if (Math.abs(p.len - t.len) > 2) return Infinity;
  const cur = shapePoints(p);
  let fwd = 0, back = 0;
  for (let k = 0; k < KEY_N; k++) {
    fwd = Math.max(fwd, dist(cur[k], t.key[k]));
    back = Math.max(back, dist(cur[k], t.key[KEY_N - 1 - k]));
  }
  return Math.min(fwd, back);
}

/** For each target, the index of the part standing on it (or -1). */
export function coverage(parts, targets) {
  const used = new Set();
  return targets.map((t) => {
    const j = parts.findIndex((p, k) => !used.has(k) && matchDistance(p, t) <= EXACT);
    if (j >= 0) used.add(j);
    return j;
  });
}

export function isSolved(parts, targets) {
  return coverage(parts, targets).every((j) => j >= 0);
}

/** Parts that stand on no target (what the idle prompt and the tests count as «broken»). */
export function looseParts(parts, targets) {
  const cov = new Set(coverage(parts, targets));
  return parts.map((p, k) => k).filter((k) => !cov.has(k));
}

/**
 * Break a letter. opts: { broken: 1 | 2 | "all", tilt, mirror, magnet }.
 * Keeps the letter recognisable (owner's condition): a broken part goes AWAY from the letter's centre
 * (±45°), not across it (otherwise Н turns into Л and ends land on other parts); a part at the very
 * centre (Н's bar, Ж's stick) goes along or across itself; at most one tilt (one end moved outwards,
 * across the stroke, no further than ~⅓ of the letter's width) and at most one mirrored half-oval (two
 * of them make В look like «Є»); every part moves further than the magnet reaches but no more than ~¼
 * of the letter's height, less when more parts are broken.
 */
export function breakLetter(card, opts = {}, rand = Math.random, tries = 0) {
  const targets = letterTargets(card);
  const parts = targets.map((t) => partOn(t));
  const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];
  const between = (a, b) => a + rand() * (b - a);
  const cand = targets.filter((t) => t.len >= MIN_LEN);
  const k = opts.broken === "all" ? cand.length : Math.max(1, Math.min(cand.length, Number(opts.broken) || 1));
  const order = cand.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)) % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  const chosen = order.slice(0, k);

  const tol = MAGNETS[opts.magnet] ?? MAGNETS.strong;
  const lo = tol + 6, hi = lo + (k > 2 ? 4 : 8);
  const W = glyphWidthOf(card);
  const C = { x: W / 2, y: 50 };
  let tilted = 0, mirrored = 0;

  for (const t of chosen) {
    const p = parts[t.i];
    const kinds = ["shift"];
    if (opts.tilt && t.line && !tilted) kinds.push("tilt");
    if (opts.mirror && !mirrored && (t.half || slantMirrorable(t, targets))) kinds.push("mirror");
    const kind = pick(kinds);
    if (kind === "tilt") {
      const { a, b } = t.line;
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      let nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
      // the end further from the centre moves, outwards
      const end = Math.hypot(a.x - C.x, a.y - C.y) >= Math.hypot(b.x - C.x, b.y - C.y) ? "a" : "b";
      const e = t.line[end];
      const out = (e.x - C.x) * nx + (e.y - C.y) * ny;
      if (out < 0 || (out === 0 && rand() < 0.5)) { nx = -nx; ny = -ny; }
      const m = Math.min(between(lo, hi), Math.max(lo, W * 0.38));
      const key = end === "a" ? "pa" : "pb";
      p[key] = { x: e.x + Math.round(nx * m), y: e.y + Math.round(ny * m) };
      p.broke = "tilt"; p.moved = { x: Math.round(nx * m), y: Math.round(ny * m) };
      tilted++;
    } else if (kind === "mirror") {
      if (p.line) Object.assign(p, mirrorLine(p)); else p.mirror = true;
      p.broke = "mirror";
      mirrored++;
    } else {
      const dx = t.cx - C.x, dy = t.cy - C.y;
      const base = Math.hypot(dx, dy) > 6
        ? Math.atan2(dy, dx)
        : (t.wide ? pick([-Math.PI / 2, Math.PI / 2]) : pick([0, Math.PI]));
      const ang = base + between(-Math.PI / 4, Math.PI / 4);
      const m = between(lo, hi);
      const v = { x: Math.round(Math.cos(ang) * m), y: Math.round(Math.sin(ang) * m) };
      // rounding can bring a short move back inside the magnet — push it out again
      if (vlen(v) <= tol) { const s = (tol + 1) / (vlen(v) || 1); v.x = Math.round(v.x * s) || tol + 1; v.y = Math.round(v.y * s); }
      if (p.line) { p.pa = { x: t.line.a.x + v.x, y: t.line.a.y + v.y }; p.pb = { x: t.line.b.x + v.x, y: t.line.b.y + v.y }; } else p.off = v;
      p.broke = "shift"; p.moved = v;
    }
  }
  // A moved part may have landed on a twin's place (Е's bars, Ш's sticks are the same shape): it must
  // still look broken — otherwise the letter would come out whole, or with a hole the child can't see.
  if (looseParts(parts, targets).length < chosen.length && tries < 20) return breakLetter(card, opts, rand, tries + 1);
  return parts;
}

/** A straight part that is neither vertical nor horizontal. */
export function isSlanted(p) {
  return Boolean(p?.line) && Math.abs(p.pa.x - p.pb.x) > 1 && Math.abs(p.pa.y - p.pb.y) > 1;
}

/** Does a tap mirror this part? A half-oval, or a straight stroke slanted in the letter itself (И's
 *  diagonal, Л's legs) — not a stick or bar that only stands slanted because it was tilted. */
export function tapMirrors(p) {
  return Boolean(p?.half) || (Boolean(p?.slant) && isSlanted(p));
}

/** Straight part p mirrored about the vertical through its middle: «/» ↔ «\». A new object. */
export function mirrorLine(p) {
  const mx = (p.pa.x + p.pb.x) / 2;
  return { ...p, pa: { x: 2 * mx - p.pa.x, y: p.pa.y }, pb: { x: 2 * mx - p.pb.x, y: p.pb.y } };
}

const onStroke = (q, targets, self) =>
  targets.some((o) => o.i !== self && o.pts.some((r, k) => k > 0 && segDist(q, o.pts[k - 1], r) <= 1.5));
function segDist(q, a, b) {
  const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1;
  const f = Math.max(0, Math.min(1, ((q.x - a.x) * vx + (q.y - a.y) * vy) / L2));
  return Math.hypot(q.x - (a.x + f * vx), q.y - (a.y + f * vy));
}

/**
 * Can target t be broken by mirroring its slant? Only a slanted straight stroke whose mirrored copy keeps
 * BOTH ends on the other strokes, as the stroke itself does (И, Й: the diagonal between the two sticks),
 * and is not the place of another stroke (Х's diagonals are each other's mirror — that would be no break).
 */
export function slantMirrorable(t, targets) {
  if (!t.line) return false;
  const p = { line: true, pa: t.line.a, pb: t.line.b };
  if (!isSlanted(p)) return false;
  const f = mirrorLine(p);
  if (!onStroke(f.pa, targets, t.i) || !onStroke(f.pb, targets, t.i)) return false;
  const fp = { ...f, line: true };
  return !targets.some((o) => o.line && matchDistance(fp, o) <= EXACT);
}

/** Where a straight part's ends are now. */
export function partEnds(p) {
  return { a: p.pa, b: p.pb };
}

/** What a drag that starts at point `at` on part `p` moves: "a" / "b" (one end) or "body". */
export function grabRole(p, at) {
  if (!p.line) return "body";
  const da = dist(at, p.pa), db = dist(at, p.pb);
  const zone = Math.max(12, 0.25 * dist(p.pa, p.pb));
  if (Math.min(da, db) > zone) return "body";
  return da <= db ? "a" : "b";
}

/** The part moved by (dx, dy) — a new object. */
export function moved(p, role, dx, dy) {
  if (!p.line) return { ...p, off: { x: p.off.x + dx, y: p.off.y + dy } };
  return {
    ...p,
    pa: role === "b" ? p.pa : { x: p.pa.x + dx, y: p.pa.y + dy },
    pb: role === "a" ? p.pb : { x: p.pb.x + dx, y: p.pb.y + dy },
  };
}

/**
 * Where a let-go part snaps: the nearest target it matches within the magnet that no OTHER part stands
 * on (shape, not index — any of Е's three bars fits any bar's place). Returns the part standing exactly
 * on that target (a new object), or null when nothing is near.
 */
export function snapTarget(parts, i, targets, magnet) {
  const tol = MAGNETS[magnet] ?? MAGNETS.strong;
  const p = parts[i];
  const others = parts.filter((_, k) => k !== i);
  let best = null, bestD = Infinity;
  for (const t of targets) {
    const d = matchDistance(p, t);
    if (d > tol || d >= bestD) continue;
    if (others.some((q) => matchDistance(q, t) <= EXACT)) continue;   // taken
    best = t; bestD = d;
  }
  if (!best) return null;
  if (bestD <= EXACT) return null;                                   // already there
  if (p.line) {
    const { a, b } = best.line;
    // keep the part's own direction: its end that is nearer a goes to a
    const same = Math.max(dist(p.pa, a), dist(p.pb, b)) <= Math.max(dist(p.pa, b), dist(p.pb, a));
    return { ...p, pa: { ...(same ? a : b) }, pb: { ...(same ? b : a) } };
  }
  return { ...p, pts: best.pts, key: best.key, cx: best.cx, cy: best.cy, half: best.half, flip: best.flip, off: Z(), mirror: false };
}
