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
  const out = [];
  for (const X of [...low, ...caps]) for (const Y of low) {
    const gx = map.get(X), gy = map.get(Y); if (!gx || !gy || !gx.strokes || !gy.strokes) continue;
    let st; try { st = layoutWideLinesIntoRows([X + Y], map, undefined, false, 1).placed[0].segments[0].strokes; } catch { continue; }
    const nY = Math.max(1, gy.strokes.length - (Number.isInteger(gy.tailStroke) ? 1 : 0));
    if (gy.compose || gx.compose) continue;
    const iY = st.length - nY; if (iY < 1) continue;
    const conn = samplePath(st[iY - 1].d, 120), nxt = samplePath(st[iY].d, 120);
    // trim the ends where the connector is supposed to touch the next stroke
    const cut = (P, atEnd) => { const e = atEnd ? P[P.length - 1] : P[0]; return P.filter((q) => Math.hypot(q[0] - e[0], q[1] - e[1]) > 2.5); };
    const c = crossings(cut(conn, true), cut(nxt, false));
    if (c > 0) out.push(`${X}${Y}:${c}`);
  }
  writeFileSync("/tmp/kk/cross.txt", out.join(" "));
  console.log("PAIRS", out.length);
}, 600000);
