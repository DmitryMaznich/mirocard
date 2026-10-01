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
  for (const [strokeIndex, stroke] of g.strokes.entries()) {
  const segs = parse(stroke.d);
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
  if (!pieces.length) continue; // a dot / breve: nothing to fit
  const lastPiece = pieces[pieces.length - 1];
  const suffix = segs.slice(lastPiece.i + 1); // what follows the last straight piece (a curl: kept as captured)
  if (!suffix.length) lastPiece.kind = "tail";
  const firstPiece = pieces[0];
  let prefix = segs.slice(0, firstPiece.i); // M (+ anything before the first straight piece: kept as captured)
  // a sub-3-unit wiggle before the stem (the pen touching down) is not a bar: the stroke simply starts on the stem
  if (prefix.length > 1 && firstPiece.kind === "stem" && len(sub(firstPiece.from, S)) < 3) prefix = prefix.slice(0, 1);
  const report = [];
  // ---- the straight line each piece must lie on
  const stems = pieces.filter((pc) => pc.kind === "stem");
  stems.forEach((pc) => {
    pc.n = nearestLine((pc.from[0] + pc.to[0]) / 2, (pc.from[1] + pc.to[1]) / 2);
    pc.line = { p: onLine(pc.n, pc.from[1]), d: STEM_DIR };
    report.push(`stem on line ${pc.n}`);
  });
  const sShift = firstPiece.kind === "rise" && prefix.length === 1 ? [onLine(nearestLine(S[0], S[1]), S[1])[0] - S[0], 0] : [0, 0];
  const tail = lastPiece.kind === "tail" ? lastPiece : null;
  const E = tail ? tail.to : null;
  const nEnd = tail ? nearestLine(E[0], E[1]) : null;
  const eShift = tail ? [onLine(nEnd, E[1])[0] - E[0], 0] : [0, 0];
  pieces.forEach((pc, k) => {
    const prev = pieces[k - 1];
    const next = pieces[k + 1];
    let shift = [0, 0];
    if (pc.kind === "retrace") {
      // an up-stroke along a slant line: the stem that follows it retraces it, else it retraces the stem before it
      const mate = next?.kind === "stem" ? next : prev?.kind === "stem" ? prev : null;
      if (!mate) throw new Error(`${label}: a slant up-stroke with no stem next to it`);
      pc.n = mate.n;
      pc.line = { p: onLine(mate.n, pc.from[1]), d: [-STEM_DIR[0], -STEM_DIR[1]] };
    } else if (pc.kind === "rise" || pc.kind === "tail") {
      if (k === 0 && pc.kind === "rise") shift = sShift;
      if (pc.kind === "tail") shift = eShift;
      pc.line = { p: add(pc.from, shift), d: unit(sub(pc.to, pc.from)) };
    }
    // where the capture's piece began / ended, put onto its (possibly moved) line
    const along = (q) => { const t = dot(sub(q, pc.line.p), pc.line.d); return [pc.line.p[0] + pc.line.d[0] * t, pc.line.p[1] + pc.line.d[1] * t]; };
    pc.origFrom = along(add(pc.from, shift));
    pc.origTo = along(add(pc.to, shift));
  });
  if (tail && nEnd === stems[stems.length - 1].n) throw new Error(`${label}: closing rise would end on the stem's own grid line`);
  if (firstPiece.kind === "rise" && prefix.length === 1) report.push(`start on grid line ${nearestLine(S[0], S[1])}`);
  if (tail) report.push(`end on grid line ${nEnd}`);
  // ---- fit the joins and assemble
  const out = [];
  const fmt = (q) => [q.cmd, ...q.pts.map(f2)];
  let start;
  if (prefix.length === 1) {
    start = firstPiece.kind === "rise" ? firstPiece.line.p : onLine(firstPiece.n, S[1]);
    out.push("M", f2(start[0]), f2(start[1]));
  } else {
    // something precedes the first straight piece (a bar): keep the bar as captured, but replace its last
    // few units -- the turn down into the stem -- by one tangent cubic that lands on the stem's grid line
    if (firstPiece.kind !== "stem") throw new Error(`${label}: unsupported prefix`);
    start = onLine(firstPiece.n, firstPiece.from[1]);
    // walk back along the bar to a point at least TURN units before the stem
    const TURN = 7;
    let cut = prefix.length - 1;
    while (cut > 1 && len(sub(firstPiece.from, endOf(prefix[cut]))) < TURN) cut -= 1;
    const A = endOf(prefix[cut]);
    let bi = cut - 1;
    while (bi > 0 && len(sub(A, endOf(prefix[bi]))) < 1) bi -= 1; // the capture repeats points; need a real predecessor
    const tA = unit(sub(A, endOf(prefix[bi])));
    prefix.slice(0, cut + 1).forEach((q) => out.push(...fmt(q)));
    const chordAB = len(sub(start, A));
    let blend = null;
    for (let h1 = 0.1; h1 <= 1.2; h1 += 0.05) {
      for (let h2 = 0.1; h2 <= 1.2; h2 += 0.05) {
        const p1 = [A[0] + tA[0] * h1 * chordAB, A[1] + tA[1] * h1 * chordAB];
        const p2 = [start[0] - STEM_DIR[0] * h2 * chordAB, start[1] - STEM_DIR[1] * h2 * chordAB];
        const st = stats(A, p1, p2, start, "max");
        if (!blend || st.peak < blend.peak) blend = { peak: st.peak, p1, p2 };
      }
    }
    out.push("C", ...[...blend.p1, ...blend.p2, ...start].map(f2));
    console.log(`${label}: bar -> stem turn, tightest radius ${(1 / blend.peak).toFixed(1)}`);
    report.push(`bar joins the stem on line ${firstPiece.n}`);
  }
  firstPiece.start = start;
  for (let k = 0; k < pieces.length; k += 1) {
    const pc = pieces[k];
    const next = pieces[k + 1];
    if (!next) {
      if (tail) { const E2 = onLine(nEnd, E[1]); out.push("L", f2(E2[0]), f2(E2[1])); }
      else { out.push("L", f2(pc.to[0]), f2(pc.to[1])); suffix.forEach((q) => out.push(...fmt(q))); }
      break;
    }
    if ((pc.kind === "stem" && next.kind === "retrace") || (pc.kind === "retrace" && next.kind === "stem")) {
      // reversal along one and the same slant line: down and straight back up (or up and straight back down)
      const pt = onLine(pc.n ?? next.n, pc.to[1]);
      out.push("L", f2(pt[0]), f2(pt[1]));
      next.start = pt;
      continue;
    }
    if (pc.kind === "retrace" && next.kind === "retrace") {
      // crossbar between two stems: keep the captured bar, only slide its two ends (<~2 units) onto the two
      // stems' grid lines -- a gentle shear along the bar, so its flat run and its rounded ends survive
      const A0 = pc.to;
      const B0 = next.from;
      const A = onLine(pc.n, A0[1]);
      const B = onLine(next.n, B0[1]);
      const dxA = A[0] - A0[0];
      const dxB = B[0] - B0[0];
      const span = B0[0] - A0[0];
      const moveX = (x) => x + dxA + (dxB - dxA) * Math.min(1, Math.max(0, (x - A0[0]) / span));
      out.push("L", f2(A[0]), f2(A[1]));
      segs.slice(pc.i + 1, next.i).forEach((q) => {
        const pts = q.pts.slice();
        for (let m = 0; m < pts.length; m += 2) pts[m] = moveX(pts[m]);
        out.push(...fmt({ cmd: q.cmd, pts }));
      });
      console.log(`${label}: crossbar kept as captured, ends slid by ${dxA.toFixed(2)} / ${dxB.toFixed(2)}`);
      next.start = B;
      continue;
    }
    const rg = { from: pc.i + 1, to: next.i - 1 };
    const kindName = pc.kind === "retrace" || (pc.kind === "rise" && next.kind === "retrace") ? "bend" : pc.kind === "rise" ? "top" : "bottom";
    const mode = kindName === "top" ? "min" : kindName === "bottom" ? "max" : null;
    const target = mode === "min" ? Math.min(...sampleYs(segs, rg.from, rg.to)) : mode === "max" ? Math.max(...sampleYs(segs, rg.from, rg.to)) : 0;
    const arc = fitArc(label, kindName, pc.line, next.line, mode, target, pc.origTo, next.origFrom,
      (V) => dot(sub(V, pc.start), pc.line.d) - 3, () => Infinity);
    if (dot(sub(arc.A, pc.start), pc.line.d) < 2) throw new Error(`${label}: no straight piece left before the ${kindName} arc`);
    out.push("L", f2(arc.A[0]), f2(arc.A[1]), "C", ...[...arc.p1, ...arc.p2, ...arc.B].map(f2));
    next.start = arc.B;
  }
  console.log(`${label}${g.strokes.length > 1 ? ` (stroke ${strokeIndex + 1})` : ""}: ${report.join(", ")}`);
  stroke.d = out.join(" ");
  g.gridFitted = true;
  }
}
writeFileSync(PATH, JSON.stringify(data, null, 2));
