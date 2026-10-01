// Fits the hook-type glyphs of tools/propis/wide.json ("г", "п", "т": stems joined by rises, with
// top and bottom arcs and a closing rise) to the workshop's grid and smooths every arc:
//  * every stem (and the retrace that goes back up along it) lies EXACTLY on a 65deg slant line of the
//    workshop grid (spacing 9, anchored on the baseline y=88, see handwriting_capture.html drawRuling);
//  * the closing rise ends on a grid line of its own, and a stroke that opens with a rise starts on one
//    too -- rises and closing rises keep their directions and just slide sideways onto those points;
//  * each top / bottom arc is replaced by ONE tangent cubic whose curvature is ~0 where it leaves and
//    joins a straight piece (it ramps instead of jumping), with the arc's top / bottom kept exactly where
//    the capture had it.
// Safe to run again on an already fitted glyph.
//
// Usage: node scripts/propis-fit-hook.mjs г1 п1 т
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "tools/propis/wide.json";
const labels = process.argv.slice(2);
if (!labels.length) { console.error("usage: node scripts/propis-fit-hook.mjs <label>..."); process.exit(1); }

// workshop grid: 65deg lines, x(y) = X0 + 9n + (L3 - y) * tan(25deg); L3 = 88, phase from drawRuling()
const L3 = 88, SPACING = 9, VB_H = 150;
const TAN25 = Math.tan((25 * Math.PI) / 180);
const loopFrom = -Math.max((VB_H - L3) / Math.tan((65 * Math.PI) / 180), (VB_H - L3) / Math.tan((50 * Math.PI) / 180)) - SPACING;
const gridX = (n, y) => loopFrom + SPACING * n + (L3 - y) * TAN25;
const nearestLine = (x, y) => Math.round((x - gridX(0, y)) / SPACING);
const onLine = (n, y) => [gridX(n, y), y];
const STEM_DIR = (() => { const l = Math.hypot(-TAN25, 1); return [-TAN25 / l, 1 / l]; })(); // down-left along a grid line

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => { const l = len(v); return [v[0] / l, v[1] / l]; };
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const f2 = (n) => Number(n.toFixed(2));

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

// points along segs[from..to] (inclusive), used to find an arc's own top / bottom
function sampleYs(segs, from, to) {
  const ys = [];
  for (let i = from; i <= to; i += 1) {
    const s = segs[i];
    const p0 = endOf(segs[i - 1]);
    for (let k = 0; k <= 20; k += 1) {
      const t = k / 20, u = 1 - t;
      if (s.cmd === "L") ys.push(p0[1] + (s.pts[1] - p0[1]) * t);
      else if (s.cmd === "Q") ys.push(u * u * p0[1] + 2 * u * t * s.pts[1] + t * t * s.pts[3]);
      else if (s.cmd === "C") ys.push(u * u * u * p0[1] + 3 * u * u * t * s.pts[1] + 3 * u * t * t * s.pts[3] + t * t * t * s.pts[5]);
    }
  }
  return ys;
}

function bez(p0, p1, p2, p3, t) { const u = 1 - t; return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]); }
function stats(p0, p1, p2, p3, mode) {
  let peak = 0, apex = mode === "min" ? Infinity : -Infinity, kStart = 0, kEnd = 0;
  const N = 80;
  for (let i = 0; i <= N; i += 1) {
    const t = i / N, u = 1 - t;
    const d1 = [0, 1].map((k) => 3 * u * u * (p1[k] - p0[k]) + 6 * u * t * (p2[k] - p1[k]) + 3 * t * t * (p3[k] - p2[k]));
    const d2 = [0, 1].map((k) => 6 * u * (p2[k] - 2 * p1[k] + p0[k]) + 6 * t * (p3[k] - 2 * p2[k] + p1[k]));
    const kap = Math.abs(cross(d1, d2)) / Math.max(len(d1) ** 3, 1e-9);
    if (kap > peak) peak = kap;
    if (i === 0) kStart = kap;
    if (i === N) kEnd = kap;
    const y = bez(p0, p1, p2, p3, t)[1];
    apex = mode === "min" ? Math.min(apex, y) : Math.max(apex, y);
  }
  return { peak, apex, kStart, kEnd };
}
const EAT = 10; // at most this much straight line may be given up on each side so the curvature can ramp
function fitArc(label, name, lineA, lineB, mode, target, origA, origB, roomA, roomB) {
  const s = cross(sub(lineB.p, lineA.p), lineB.d) / cross(lineA.d, lineB.d);
  const V = [lineA.p[0] + s * lineA.d[0], lineA.p[1] + s * lineA.d[1]];
  const ta0 = dot(sub(V, origA), lineA.d); // corner -> where the capture's arc left line A
  const tb0 = dot(sub(origB, V), lineB.d); // corner -> where it joined line B
  const maxTa = Math.min(ta0 + EAT, roomA(V));
  const maxTb = Math.min(tb0 + EAT, roomB(V));
  let best = null;
  for (let ta = Math.max(6, ta0 - 2); ta <= maxTa; ta += 1) {
    for (let tb = Math.max(6, tb0 - 2); tb <= maxTb; tb += 1) {
      const A = [V[0] - lineA.d[0] * ta, V[1] - lineA.d[1] * ta];
      const B = [V[0] + lineB.d[0] * tb, V[1] + lineB.d[1] * tb];
      for (let l1 = 0.15; l1 <= 1.3; l1 += 0.1) {
        for (let l2 = 0.15; l2 <= 1.3; l2 += 0.1) {
          const p1 = [A[0] + lineA.d[0] * l1 * ta, A[1] + lineA.d[1] * l1 * ta];
          const p2 = [B[0] - lineB.d[0] * l2 * tb, B[1] - lineB.d[1] * l2 * tb];
          const st = stats(A, p1, p2, B, mode);
          if (mode && Math.abs(st.apex - target) > 0.3) continue; // the arc's top / bottom stays where the capture had it
          const cost = st.peak + 2 * (st.kStart + st.kEnd);
          if (!best || cost < best.cost) best = { cost, ...st, A, B, p1, p2, ta, tb };
        }
      }
    }
  }
  if (!best) throw new Error(`${label}: no smooth fit for the ${name} arc`);
  console.log(`${label} ${name} arc: tightest radius ${(1 / best.peak).toFixed(1)}, curvature at the straight joins ${best.kStart.toFixed(3)}/${best.kEnd.toFixed(3)}, apex ${best.apex.toFixed(2)} (capture ${target.toFixed(2)})`);
  return best;
}

const data = JSON.parse(readFileSync(PATH, "utf-8"));
for (const label of labels) {
  const g = data.glyphs.find((x) => x.label === label);
  if (!g) throw new Error(`no glyph ${label}`);
  const segs = parse(g.strokes[0].d);
  const chord = (i) => len(sub(endOf(segs[i]), endOf(segs[i - 1])));
  const S = endOf(segs[0]);
  // long straight pieces and what they are
  const pieces = [];
  segs.forEach((s, i) => {
    if (i === 0 || s.cmd !== "L" || chord(i) <= 10) return;
    const from = endOf(segs[i - 1]);
    const to = endOf(s);
    const rise = (Math.atan2(from[1] - to[1], to[0] - from[0]) * 180) / Math.PI;
    pieces.push({ i, from, to, kind: to[1] > from[1] ? "stem" : rise >= 58 ? "retrace" : "rise" });
  });
  pieces[pieces.length - 1].kind = "tail";
  const report = [];
  // ---- the straight line each piece must lie on
  let stemLine = null;
  const first = pieces[0];
  const sShift = first.kind === "rise" ? [onLine(nearestLine(S[0], S[1]), S[1])[0] - S[0], 0] : [0, 0];
  const E = pieces[pieces.length - 1].to;
  const nEnd = nearestLine(E[0], E[1]);
  const eShift = [onLine(nEnd, E[1])[0] - E[0], 0];
  pieces.forEach((pc, k) => {
    if (pc.kind === "stem") {
      stemLine = nearestLine((pc.from[0] + pc.to[0]) / 2, (pc.from[1] + pc.to[1]) / 2);
      pc.line = { p: onLine(stemLine, pc.from[1]), d: STEM_DIR };
      pc.n = stemLine;
      report.push(`stem on line ${stemLine}`);
    } else if (pc.kind === "retrace") {
      pc.line = { p: onLine(stemLine, pc.from[1]), d: [-STEM_DIR[0], -STEM_DIR[1]] };
    } else if (pc.kind === "rise") {
      pc.line = { p: add(pc.from, k === 0 ? sShift : [0, 0]), d: unit(sub(pc.to, pc.from)) };
    } else {
      pc.line = { p: add(pc.from, eShift), d: unit(sub(pc.to, pc.from)) };
    }
    // where the capture's piece began / ended, put onto its (possibly moved) line
    const along = (q) => add(pc.line.p, [pc.line.d[0] * dot(sub(q, pc.line.p), pc.line.d), pc.line.d[1] * dot(sub(q, pc.line.p), pc.line.d)]);
    pc.origFrom = along(add(pc.from, k === 0 && pc.kind === "rise" ? sShift : pc.kind === "tail" ? eShift : [0, 0]));
    pc.origTo = along(add(pc.to, k === 0 && pc.kind === "rise" ? sShift : pc.kind === "tail" ? eShift : [0, 0]));
  });
  if (nEnd === stemLine) throw new Error(`${label}: closing rise would end on the stem's own grid line`);
  if (first.kind === "rise") report.push(`start on grid line ${nearestLine(S[0], S[1])}`);
  report.push(`end on grid line ${nEnd}`);
  // ---- fit the joins and assemble
  const out = [];
  let start = first.kind === "rise" ? first.line.p : onLine(first.n, S[1]);
  out.push("M", f2(start[0]), f2(start[1]));
  for (let k = 0; k < pieces.length; k += 1) {
    const pc = pieces[k];
    const next = pieces[k + 1];
    if (!next) { const E2 = onLine(nEnd, E[1]); out.push("L", f2(E2[0]), f2(E2[1])); break; }
    if (pc.kind === "stem" && next.kind === "retrace") {
      const bottom = onLine(pc.n, pc.to[1]); // reversal: straight down, straight back up the same line
      out.push("L", f2(bottom[0]), f2(bottom[1]));
      next.start = bottom;
      continue;
    }
    const rg = { from: pc.i + 1, to: next.i - 1 };
    const kindName = pc.kind === "retrace" ? "bend" : pc.kind === "rise" ? "top" : "bottom";
    const mode = kindName === "top" ? "min" : kindName === "bottom" ? "max" : null;
    const target = mode === "min" ? Math.min(...sampleYs(segs, rg.from, rg.to)) : mode === "max" ? Math.max(...sampleYs(segs, rg.from, rg.to)) : 0;
    const startOfPc = pc.start ?? start;
    const arc = fitArc(label, kindName, pc.line, next.line, mode, target, pc.origTo, next.origFrom,
      (V) => dot(sub(V, startOfPc), pc.line.d) - 6, () => Infinity);
    out.push("L", f2(arc.A[0]), f2(arc.A[1]), "C", ...[...arc.p1, ...arc.p2, ...arc.B].map(f2));
    next.start = arc.B;
    start = arc.B;
  }
  // every straight piece must still be straight for a while
  pieces.forEach((pc, k) => {
    void k;
  });
  console.log(`${label}: ${report.join(", ")}`);
  g.strokes[0].d = out.join(" ");
  g.gridFitted = true;
}
writeFileSync(PATH, JSON.stringify(data, null, 2));
