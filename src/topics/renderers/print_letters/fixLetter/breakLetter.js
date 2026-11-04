import { strokeGeometry } from "../screenWrite/traceEngine";

// «Почини букву» (mode fix_letter, docs/print-letters-fix-letter.md): a letter with some of its strokes
// knocked out of place; the child puts them back. This module holds the pure part — which strokes break
// and how, where a part is now, when it is back in place — so it can be tested on every letter.
//
// A part is one stroke of the glyph (the same strokes the sheets and «Пишу на экране» use):
//  - a straight stroke (`M x,y L x,y`) is two ends, each with its own offset from its place (ea, eb):
//    the middle drags both, near an end drags that end (owner, 2026-11-04: «все части должны двигаться
//    и передвигаться концы; когда один конец — это непонятно»);
//  - any other stroke (an oval, a half-oval, К's corner) moves whole (off); a half-oval can also be
//    mirrored (a tap turns it back). Ovals are never cut in halves: О С Э are written in one movement.
// Every part moves, the whole ones too — which are broken is seen only against the sample.

export const MAGNETS = { strong: 14, normal: 9 };     // a part let go this close to its place snaps in
const MIN_LEN = 20;                                    // Ё's dots and Й's breve are too small to drag
const STRAIGHT = /^\s*M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*L\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*$/i;

const Z = () => ({ x: 0, y: 0 });
export const vlen = (v) => Math.hypot(v.x, v.y);

export function glyphWidthOf(card) {
  return Number(String(card?.viewBox ?? "0 0 50 100").split(/\s+/)[2]) || 50;
}

function bboxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The parts of a letter, all in place. */
export function letterParts(card) {
  const geo = strokeGeometry(card);
  return card.strokes.map((s, i) => {
    const m = String(s.d).match(STRAIGHT);
    const bb = bboxOf(geo[i].pts);
    return {
      i,
      d: s.d,
      name: s.name ?? "",
      pts: geo[i].pts,
      len: geo[i].length,
      line: m ? { a: { x: +m[1], y: +m[2] }, b: { x: +m[3], y: +m[4] } } : null,
      cx: bb.x + bb.w / 2,
      cy: bb.y + bb.h / 2,
      wide: bb.w > bb.h,
      half: /полуовал/.test(s.name ?? ""),
      ea: Z(), eb: Z(), off: Z(), mirror: false,
    };
  });
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
export function breakLetter(card, opts = {}, rand = Math.random) {
  const parts = letterParts(card);
  const pick = (arr) => arr[Math.floor(rand() * arr.length) % arr.length];
  const between = (a, b) => a + rand() * (b - a);
  const cand = parts.filter((p) => p.len >= MIN_LEN);
  const k = opts.broken === "all" ? cand.length : Math.max(1, Math.min(cand.length, Number(opts.broken) || 1));
  // shuffle (Fisher–Yates with the given random source), take k
  const order = cand.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)) % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  const chosen = order.slice(0, k);

  const tol = MAGNETS[opts.magnet] ?? MAGNETS.strong;
  const lo = tol + 6, hi = lo + (k > 2 ? 4 : 8);
  const W = glyphWidthOf(card);
  const C = { x: W / 2, y: 50 };
  let tilted = 0, mirrored = 0;

  for (const p of chosen) {
    const kinds = ["shift"];
    if (opts.tilt && p.line && !tilted) kinds.push("tilt");
    if (opts.mirror && p.half && !mirrored) kinds.push("mirror");
    const kind = pick(kinds);
    if (kind === "tilt") {
      const { a, b } = p.line;
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      let nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
      // the end further from the centre moves, outwards
      const end = Math.hypot(a.x - C.x, a.y - C.y) >= Math.hypot(b.x - C.x, b.y - C.y) ? "a" : "b";
      const e = p.line[end];
      const out = (e.x - C.x) * nx + (e.y - C.y) * ny;
      if (out < 0 || (out === 0 && rand() < 0.5)) { nx = -nx; ny = -ny; }
      const m = Math.min(between(lo, hi), Math.max(lo, W * 0.38));
      p[end === "a" ? "ea" : "eb"] = { x: Math.round(nx * m), y: Math.round(ny * m) };
      p.broke = "tilt";
      tilted++;
    } else if (kind === "mirror") {
      p.mirror = true;
      p.broke = "mirror";
      mirrored++;
    } else {
      const dx = p.cx - C.x, dy = p.cy - C.y;
      const base = Math.hypot(dx, dy) > 6
        ? Math.atan2(dy, dx)
        : (p.wide ? pick([-Math.PI / 2, Math.PI / 2]) : pick([0, Math.PI]));
      const ang = base + between(-Math.PI / 4, Math.PI / 4);
      const m = between(lo, hi);
      const v = { x: Math.round(Math.cos(ang) * m), y: Math.round(Math.sin(ang) * m) };
      // rounding can bring a short move back inside the magnet — push it out again
      if (vlen(v) <= tol) { const s = (tol + 1) / (vlen(v) || 1); v.x = Math.round(v.x * s) || tol + 1; v.y = Math.round(v.y * s); }
      if (p.line) { p.ea = { ...v }; p.eb = { ...v }; } else p.off = v;
      p.broke = "shift";
    }
  }
  return parts;
}

export function isFixed(p) {
  return p.line ? !vlen(p.ea) && !vlen(p.eb) : !vlen(p.off) && !p.mirror;
}

/** Where a straight part's ends are now. */
export function partEnds(p) {
  return {
    a: { x: p.line.a.x + p.ea.x, y: p.line.a.y + p.ea.y },
    b: { x: p.line.b.x + p.eb.x, y: p.line.b.y + p.eb.y },
  };
}

/** What a drag that starts at point `at` on part `p` moves: "a" / "b" (one end) or "body". */
export function grabRole(p, at) {
  if (!p.line) return "body";
  const e = partEnds(p);
  const da = Math.hypot(at.x - e.a.x, at.y - e.a.y), db = Math.hypot(at.x - e.b.x, at.y - e.b.y);
  const zone = Math.max(12, 0.25 * Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y));
  if (Math.min(da, db) > zone) return "body";
  return da <= db ? "a" : "b";
}

/** The part moved by (dx, dy) — a new object. */
export function moved(p, role, dx, dy) {
  if (!p.line) return { ...p, off: { x: p.off.x + dx, y: p.off.y + dy } };
  return {
    ...p,
    ea: role === "b" ? p.ea : { x: p.ea.x + dx, y: p.ea.y + dy },
    eb: role === "a" ? p.eb : { x: p.eb.x + dx, y: p.eb.y + dy },
  };
}

/** Which offsets of a let-go part are inside the magnet (and not already zero): keys of p to snap to 0. */
export function snapKeys(p, magnet) {
  const tol = MAGNETS[magnet] ?? MAGNETS.strong;
  return (p.line ? ["ea", "eb"] : ["off"]).filter((key) => vlen(p[key]) > 0 && vlen(p[key]) <= tol);
}
