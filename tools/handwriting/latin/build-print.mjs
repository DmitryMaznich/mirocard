// English print letters for the propis2 engine (docs/latin-letters.md, step 3.4).
// Source: tools/latin_letters/glyphs/print.json — the letters drawn on the four-line ruling in "band units" (band = 50, top line 0,
// x-line 50, baseline 100, bottom line 150; built by tools/latin_letters/glyphs/print.mjs, reviewed on tools/latin_letters/preview.mjs).
// Target: the engine's capture frame (src/handwriting/wordEngine.js): baseline y = 62, x-height 52 (x-line y = 10), capital top
// y = -42 (two x-heights). The print letters stay UPRIGHT: they are written apart (`script.joins: false`), nothing joins them along
// the slant, and the engine spaces letters and words by their ink as it will be printed. (Leaning them and letting
// `script.slantDeg: 90` stand them up again was tried first: the spaces were measured on the leaning shapes, and words ran together.)
// So: scale by 52/50 about the baseline.
//
// Digits and signs (case "sign") are scaled like capitals.
// `--style british` (docs/latin-letters.md): the British letters (tools/latin_letters/glyphs/british.json) in the British proportions
// of the Nelson paper (fourLinePapers.js en_gb: ascenders 0.74, descenders 0.72 of the x-height): a small letter's zone above the
// x-line is squeezed by UPPER and the one below the baseline by LOWER, its x band untouched; a capital is scaled as a whole, both ways,
// about the start of the baseline, to the ascenders' height (1 + UPPER x-heights), so O and S keep their shape.
//
// Run: node tools/handwriting/latin/build-print.mjs [--style british]  → tools/handwriting/latin/<style>.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const STYLE = process.argv.includes("--style") ? process.argv[process.argv.indexOf("--style") + 1] : "print";
// `print_gb`: the print letters in the British proportions, for the Nelson paper of «Прописи: латиница» (owner, 2026-11-09: no American
// paper there) -- the zones squeezed as the British letters', a capital squeezed in height only (its width as drawn, as the British
// capitals since the owner's «ширину заглавных верни как у оригинала»)
const STYLES = { print: { upper: 1, lower: 1 }, british: { upper: 0.74, lower: 0.72 }, print_gb: { upper: 0.74, lower: 0.72, src: "print", capHeightOnly: true } };
if (!STYLES[STYLE]) throw new Error(`unknown --style ${STYLE}`);
const { upper: UPPER, lower: LOWER, src: SRC = STYLE, capHeightOnly = false } = STYLES[STYLE];
const src = JSON.parse(readFileSync(here(`../../latin_letters/glyphs/${SRC}.json`), "utf8"));

const BASE = 62;           // capture baseline
const K = 52 / 50;         // capture x-height / source band
const r3 = (n) => Math.round(n * 1000) / 1000;

// band units → capture frame; `capital`: scaled as a whole to the ascenders' height
function mapPoint(x, y, capital) {
  if (capital) {
    const k = K * (1 + UPPER) / 2; // a capital spans two bands in the source
    return [r3(x * (capHeightOnly ? K : k)), r3(BASE + (y - 100) * k)];
  }
  const yc = y < 50 ? BASE - 52 - (50 - y) * K * UPPER : y > 100 ? BASE + (y - 100) * K * LOWER : BASE + (y - 100) * K;
  return [r3(x * K), r3(yc)];
}

// paths are M / L / C with absolute "x,y" or "x y" pairs
function mapPath(d, capital = false) {
  const tokens = d.match(/[MLC]|-?\d*\.?\d+/g);
  const out = [];
  for (let i = 0; i < tokens.length; ) {
    if (/[MLC]/.test(tokens[i])) { out.push(tokens[i]); i += 1; continue; }
    const [x, y] = mapPoint(Number(tokens[i]), Number(tokens[i + 1]), capital);
    out.push(`${x} ${y}`);
    i += 2;
  }
  return out.join(" ");
}

// engine labels and kinds: digits and the signs + - = < > are «№5», «№+» (the bank's own names, glyphOverrides.js — a plain «5» is an
// element, «+» chains letters); . , ? ! keep their character; the minus is also the hyphen «-». Signs never join (noJoin). Every glyph
// is `upright`: the engine does not unslant / lean it again (a digit put in a cell, wordEngine cellGlyphLocal).
const NUMBERED = new Set([..."0123456789", "+", "-", "=", "<", ">"]);
const glyphs = Object.entries(src.glyphs).flatMap(([ch, g]) => {
  const sign = g.case === "sign";
  const strokes = g.strokes.map((st) => ({ d: mapPath(st.d, g.case !== "lower"), ...(st.name ? { name: st.name } : {}) }));
  const base = { sourceLabel: `${STYLE}-${ch}`, strokes, stretch: 1, noNormalize: true, upright: true };
  if (!sign) return [{ label: ch, kind: "letter", ...base }];
  if (NUMBERED.has(ch)) {
    const digit = { label: `№${ch}`, kind: "digit", noJoin: true, ...base };
    return ch === "-" ? [digit, { label: "-", kind: "punct", noJoin: true, ...base }] : [digit];
  }
  return [{ label: ch, kind: "punct", noJoin: true, ...base }];
});

// British letters traced by the owner (tools/latin_letters/tidy_capture.py → captures/british.tidy.json) replace the drawn ones
const SPACE_ABOVE_BASE = new Set(["f", "j"]); // (j: its tail too reaches far left under the line, owner, 2026-11-09: oj, rj, sj stood off)
const TRACED = here("../../latin_letters/captures/british.tidy.json");
let traced = [];
if (STYLE === "british" && existsSync(TRACED)) {
  traced = JSON.parse(readFileSync(TRACED, "utf8")).glyphs;
  for (const t of traced) {
    const i = glyphs.findIndex((g) => g.label === t.label);
    const g = { label: t.label, kind: "letter", sourceLabel: t.sourceLabel, strokes: t.strokes.map(({ d, name }) => ({ d, name })), stretch: 1, noNormalize: true, upright: true };
    // f: the gap before it from its bar, not from its tail under the line (owner, 2026-11-09; wordEngine.js `spaceAboveBase`)
    if (SPACE_ABOVE_BASE.has(t.label)) g.spaceAboveBase = true;
    if (i >= 0) glyphs[i] = g; else glyphs.push(g);
  }
}

// A stroke that ends ON another one in the source (print y: the short arm meets the long one on the baseline) stops meeting it once the
// zone below the baseline is squeezed (LOWER < 1: the long arm leans differently and crosses the baseline further left — owner, 2026-11-10:
// «короткий штрих пересекает длинный»). Its end is put back on the other stroke: the meeting of the two straight lines. MEET: label →
// [the stroke that ends, the stroke it ends on].
const MEET = { y: [0, 1] };
const pts = (d) => d.match(/-?\d*\.?\d+/g).map(Number);
for (const g of glyphs) {
  const m = MEET[g.label];
  if (!m || g.kind !== "letter" || LOWER === 1 || !g.strokes[m[0]] || !g.strokes[m[1]]) continue;
  const a = pts(g.strokes[m[0]].d), b = pts(g.strokes[m[1]].d);
  if (a.length !== 4 || b.length !== 4) continue; // straight lines only
  const [ax, ay, bx, by] = [a[0], a[1], a[2] - a[0], a[3] - a[1]];
  const [cx, cy, dx, dy] = [b[0], b[1], b[2] - b[0], b[3] - b[1]];
  const den = bx * dy - by * dx;
  if (Math.abs(den) < 1e-9) continue;
  const t = ((cx - ax) * dy - (cy - ay) * dx) / den;
  g.strokes[m[0]] = { ...g.strokes[m[0]], d: `M ${r3(ax)} ${r3(ay)} L ${r3(ax + bx * t)} ${r3(ay + by * t)}` };
}

// Dots (i j . ! ? : ;) are written as a small circle — the movement stays — and drawn filled by the line itself (owner, 2026-11-10:
// «точка получается с пустотой внутри»): every closed little loop gets radius DOT_R about its centre. The ink is 2 page units wide;
// on the largest British ruling (8 mm, ~0.92 page unit per capture unit) a circle of radius 1 leaves no hole, on the 5 mm one the dot is
// ~1.6 line widths across.
const DOT_R = 1;
const isDot = (st) => {
  const n = st.d.match(/-?\d*\.?\d+/g).map(Number);
  const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const closed = Math.hypot(xs[0] - xs.at(-1), ys[0] - ys.at(-1)) < 0.05;
  return closed && st.d.includes("C") && w > 0 && w < 8 && h < 8;
};
const KAPPA = 0.5523;
const circle = (cx, cy, r) => {
  const k = r * KAPPA, f = (x, y) => `${r3(x)} ${r3(y)}`;
  return `M ${f(cx, cy - r)} C ${f(cx + k, cy - r)} ${f(cx + r, cy - k)} ${f(cx + r, cy)} C ${f(cx + r, cy + k)} ${f(cx + k, cy + r)} ${f(cx, cy + r)} C ${f(cx - k, cy + r)} ${f(cx - r, cy + k)} ${f(cx - r, cy)} C ${f(cx - r, cy - k)} ${f(cx - k, cy - r)} ${f(cx, cy - r)}`;
};
for (const g of glyphs) {
  g.strokes = g.strokes.map((st) => {
    if (!isDot(st)) return st;
    const n = st.d.match(/-?\d*\.?\d+/g).map(Number);
    const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
    return { ...st, d: circle((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, DOT_R) };
  });
}

const out = {
  note: `English ${STYLE} letters in the propis2 engine's capture frame — generated by tools/handwriting/latin/build-print.mjs${STYLE === "print" ? "" : ` --style ${STYLE}`} from tools/latin_letters/glyphs/${SRC}.json; do not edit by hand.`,
  glyphs,
};
writeFileSync(here(`./${STYLE}.json`), JSON.stringify(out, null, 1) + "\n");
console.log(`wrote ${glyphs.length} glyphs (${traced.length} traced) → tools/handwriting/latin/${STYLE}.json`);
