// One-off cleaner for the bottom hook of the "Широкая строка" glyphs (tools/propis/wide.json).
//
// The captured hook is a straight stem, a bottom arc made of many short quadratic pieces, and a
// straight closing rise. The stem and the rise meet at a narrow V (~17deg), so the capture's arc is
// a very tight U-turn whose curvature jumps from 0 to its maximum at the stem and is lumpy along the
// arc -- invisible in the workshop, obvious on the sheet. This replaces the arc by ONE cubic that
// leaves the stem and joins the rise tangentially (G1), picks the longest hand-off that still fits
// on the stem/rise and keeps the bottom exactly where the capture's own was, so the curvature ramps
// up and down smoothly instead of jumping.
//
// Usage: node scripts/propis-smooth-hook.mjs 6 г1
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "tools/propis/wide.json";
const labels = process.argv.slice(2);
if (!labels.length) { console.error("usage: node scripts/propis-smooth-hook.mjs <label>..."); process.exit(1); }

// d -> [{cmd, pts}] with absolute coordinates (M, L, Q only: what the capture tool exports)
function parse(d) {
  const t = d.match(/[MLQC]|-?\d*\.?\d+/g);
  const segs = [];
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    const n = { M: 2, L: 2, Q: 4, C: 6 }[cmd];
    segs.push({ cmd, pts: t.slice(i, i + n).map(parseFloat) });
    i += n;
  }
  return segs;
}
const endOf = (s) => [s.pts[s.pts.length - 2], s.pts[s.pts.length - 1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => { const l = len(v); return [v[0] / l, v[1] / l]; };
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
}
function peakCurvatureAndLowest(p0, p1, p2, p3) {
  let peak = 0;
  let lowest = -Infinity;
  let kStart = 0;
  let kEnd = 0;
  const N = 200;
  for (let i = 0; i <= N; i += 1) {
    const t = i / N;
    const u = 1 - t;
    const d1 = [0, 1].map((k) => 3 * u * u * (p1[k] - p0[k]) + 6 * u * t * (p2[k] - p1[k]) + 3 * t * t * (p3[k] - p2[k]));
    const d2 = [0, 1].map((k) => 6 * u * (p2[k] - 2 * p1[k] + p0[k]) + 6 * t * (p3[k] - 2 * p2[k] + p1[k]));
    const kappa = Math.abs(cross(d1, d2)) / Math.max(len(d1) ** 3, 1e-9);
    if (kappa > peak) peak = kappa;
    if (i === 0) kStart = kappa;
    if (i === N) kEnd = kappa;
    const y = bez(p0, p1, p2, p3, t)[1];
    if (y > lowest) lowest = y;
  }
  return { peak, lowest, kStart, kEnd };
}

const data = JSON.parse(readFileSync(PATH, "utf-8"));
for (const label of labels) {
  const g = data.glyphs.find((x) => x.label === label);
  if (!g) throw new Error(`no glyph ${label}`);
  const segs = parse(g.strokes[0].d);
  // tail = the last L; stem = the last L before it (everything between them is the bottom arc)
  const tailIdx = segs.length - 1;
  if (segs[tailIdx].cmd !== "L") throw new Error(`${label}: last piece is not a straight rise`);
  // the capture also has tiny L pieces inside the arc; the stem is the last LONG straight piece
  let stemIdx = tailIdx - 1;
  const chord = (i) => len(sub(endOf(segs[i]), endOf(segs[i - 1])));
  while (stemIdx > 1 && !(segs[stemIdx].cmd === "L" && chord(stemIdx) > 10)) stemIdx -= 1;
  const P = endOf(segs[stemIdx - 1]);
  const A0 = endOf(segs[stemIdx]);
  const B0 = endOf(segs[tailIdx - 1]);
  const E = endOf(segs[tailIdx]);
  const d1 = unit(sub(A0, P)); // stem direction (down-left)
  const u = unit(sub(E, B0)); // rise direction (up-right)
  // V = intersection of the two lines: P + s*d1 = B0 + r*u
  const denom = cross(d1, u);
  const s = cross(sub(B0, P), u) / denom;
  const V = [P[0] + s * d1[0], P[1] + s * d1[1]];
  const sA0 = len(sub(V, A0)); // corner -> where the capture's arc leaves the stem
  const sB0 = len(sub(V, B0)); // corner -> where it joins the rise
  const lowestOriginal = Math.max(...segs.slice(stemIdx, tailIdx).flatMap((q) => q.pts.filter((_, i) => i % 2 === 1)));
  // The hand-off may start a little UP the stem / further along the rise than the capture's own, so
  // the curvature has room to ramp (at most MAX_EAT units of straight line given up per side), but
  // the stem stays straight for the rest of its length: it has to keep following its slant line.
  const MAX_EAT_STEM = 14;
  const MAX_EAT_RISE = 10;
  const stemRoom = len(sub(V, P)) - 12;
  const riseRoom = len(sub(E, V)) - 6;
  let best = null;
  for (let eatA = 0; eatA <= MAX_EAT_STEM; eatA += 1) {
    for (let eatB = 0; eatB <= MAX_EAT_RISE; eatB += 1) {
      const Ts = sA0 + eatA;
      const Tt = sB0 + eatB;
      if (Ts > stemRoom || Tt > riseRoom) continue;
      const A = [V[0] - d1[0] * Ts, V[1] - d1[1] * Ts];
      const B = [V[0] + u[0] * Tt, V[1] + u[1] * Tt];
      for (let l1 = 0.15; l1 <= 1.3; l1 += 0.025) {
        for (let l2 = 0.15; l2 <= 1.3; l2 += 0.025) {
          const p1 = [A[0] + d1[0] * l1 * Ts, A[1] + d1[1] * l1 * Ts];
          const p2 = [B[0] - u[0] * l2 * Tt, B[1] - u[1] * l2 * Tt];
          const { peak, lowest, kStart, kEnd } = peakCurvatureAndLowest(A, p1, p2, B);
          // the hook must still touch the baseline where the capture did (+-0.3 units)
          if (Math.abs(lowest - lowestOriginal) > 0.3) continue;
          // smooth = low peak AND the curvature starts/ends near 0 (it ramps instead of jumping at the stem/rise)
          const cost = peak + 2 * (kStart + kEnd);
          if (!best || cost < best.cost) best = { eatA, eatB, l1, l2, peak, kStart, kEnd, cost, A, B, p1, p2 };
        }
      }
    }
  }
  if (!best) throw new Error(`${label}: no smooth fit`);
  const f = (n) => Number(n.toFixed(2));
  const out = [];
  segs.slice(0, stemIdx).forEach((q) => out.push(q.cmd, ...q.pts.map(f)));
  out.push("L", f(best.A[0]), f(best.A[1]));
  out.push("C", f(best.p1[0]), f(best.p1[1]), f(best.p2[0]), f(best.p2[1]), f(best.B[0]), f(best.B[1]));
  out.push("L", f(E[0]), f(E[1]));
  console.log(`${label}: arc starts ${best.eatA} units higher on the stem and ${best.eatB} further along the rise; handles ${best.l1.toFixed(2)}/${best.l2.toFixed(2)}; peak curvature ${best.peak.toFixed(3)} (tightest radius ${(1 / best.peak).toFixed(1)}), curvature at stem/rise ends ${best.kStart.toFixed(3)}/${best.kEnd.toFixed(3)}`);
  g.strokes[0].d = out.join(" ");
  g.smoothedHook = true;
}
writeFileSync(PATH, JSON.stringify(data, null, 2));
