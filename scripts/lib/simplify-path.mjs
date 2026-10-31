// Fewer Bézier segments for a glyph stroke traced too densely (the Bulgarian letters, traced from a font: segments ~0.4 units long,
// 4-6x the points of a hand-captured Russian letter, and every page, tile and thumbnail draws them). A run of smooth cubic segments is
// refitted with as few cubics as keep every point within `tol` of the original (Schneider, "An algorithm for automatically fitting
// digitized curves", Graphics Gems 1990). Kept exactly: the stroke's start and end, the direction it leaves the start and arrives at
// the end (joins read them), every corner (a turn sharper than CORNER_DEG between two segments), every straight `L`, the stroke count.
// Input / output: an SVG path of M, C and L commands, as the glyph banks hold them.

const CORNER_DEG = 30;
const NUM = /-?\d*\.?\d+(?:[eE][+-]?\d+)?/g;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);
const dist = (a, b) => len(sub(a, b));
const norm = (a) => { const l = len(a); return l > 1e-9 ? [a[0] / l, a[1] / l] : [0, 0]; };

function parse(d) {
  const tokens = String(d).match(/[MCLmcl]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) ?? [];
  const segs = [];
  let start = null, cur = null, i = 0, cmd = null;
  const num = () => Number(tokens[i++]);
  const pt = () => [num(), num()];
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === "M") { if (start) return null; start = pt(); cur = start; cmd = "L"; continue; }
    if (cmd === "C") { const c1 = pt(), c2 = pt(), p3 = pt(); segs.push({ type: "C", p0: cur, c1, c2, p3 }); cur = p3; continue; }
    if (cmd === "L") { const p = pt(); segs.push({ type: "L", p0: cur, p3: p }); cur = p; continue; }
    return null; // relative or other commands: not ours, leave the stroke alone
  }
  return start ? { start, segs } : null;
}

const bez = (p0, c1, c2, p3, t) => {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]];
};
const bezD1 = ([p0, c1, c2, p3], t) => {
  const u = 1 - t;
  return add(add(mul(sub(c1, p0), 3 * u * u), mul(sub(c2, c1), 6 * u * t)), mul(sub(p3, c2), 3 * t * t));
};
const bezD2 = ([p0, c1, c2, p3], t) => add(mul(add(sub(c2, mul(c1, 2)), p0), 6 * (1 - t)), mul(add(sub(p3, mul(c2, 2)), c1), 6 * t));

// the direction a segment leaves its start / arrives at its end (a zero handle falls back to the next control point)
const outDir = (s) => norm(s.type === "L" ? sub(s.p3, s.p0) : dist(s.c1, s.p0) > 1e-6 ? sub(s.c1, s.p0) : dist(s.c2, s.p0) > 1e-6 ? sub(s.c2, s.p0) : sub(s.p3, s.p0));
const inDir = (s) => norm(s.type === "L" ? sub(s.p3, s.p0) : dist(s.p3, s.c2) > 1e-6 ? sub(s.p3, s.c2) : dist(s.p3, s.c1) > 1e-6 ? sub(s.p3, s.c1) : sub(s.p3, s.p0));

function samples(run, per = 10) {
  const pts = [run[0].p0];
  for (const s of run) for (let k = 1; k <= per; k++) pts.push(bez(s.p0, s.c1, s.c2, s.p3, k / per));
  return pts;
}

function chordParams(pts) {
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + dist(pts[i], pts[i - 1]));
  const total = u[u.length - 1] || 1;
  return u.map((x) => x / total);
}

function generate(pts, u, tL, tR) {
  const first = pts[0], last = pts[pts.length - 1];
  const C = [[0, 0], [0, 0]], X = [0, 0];
  u.forEach((t, i) => {
    const b1 = 3 * t * (1 - t) ** 2, b2 = 3 * t * t * (1 - t);
    const a1 = mul(tL, b1), a2 = mul(tR, b2);
    C[0][0] += dot(a1, a1); C[0][1] += dot(a1, a2); C[1][1] += dot(a2, a2);
    const tmp = sub(pts[i], bez(first, first, last, last, t));
    X[0] += dot(a1, tmp); X[1] += dot(a2, tmp);
  });
  C[1][0] = C[0][1];
  const det = C[0][0] * C[1][1] - C[0][1] * C[1][0];
  let aL = det ? (X[0] * C[1][1] - X[1] * C[0][1]) / det : 0;
  let aR = det ? (C[0][0] * X[1] - C[1][0] * X[0]) / det : 0;
  const seg = dist(first, last), eps = 1e-6 * seg;
  if (aL < eps || aR < eps) { aL = aR = seg / 3; }
  return [first, add(first, mul(tL, aL)), add(last, mul(tR, aR)), last];
}

function maxError(curve, pts, u) {
  let max = 0, at = Math.floor(pts.length / 2);
  pts.forEach((p, i) => { const d = dist(bez(...curve, u[i]), p); if (d > max) { max = d; at = i; } });
  return { max, at };
}

function reparam(curve, pts, u) {
  return u.map((t, i) => {
    const d = sub(bez(...curve, t), pts[i]);
    const d1 = bezD1(curve, t), d2 = bezD2(curve, t);
    const den = dot(d1, d1) + dot(d, d2);
    const nt = den ? t - dot(d, d1) / den : t;
    return Math.min(1, Math.max(0, nt));
  });
}

function fit(pts, tL, tR, tol, out) {
  if (pts.length === 2) {
    const s = dist(pts[0], pts[1]) / 3;
    out.push([pts[0], add(pts[0], mul(tL, s)), add(pts[1], mul(tR, s)), pts[1]]);
    return;
  }
  let u = chordParams(pts);
  let curve = generate(pts, u, tL, tR);
  let { max, at } = maxError(curve, pts, u);
  if (max <= tol) { out.push(curve); return; }
  if (max <= tol * 4) {
    for (let k = 0; k < 20; k++) {
      u = reparam(curve, pts, u);
      curve = generate(pts, u, tL, tR);
      ({ max, at } = maxError(curve, pts, u));
      if (max <= tol) { out.push(curve); return; }
    }
  }
  at = Math.min(Math.max(at, 1), pts.length - 2);
  const tC = norm(sub(pts[at - 1], pts[at + 1]));
  fit(pts.slice(0, at + 1), tL, tC, tol, out);
  fit(pts.slice(at), mul(tC, -1), tR, tol, out);
}

// How far `b` strays from `a` (both paths): the largest distance from a point along `a` to the nearest point along `b`.
export function pathDeviation(a, b) {
  const poly = (d) => { const p = parse(d); if (!p) return []; const pts = [p.start]; for (const s of p.segs) { if (s.type === "L") { for (let k = 1; k <= 10; k++) pts.push(add(s.p0, mul(sub(s.p3, s.p0), k / 10))); } else for (let k = 1; k <= 24; k++) pts.push(bez(s.p0, s.c1, s.c2, s.p3, k / 24)); } return pts; };
  const pa = poly(a), pb = poly(b);
  const segDist = (p, q, r) => { const qr = sub(r, q); const l2 = dot(qr, qr); const t = l2 ? Math.min(1, Math.max(0, dot(sub(p, q), qr) / l2)) : 0; return dist(p, add(q, mul(qr, t))); };
  let max = 0;
  for (const p of pa) { let m = Infinity; for (let i = 1; i < pb.length; i++) m = Math.min(m, segDist(p, pb[i - 1], pb[i])); if (m > max) max = m; }
  return max;
}

const fmt = (v) => (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, "").replace(/^-0$/, "0");
const ptStr = (p) => `${fmt(p[0])} ${fmt(p[1])}`;

export function simplifyPathD(d, tol) {
  const parsed = parse(d);
  if (!parsed || parsed.segs.length < 3) return d;
  const { start, segs } = parsed;
  // runs of smooth cubic segments, cut at every L and every corner
  const pieces = [];
  let run = [];
  const flush = () => { if (run.length) pieces.push({ run }); run = []; };
  segs.forEach((s, i) => {
    if (s.type === "L") { flush(); pieces.push({ line: s }); return; }
    if (run.length) {
      const turn = (Math.acos(Math.max(-1, Math.min(1, dot(inDir(run[run.length - 1]), outDir(s))))) * 180) / Math.PI;
      if (turn > CORNER_DEG) flush();
    }
    run.push(s);
  });
  flush();
  let out = `M ${ptStr(start)}`;
  for (const p of pieces) {
    if (p.line) { out += ` L ${ptStr(p.line.p3)}`; continue; }
    if (p.run.length === 1) { const s = p.run[0]; out += ` C ${ptStr(s.c1)} ${ptStr(s.c2)} ${ptStr(s.p3)}`; continue; }
    const curves = [];
    fit(samples(p.run), outDir(p.run[0]), mul(inDir(p.run[p.run.length - 1]), -1), tol, curves);
    const runD = (list) => `M ${ptStr(list[0][0])}` + list.map((c) => ` C ${ptStr(c[1])} ${ptStr(c[2])} ${ptStr(c[3])}`).join("");
    const original = p.run.map((s) => [s.p0, s.c1, s.c2, s.p3]);
    // a run the fit could not follow (a stroke doubling back on itself inside one smooth run): kept as it was
    const fitted = pathDeviation(runD(original), runD(curves)) <= 2 * tol && pathDeviation(runD(curves), runD(original)) <= 2 * tol ? curves : original;
    for (const c of fitted) out += ` C ${ptStr(c[1])} ${ptStr(c[2])} ${ptStr(c[3])}`;
  }
  return out;
}

// Every stroke of every glyph simplified; returns the glyphs and what it did (numbers before / after, the worst deviation).
export function simplifyGlyphs(glyphs, tol) {
  let before = 0, after = 0, worst = { dev: 0, label: null };
  const result = glyphs.map((g) => ({
    ...g,
    strokes: (g.strokes ?? []).map((s) => {
      if (!s?.d) return s;
      const d = simplifyPathD(s.d, tol);
      before += s.d.match(NUM)?.length ?? 0;
      after += d.match(NUM)?.length ?? 0;
      const dev = d === s.d ? 0 : pathDeviation(s.d, d);
      if (dev > worst.dev) worst = { dev, label: g.label };
      return { ...s, d };
    }),
  }));
  return { glyphs: result, before, after, worst };
}
