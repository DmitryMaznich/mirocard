// Synthesises the capture-frame glyphs "л", "м", "я" for tools/propis/wide.json (nobody drew them): straight
// pieces lie exactly on the workshop's 65deg grid lines (same grid as scripts/propis-fit-hook.mjs), rises keep the
// ~50deg capture rise, corners are small tangent fillets, "я" gets an oval bowl on its stem.
//
// Usage: node scripts/propis-make-l-m-ya.mjs   (rewrites those three glyphs in wide.json)
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "tools/propis/wide.json";
const L3 = 88, SPACING = 9, VB_H = 150;
const TAN25 = Math.tan((25 * Math.PI) / 180);
const loopFrom = -Math.max((VB_H - L3) / Math.tan((65 * Math.PI) / 180), (VB_H - L3) / Math.tan((50 * Math.PI) / 180)) - SPACING;
const gx = (n, y) => loopFrom + SPACING * n + (L3 - y) * TAN25;
const P = (n, y) => [gx(n, y), y];

const Y_MID = 36, Y_TOP = 8.2, Y_VAL = 62.4; // vertex heights (fillets pull the visible extremes in to ~10.5 / ~60)
const N1 = 17;
const R_TOP = 2.4, R_VAL = 3.4;

const f = (n) => Number(n.toFixed(2));
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const unit = (a, b) => { const d = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(...d); return [d[0] / l, d[1] / l]; };

// polyline with a tangent fillet at every inner vertex: radii[i] is the cut distance at vertex i (1..n-2)
function filleted(points, cuts) {
  let d = `M ${pt(points[0])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const u = unit(points[i - 1], points[i]);
    const v = unit(points[i], points[i + 1]);
    const c = cuts[i];
    const p1 = [points[i][0] - u[0] * c, points[i][1] - u[1] * c];
    const p2 = [points[i][0] + v[0] * c, points[i][1] + v[1] * c];
    const k = 0.6;
    d += ` L ${pt(p1)} C ${pt([p1[0] + u[0] * c * k, p1[1] + u[1] * c * k])} ${pt([p2[0] - v[0] * c * k, p2[1] - v[1] * c * k])} ${pt(p2)}`;
  }
  return d + ` L ${pt(points[points.length - 1])}`;
}

const S = P(N1, Y_MID), V1 = P(N1, Y_VAL);
const A = P(N1 + 2, Y_TOP), V2 = P(N1 + 2, Y_VAL);

const л = filleted([S, V1, A, V2, P(N1 + 4, Y_MID)], [0, R_VAL, R_TOP, R_VAL]);

const A2 = P(N1 + 4, Y_TOP), V3 = P(N1 + 4, Y_VAL);
const м = filleted([S, V1, A, V2, A2, V3, P(N1 + 6, Y_MID)], [0, R_VAL, R_TOP, R_VAL, R_TOP, R_VAL]);

// "я": entry + rise as in "л", but the rise only climbs to the stem line at the bowl's bottom (B); from there the
// pen goes up the stem to the top (T), bends left over it (counter-clockwise: top, left side, bottom) into a
// D-shaped bowl whose straight side is the stem, comes back onto B and goes straight down the stem again (the
// retrace) to the valley and the exit.
const CHORD = (65 * Math.PI) / 180;         // the bowl is an ellipse cut by the stem line at +-65deg from its right side
const cyB = 24, bHalf = 14.3, aB = 11.6;
const Bp = P(N1 + 2, cyB + bHalf * Math.sin(CHORD));
const Tp = P(N1 + 2, cyB - bHalf * Math.sin(CHORD));
const mB = [gx(N1 + 2, cyB) - aB * Math.cos(CHORD), cyB];
// point / derivative on the sheared ellipse (leans along the slant), phi from the right side, y downwards
const ell = (phi) => [mB[0] + aB * Math.cos(phi) - bHalf * Math.sin(phi) * TAN25, mB[1] + bHalf * Math.sin(phi)];
const ellD = (phi) => [-aB * Math.sin(phi) - bHalf * Math.cos(phi) * TAN25, bHalf * Math.cos(phi)];
const arc = (p0, p1) => {
  const h = (4 / 3) * Math.tan(Math.abs(p1 - p0) / 4) * Math.sign(p1 - p0);
  const a = ell(p0), b = ell(p1), da = ellD(p0), db = ellD(p1);
  return `C ${pt([a[0] + da[0] * h, a[1] + da[1] * h])} ${pt([b[0] - db[0] * h, b[1] - db[1] * h])} ${pt(b)}`;
};
const phis = [-CHORD, -Math.PI / 2, -Math.PI, -1.5 * Math.PI, -2 * Math.PI + CHORD];
const я =
  `M ${pt(S)} L ${pt([V1[0] + 0.3, V1[1] - 0.9])} C ${pt([V1[0] + 0.4, V1[1] + 0.2])} ${pt([V1[0] + 1.4, V1[1] + 0.5])} ${pt([V1[0] + 3.4, V1[1] - 1.8])} ` +
  `L ${pt(Bp)} L ${pt(Tp)} ${arc(phis[0], phis[1])} ${arc(phis[1], phis[2])} ${arc(phis[2], phis[3])} ${arc(phis[3], phis[4])} ` +
  `L ${pt([V2[0] + 0.4, V2[1] - 0.8])} ` +
  `C ${pt([V2[0] + 0.5, V2[1] + 0.2])} ${pt([V2[0] + 1.6, V2[1] + 0.4])} ${pt([V2[0] + 3.5, V2[1] - 1.7])} ` +
  `L ${pt(P(N1 + 4, Y_MID))}`;

const wide = JSON.parse(readFileSync(PATH, "utf-8"));
const defs = [
  { label: "л", sourceLabel: "л (синтез: зигзаг по сетке мастерской)", d: л, repeatCells: 3 },
  { label: "м", sourceLabel: "м (синтез: два острых холма по сетке)", d: м, repeatCells: 4 },
  { label: "я", sourceLabel: "я (синтез: вход, подъём, овал-«а» на ножке, ножка по сетке)", d: я, repeatCells: 3 },
];
for (const def of defs) {
  const glyph = { label: def.label, sourceLabel: def.sourceLabel, kind: "element", strokes: [{ d: def.d }], stretch: 1.806, gridFitted: true, synthesized: true, repeatCells: def.repeatCells };
  const i = wide.glyphs.findIndex((g) => g.label === def.label);
  if (i >= 0) wide.glyphs[i] = glyph; else wide.glyphs.push(glyph);
}
writeFileSync(PATH, JSON.stringify(wide, null, 2) + "\n");
console.log("л:", л.slice(0, 90), "…");
