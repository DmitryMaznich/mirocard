// Fits a "г"-type element (rise from mid-height -> top arc -> stem -> bottom arc -> closing rise) of
// tools/propis/wide.json to the workshop's grid and smooths both arcs:
//  * the stem lies EXACTLY on a 65deg slant line of the workshop grid (spacing 9, anchored on the
//    baseline y=88, see handwriting_capture.html drawRuling);
//  * the stroke's start and end points sit on OTHER slant lines (their own nearest ones), the rise
//    and the closing rise keep their directions and just slide sideways onto them;
//  * the top and the bottom arc are each replaced by one tangent cubic whose curvature is ~0 where it
//    leaves/joins a straight piece, with the arc's top / bottom kept exactly where the capture had it.
//
// Usage: node scripts/propis-fit-hook.mjs г1
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "tools/propis/wide.json";
const label = process.argv[2];
if (!label) { console.error("usage: node scripts/propis-fit-hook.mjs <label>"); process.exit(1); }

// workshop grid: 65deg lines, x(y) = X0 + 9n + (L3 - y) * tan(25deg); L3 = 88, phase from drawRuling()
const L3 = 88, SPACING = 9, VB_H = 150;
const TAN25 = Math.tan((25 * Math.PI) / 180);
const loopFrom = -Math.max((VB_H - L3) / Math.tan((65 * Math.PI) / 180), (VB_H - L3) / Math.tan((50 * Math.PI) / 180)) - SPACING;
const gridX = (n, y) => loopFrom + SPACING * n + (L3 - y) * TAN25; // x of grid line n at height y
const nearestLine = (x, y) => Math.round((x - gridX(0, y)) / SPACING);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => { const l = len(v); return [v[0] / l, v[1] / l]; };
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];

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

function sampleY(segs, from, to) { // y extremes of segs[from..to] control hulls (conservative for Q/C)
  const ys = [];
  for (let i = from; i <= to; i += 1) { const p = segs[i].pts; for (let k = 1; k < p.length; k += 2) ys.push(p[k]); }
  return ys;
}

const data = JSON.parse(readFileSync(PATH, "utf-8"));
const g = data.glyphs.find((x) => x.label === label);
if (!g) throw new Error(`no glyph ${label}`);
const segs = parse(g.strokes[0].d);

// structure: M S, L (rise), [top arc ...], L (stem), [bottom arc ...], L (closing rise)
const chord = (i) => len(sub(endOf(segs[i]), endOf(segs[i - 1])));
const longL = segs.map((s, i) => (s.cmd === "L" && i > 0 && chord(i) > 10 ? i : -1)).filter((i) => i >= 0);
if (longL.length !== 3) throw new Error(`${label}: expected rise + stem + closing rise, found ${longL.length} long straight pieces`);
const [riseI, stemI, tailI] = longL;
const S = endOf(segs[0]);
const riseEnd = endOf(segs[riseI]);
const stemStart = endOf(segs[stemI - 1]);
const stemEnd = endOf(segs[stemI]);
const tailStart = endOf(segs[tailI - 1]);
const E = endOf(segs[tailI]);

// original arc extremes (control points are within ~1 unit of the curve for these captures)
const topApex = Math.min(...sampleY(segs, riseI + 1, stemI - 1));
const bottomApex = Math.max(...sampleY(segs, stemI + 1, tailI - 1).filter((y) => y < 62));

// ---- 1. snap onto the grid
const rDir = unit(sub(riseEnd, S)); // up-right
const tDir = unit(sub(E, tailStart)); // up-right
const stemLine = Math.round((((stemStart[0] + stemEnd[0]) / 2) - gridX(0, (stemStart[1] + stemEnd[1]) / 2)) / SPACING);
const sDir = [-TAN25, 1]; // stem heading down-left along the grid line, normalised below
const sU = unit(sDir);
const nStart = nearestLine(S[0], S[1]);
const nEnd = nearestLine(E[0], E[1]);
const S2 = [gridX(nStart, S[1]), S[1]];
const E2 = [gridX(nEnd, E[1]), E[1]];
if (nStart === stemLine || nEnd === stemLine || nStart === nEnd) throw new Error(`${label}: start/end/stem fall on the same grid line (${nStart}/${stemLine}/${nEnd})`);
const stemPoint = (y) => [gridX(stemLine, y), y];

// ---- 2. smooth arcs between two straight lines (each: a point on it and its direction of travel)
function bez(p0, p1, p2, p3, t) { const u = 1 - t; return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]); }
function stats(p0, p1, p2, p3, mode) {
  let peak = 0, apex = mode === "min" ? Infinity : -Infinity, kStart = 0, kEnd = 0;
  const N = 200;
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
const EAT = 10; // at most this much straight line may be given up on each side to let the curvature ramp
function fitArc(name, lineA, lineB, mode, target, origA, origB, roomA) {
  const s = cross(sub(lineB.p, lineA.p), lineB.d) / cross(lineA.d, lineB.d);
  const V = [lineA.p[0] + s * lineA.d[0], lineA.p[1] + s * lineA.d[1]];
  const ta0 = dot(sub(V, origA), lineA.d); // corner -> where the capture's arc left line A
  const tb0 = dot(sub(origB, V), lineB.d); // corner -> where it joined line B
  const maxTa = Math.min(ta0 + EAT, roomA(V));
  let best = null;
  for (let ta = Math.max(6, ta0 - 2); ta <= maxTa; ta += 0.5) {
    for (let tb = Math.max(6, tb0 - 2); tb <= tb0 + EAT; tb += 0.5) {
      const A = [V[0] - lineA.d[0] * ta, V[1] - lineA.d[1] * ta];
      const B = [V[0] + lineB.d[0] * tb, V[1] + lineB.d[1] * tb];
      for (let l1 = 0.15; l1 <= 1.3; l1 += 0.05) {
        for (let l2 = 0.15; l2 <= 1.3; l2 += 0.05) {
          const p1 = [A[0] + lineA.d[0] * l1 * ta, A[1] + lineA.d[1] * l1 * ta];
          const p2 = [B[0] - lineB.d[0] * l2 * tb, B[1] - lineB.d[1] * l2 * tb];
          const st = stats(A, p1, p2, B, mode);
          if (Math.abs(st.apex - target) > 0.3) continue; // the arc's top/bottom stays where the capture had it
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

const shiftS = [S2[0] - S[0], 0];
const shiftE = [E2[0] - E[0], 0];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const stemOn = (q) => stemPoint(q[1]); // the capture's stem points, moved sideways onto the grid line
// top arc: the (slid) rise meets the stem
const top = fitArc("top", { p: S2, d: rDir }, { p: stemPoint(stemStart[1]), d: sU }, "min", topApex,
  add(riseEnd, shiftS), stemOn(stemStart), (V) => dot(sub(V, S2), rDir) - 6);
// bottom arc: the stem meets the (slid) closing rise
const bottom = fitArc("bottom", { p: stemPoint(stemEnd[1]), d: sU }, { p: add(tailStart, shiftE), d: tDir }, "max", bottomApex,
  stemOn(stemEnd), add(tailStart, shiftE), () => Infinity);
// the straight stem between the two arcs must survive
const gap = dot(sub(bottom.A, top.B), sU);
if (gap < 8) throw new Error(`${label}: only ${gap.toFixed(1)} units of straight stem left between the arcs`);
const f = (n) => Number(n.toFixed(2));
const out = ["M", f(S2[0]), f(S2[1]), "L", f(top.A[0]), f(top.A[1]),
  "C", ...[...top.p1, ...top.p2, ...top.B].map(f),
  "L", f(bottom.A[0]), f(bottom.A[1]),
  "C", ...[...bottom.p1, ...bottom.p2, ...bottom.B].map(f),
  "L", f(E2[0]), f(E2[1])];
console.log(`${label}: start on grid line ${nStart}, stem on line ${stemLine}, end on line ${nEnd}; straight stem ${gap.toFixed(1)} units`);
g.strokes[0].d = out.join(" ");
g.gridFitted = true;
writeFileSync(PATH, JSON.stringify(data, null, 2));
