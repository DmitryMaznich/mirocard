// «Пишу на экране» (print_letters, mode screen_write): stroke checking, no DOM.
// Method and the owner's decisions: docs/print-letters-screen-writing.md.
//
// Units are the glyph's own cell coordinates from tools/print_letters/topic.json: a letter is 100
// units tall (two 5mm cells), 50 per cell. Paths there use only absolute M, L and C.
//
// «Обвожу» (trace): the child starts at the stroke's start dot and runs along a track of half-width
// `t`. Progress is the nearest path sample inside a small window ahead of the current one, so the
// finger can neither jump ahead (О starts and ends at the same point) nor go backwards. The stroke
// BURNS (owner, 2026-11-03/04) when the finger leaves the track or is lifted before the end; it is
// then written again from the start. «Сам» (free): the line is free and checked after the lift.

export const TRACE_TUNING = {
  widths: { wide: 14, mid: 10, narrow: 7 }, // half-width of the track
  step: 1,               // path sample spacing
  look: 24,              // how far ahead of the current progress the finger may be matched
  back: 3,               // … and behind it (jitter at a corner)
  out: 1.25,             // farther than out·t from the path → the stroke burns
  endSlack: 0.06,        // the stroke counts when less than 6% of its length is left …
  endSlackMin: 3,        // … but never less than 3 units
  startFactor: 1.6,      // a touch counts within max(startFactor·t, startMin) of the start dot
  startMin: 14,
  dotLength: 4,          // a stroke shorter than this is a dot (Ё) — a touch writes it
  freeFactor: 1.15,      // «Сам»: tolerance = freeFactor·t …
  freeEnds: 2.2,         // start and end within freeEnds·tol of the model's ends (this is the direction check)
  freeMean: 1.2,         // mean distance of the line from the path ≤ freeMean·tol
  freeCover: 2,          // every checkpoint of the path within freeCover·tol of the line
  freeCheckpoints: 20,
  idleNudgeMs: 6000,     // idle → the start dot pulses
  idleDemoMs: 12000,     // idle longer → the dot writes the stroke once (counts as a prompt)
  burnsBeforeDemo: 2,    // this many burns in a row on one stroke → the dot writes it once
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Parse an absolute M/L/C path into segments. */
export function parsePath(d) {
  const tokens = String(d).match(/[MLC]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const segs = [];
  let cmd = null; let cur = null; let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/^[MLC]$/i.test(tokens[i])) cmd = tokens[i++].toUpperCase();
    if (cmd === "M") { cur = { x: num(), y: num() }; cmd = "L"; continue; }
    if (cmd === "L") { const p = { x: num(), y: num() }; segs.push({ type: "L", a: cur, b: p }); cur = p; continue; }
    if (cmd === "C") {
      const c1 = { x: num(), y: num() }, c2 = { x: num(), y: num() }, p = { x: num(), y: num() };
      segs.push({ type: "C", a: cur, c1, c2, b: p }); cur = p; continue;
    }
    i++; // unknown token — skip
  }
  if (!segs.length && cur) segs.push({ type: "L", a: cur, b: cur });
  return segs;
}

function cubicAt(s, t) {
  const u = 1 - t;
  return {
    x: u * u * u * s.a.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.b.x,
    y: u * u * u * s.a.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.b.y,
  };
}

/** The path as points every `step` units of arc length, from its start to its end. */
export function samplePath(d, step = TRACE_TUNING.step) {
  const dense = [];
  for (const s of parsePath(d)) {
    if (!dense.length) dense.push(s.a);
    if (s.type === "L") dense.push(s.b);
    else for (let k = 1; k <= 64; k++) dense.push(cubicAt(s, k / 64));
  }
  const cum = [0];
  for (let k = 1; k < dense.length; k++) cum.push(cum[k - 1] + dist(dense[k - 1], dense[k]));
  const length = cum[cum.length - 1] ?? 0;
  const n = Math.max(1, Math.ceil(length / step));
  const pts = [];
  let j = 1;
  for (let k = 0; k <= n; k++) {
    const target = (length * k) / n;
    while (j < dense.length - 1 && cum[j] < target) j++;
    const a = dense[Math.max(0, j - 1)], b = dense[Math.min(j, dense.length - 1)];
    const span = cum[j] - cum[Math.max(0, j - 1)];
    const f = span > 0 ? (target - cum[j - 1]) / span : 0;
    pts.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return { pts, length };
}

/**
 * The letter as the screen shows it (owner, 2026-11-04): on the ordinary notebook grid, 2 cells tall;
 * a wide letter (⅔ of Ilyukhina's letter-cell in topic.json, 1⅓ cells — Т Ш Ж Ф М Л А Д Щ Ю Ы Ъ) is
 * 1½ cells wide, close to her proportion, so its middle stick lands on the ruler tick at ¾ of a cell
 * instead of a third the child must find by eye. Only x is scaled; the printed sheets keep topic.json.
 */
export const SCREEN_WIDE_WIDTH = 75;
export function screenGlyph(card) {
  const w = Number(String(card?.viewBox ?? "0 0 50 100").split(/\s+/)[2]) || 50;
  if (!(w > 51)) return card;
  const k = SCREEN_WIDE_WIDTH / w;
  const scale = (d) => {
    let i = 0;
    return String(d).replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (m) => {
      const v = Number(m);
      // x of every x,y pair; topic.json writes ⅓ as 33.333 — snap the product back onto the quarter-unit
      const x = v * k, snapped = Math.round(x * 4) / 4;
      const out = i % 2 === 0 ? (Math.abs(x - snapped) < 0.02 ? snapped : Math.round(x * 1000) / 1000) : v;
      i += 1;
      return String(out);
    });
  };
  return { ...card, viewBox: `0 0 ${SCREEN_WIDE_WIDTH} 100`, strokes: card.strokes.map((st) => ({ ...st, d: scale(st.d) })) };
}

/** Geometry of every stroke of a letter card. */
export function strokeGeometry(card) {
  return (card?.strokes ?? []).map((s) => {
    const { pts, length } = samplePath(s.d);
    return { pts, length, isDot: length < TRACE_TUNING.dotLength };
  });
}

export function halfWidth(width) {
  return TRACE_TUNING.widths[width] ?? TRACE_TUNING.widths.wide;
}

// Short strokes (the tails of Д Ц Щ, the bar of Ъ, ~18 units) are shorter than the usual start
// radius and look-ahead window: both shrink with the stroke, or a finger starting at the stroke's END
// would count it at once.
const shortCap = (geo, v, f, min = 4) => Math.min(v, Math.max(min, geo.length * f));

/** May a touch at `p` begin this stroke (on «Обвожу»)? */
export function canStart(geo, p, t) {
  const r = shortCap(geo, Math.max(TRACE_TUNING.startFactor * t, TRACE_TUNING.startMin), 0.5, 6);
  return dist(p, geo.pts[0]) <= r;
}

function endIndex(geo) {
  const last = geo.pts.length - 1;
  return last - Math.max(TRACE_TUNING.endSlackMin, Math.round(geo.length * TRACE_TUNING.endSlack));
}

/**
 * Follows one finger along one stroke on «Обвожу». `push(p)` returns "move", "done" or "burn";
 * `lift()` returns "done" or "burn" (lifted too early). Call only after canStart().
 */
export function createTracer(geo, t) {
  let k = 0;
  let state = geo.isDot ? "done" : "move";
  return {
    get progress() { return k; },
    get state() { return state; },
    push(p) {
      if (state !== "move") return state;
      let best = -1, bd = Infinity;
      const hi = Math.min(geo.pts.length - 1, k + Math.round(shortCap(geo, TRACE_TUNING.look, 0.3)));
      for (let i = Math.max(0, k - TRACE_TUNING.back); i <= hi; i++) {
        const d = dist(p, geo.pts[i]);
        if (d < bd) { bd = d; best = i; }
      }
      if (bd > TRACE_TUNING.out * t) { state = "burn"; return state; }
      if (best > k) k = best;
      if (k >= endIndex(geo)) state = "done";
      return state;
    },
    lift() {
      if (state === "move") state = k >= endIndex(geo) ? "done" : "burn";
      return state;
    },
  };
}

function minDist(p, pts) {
  let m = Infinity;
  for (const q of pts) { const d = dist(p, q); if (d < m) m = d; }
  return m;
}

/** «Сам»: does the finished line `raw` write this stroke (right place, right direction, whole)? */
export function matchFreeStroke(raw, geo, t) {
  const T = TRACE_TUNING; const tol = t * T.freeFactor;
  if (!raw?.length) return false;
  if (geo.isDot) return minDist(raw[0], geo.pts) <= tol * T.freeEnds;
  if (raw.length < 3) return false;
  const s = geo.pts[0], f = geo.pts[geo.pts.length - 1];
  const ends = shortCap(geo, tol * T.freeEnds, 0.35), cover = shortCap(geo, tol * T.freeCover, 0.35);
  if (dist(raw[0], s) > ends || dist(raw[raw.length - 1], f) > ends) return false;
  let sum = 0;
  for (const r of raw) sum += minDist(r, geo.pts);
  if (sum / raw.length > tol * T.freeMean) return false;
  for (let c = 0; c <= T.freeCheckpoints; c++) {
    const q = geo.pts[Math.round((c / T.freeCheckpoints) * (geo.pts.length - 1))];
    if (minDist(q, raw) > cover) return false;
  }
  // direction along the way, not only at the ends (О starts and ends at the same point): points of
  // the line at 20/40/60/80% of its length must fall on the path in that same order
  const seq = [0.2, 0.4, 0.6, 0.8].map((f) => nearestIndex(pointAtFraction(raw, f), geo.pts));
  const slack = Math.round(geo.pts.length * 0.1);
  for (let i = 1; i < seq.length; i++) if (seq[i] < seq[i - 1] - slack) return false;
  return true;
}

function nearestIndex(p, pts) {
  let best = 0, bd = Infinity;
  pts.forEach((q, i) => { const d = dist(p, q); if (d < bd) { bd = d; best = i; } });
  return best;
}

function pointAtFraction(pts, f) {
  const total = polyLength(pts); let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (acc + d >= total * f) {
      const r = d > 0 ? (total * f - acc) / d : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * r, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * r };
    }
    acc += d;
  }
  return pts[pts.length - 1];
}

/** SVG path data for a list of points (a single point gets a tiny segment so a round cap shows). */
export function polyD(pts, to = pts.length - 1) {
  if (!pts.length) return "";
  const f = (v) => Math.round(v * 100) / 100;
  if (to < 1) return `M ${f(pts[0].x)} ${f(pts[0].y)} l 0.01 0`;
  let s = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i <= to; i++) s += ` L ${f(pts[i].x)} ${f(pts[i].y)}`;
  return s;
}

export function polyLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  return L;
}
