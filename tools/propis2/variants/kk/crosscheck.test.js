import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";
import { samplePath } from "../propis/pathGeometry.js";
import { withGlyphOverrides } from "./glyphOverrides.js";

const seg = (a, b, c, d) => {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
const crossings = (A, B) => { let n = 0; for (let i = 0; i < A.length - 1; i += 1) for (let j = 0; j < B.length - 1; j += 1) if (seg(A[i], A[i + 1], B[j], B[j + 1])) n += 1; return n; };
it("cross", () => {
  const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).glyphs;
  const kk = JSON.parse(readFileSync(process.env.KK_GLYPHS, "utf-8"));
  const labels = new Set(kk.map((g) => g.label));
  const g = withGlyphOverrides([...wide.filter((x) => !labels.has(x.label)), ...kk]);
  const map = new Map(g.map((x) => [x.label, x])); for (const x of g) for (const a of x.aliases ?? []) map.set(a, x);
  map.script = { growJoins: true, topJoins: true, topJoinsStraight: ["ү", "ұ"] };
  const low = "аәбвгғдеёжзийкқлмнңоөпрстуұүфхһцчшщъыіьэюя", caps = [...low].filter((c) => c !== "ь").map((c) => c.toUpperCase());
  const out = [], outOwn = new Map(), outGap = [], ownPairs = {}, endNear = {};
  for (const X of (process.env.KK_XS ? [...process.env.KK_XS] : [...low, ...caps])) for (const Y of low) {
    const gx = map.get(X), gy = map.get(Y); if (!gx || !gy || !gx.strokes || !gy.strokes) continue;
    let st; try { st = layoutWideLinesIntoRows([X + Y], map, undefined, false, 1).placed[0].segments[0].strokes; } catch { continue; }
    const nY = Math.max(1, gy.strokes.length - (Number.isInteger(gy.tailStroke) ? 1 : 0));
    if (gy.compose || gx.compose) continue;
    const iY = st.length - nY; if (iY < 1) continue;
    const conn = samplePath(st[iY - 1].d, 120), nxt = samplePath(st[iY].d, 120);
    // trim the ends where the connector is supposed to touch the next stroke
    const cut = (P, atEnd) => { const e = atEnd ? P[P.length - 1] : P[0]; return P.filter((q) => Math.hypot(q[0] - e[0], q[1] - e[1]) > 2.5); };
    const c = crossings(cut(conn, true), cut(nxt, false));
    // the connector against the strokes of its OWN letter (a stem it must not cut through: Ғ Г …); only when the connector is a stroke of its own
    let own = 0;
    if (Number.isInteger(gx.tailStroke) && iY - 1 > 0) for (let k = 0; k < iY - 1; k += 1) own += crossings(cut(conn, false).filter((q, i, A) => i > 0 && Math.hypot(q[0] - A[0][0], q[1] - A[0][1]) > 2.5), samplePath(st[k].d, 120));
    // the ink of the letter before (all but its connector) against the next letter's ink: a gap this small is a touch, the two read as one stroke (Ғ's bar against the top of и …)
    let gap = Infinity;
    const xs = st.slice(0, iY - (Number.isInteger(gx.tailStroke) ? 1 : 0));
    if (process.env.KK_GAP) for (const a of xs) for (const q of samplePath(a.d, 60)) for (const b of st.slice(iY)) for (const r of samplePath(b.d, 60)) gap = Math.min(gap, Math.hypot(q[0] - r[0], q[1] - r[1]));
    if (gap < 3.2) outGap.push(`${X}${Y}:${gap.toFixed(1)}`);
    // where the connector ARRIVES against the ink of its own letter (all its strokes but the connector): under 5 units the connector, the letter's bar/flag end and the next stroke fuse (Ғи: the end of the bar on the top line)
    if (Number.isInteger(gx.tailStroke) && iY - 1 > 0) {
      const endPt = conn[conn.length - 1]; let m = Infinity;
      for (let k = 0; k < iY - 1; k += 1) for (const q of samplePath(st[k].d, 150)) m = Math.min(m, Math.hypot(q[0] - endPt[0], q[1] - endPt[1]));
      if (m < 5) (endNear[X] ??= []).push(`${Y}:${m.toFixed(1)}`);
    }
    if (c > 0) out.push(`${X}${Y}:${c}`);
    if (own > 0) { outOwn.set(X, Math.max(outOwn.get(X) ?? 0, own)); (ownPairs[X] ??= []).push(Y); }
  }
  writeFileSync("/tmp/kk/cross.txt", out.join(" "));
  writeFileSync("/tmp/kk/cross_gap.txt", outGap.join(" "));
  writeFileSync("/tmp/kk/cross_endnear.json", JSON.stringify(endNear));
  writeFileSync("/tmp/kk/cross_ownpairs.json", JSON.stringify(ownPairs));
  writeFileSync("/tmp/kk/cross_own.txt", [...outOwn].map(([k, v]) => `${k}:${v}`).join(" "));
  console.log("PAIRS", out.length);
}, 600000);
