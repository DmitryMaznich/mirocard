// Review page of the pen trajectory of the copybook letters (docs/propis2-letter-parts.md): per letter of
// tools/handwriting/cyrillic/letter_elements.json — its elements in colours, and an animation of each technique (joined: the retrace is the
// pen running along the ink, no new line; lifted: every element from its own start dot, the pen's way through the air not shown).
//   node tools/propis2/parts-review/trajectory-sheet.mjs [letters] > out.html
// The page shows the dense slant grid of the notebook (5 mm, as the row puts the letter on it) and the middle dashed line.
import { readFileSync } from "node:fs";
import { runnerImport } from "vite";
import { letterMoves, letterPaths, piecePathD, composedMoves } from "../../../src/handwriting/letterParts.js";
import { samplePath, toCubicPathD, stretchKeepSlantPathD } from "../../../src/handwriting/pathGeometry.js";
import { normalizeLetterExtremes, layoutWideLinesIntoRows } from "../../../src/handwriting/wordEngine.js";

const wide = JSON.parse(readFileSync("tools/handwriting/cyrillic/wide.json", "utf-8")).glyphs;
const spec = JSON.parse(readFileSync("tools/handwriting/cyrillic/letter_elements.json", "utf-8")).letters;
const letters = [...(process.argv[2] ?? Object.keys(spec).join(""))];
const COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];
const TITLE = { joined: "Безотрывно", lifted: "С отрывом" };
// the dense slant grid of the notebook (owner, 2026-11-20: to check that the letters go along the slants): the page's own grid function,
// loaded through Vite (PrintPageView.jsx is JSX); the row puts every letter on it as the page does — the same lines are drawn here
const { module: page } = await runnerImport(new URL("../../../src/handwriting/PrintPageView.jsx", import.meta.url).pathname, { root: new URL("../../..", import.meta.url).pathname, logLevel: "error" });
const DENSE = page.snapXFor({ narrowRows: false, simpleGrid: "dense", margin: "off", format: "a5" });
const ROW = 52 / 48; // row units -> capture units (the row: 48 for the 52 of the capture band)
const TAN = Math.tan((25 * Math.PI) / 180);
// the letters as the app builds them: wide.json with propis2's own fixes (glyphOverrides.js: у's straight tail, the stem a letter is placed by …)
const { module: pageTask } = await runnerImport(new URL("../../../src/topics/renderers/propis2/pageTask.js", import.meta.url).pathname, { root: new URL("../../..", import.meta.url).pathname, logLevel: "error" });
const elementsJson = JSON.parse(readFileSync("tools/handwriting/cyrillic/elements.json", "utf-8")).elements;
const MAP = pageTask.buildGlyphMap({ wide, elements: elementsJson });
const startOf = (d) => samplePath(toCubicPathD(d), 1)[0];

const cards = letters.map((ch) => {
  // the letter as the app stands it on the band (wordEngine's normalizeLetterExtremes: stretched along the slant so that its top and bottom
  // touch the lines), not the raw capture — otherwise the sheet shows letters off the lines that are on them in the app
  const raw = MAP.get(ch);
  // a composed letter (ш = 6 + 6 + 6): laid out by the row, its parts and the joins between them brought back to the capture frame
  // (the row: top line 16, baseline 64, i.e. 52 capture units in 48)
  const composed = raw.compose ? (() => {
    const seg = layoutWideLinesIntoRows([ch], MAP, DENSE, false).placed[0].segments[0];
    const back = (d) => d.replace(/(-?\d*\.?\d+) (-?\d*\.?\d+)/g, (_, x, y) => `${(+x * 52 / 48 + 100).toFixed(2)} ${(10 + (+y - 16) * 52 / 48).toFixed(2)}`);
    return { strokes: seg.strokes.map((s) => ({ d: back(s.d) })), trajectory: seg.trajectory.strokes.map((s) => ({ ...s, d: back(s.d) })) };
  })() : null;
  // (and widened as the row widens it: wide.json "stretch", the slant kept — without it a letter here is 1.8 times narrower than a composed
  // one, which comes from the row already widened)
  const g = composed ? { ...raw, strokes: composed.strokes } : { ...raw, strokes: normalizeLetterExtremes(raw).map((d) => ({ d: stretchKeepSlantPathD(d, raw.stretch ?? 1, 25, 62) })), trajectory: spec[ch] };
  const movesOf = (t) => (composed ? composedMoves(composed.strokes, composed.trajectory, t) : letterMoves(g, t));
  const pts = g.strokes.flatMap((s) => samplePath(toCubicPathD(s.d), 20));
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs) - 14, y0 = Math.min(-45, ...ys) - 10, w = Math.max(...xs) - x0 + 14, h = Math.max(118, ...ys) - y0 + 10;
  // the slants: the row lays the letter out on the dense grid; the line of the grid nearest to the letter's start there, carried over to this
  // frame through the same start point (the row and this frame differ by a scale and a shift only), then every 30 row units
  const rowSeg = layoutWideLinesIntoRows([ch], MAP, DENSE, false).placed[0].segments[0];
  const ps = startOf(rowSeg.strokes[0].d), pc = startOf(g.strokes[0].d);
  const anchor = pc[0] + (DENSE(0, ps[0], ps[1]) - ps[0]) * ROW, step = 30 * ROW;
  const xAt = (n, y) => anchor + n * step - (y - pc[1]) * TAN;
  const slants = [];
  for (let n = -12; n <= 12; n += 1) {
    const ya = y0, yb = y0 + h;
    if (Math.max(xAt(n, ya), xAt(n, yb)) < x0 || Math.min(xAt(n, ya), xAt(n, yb)) > x0 + w) continue;
    slants.push(`<line x1="${xAt(n, ya).toFixed(2)}" y1="${ya}" x2="${xAt(n, yb).toFixed(2)}" y2="${yb}" class="sl"/>`);
  }
  // the sticks: stretches of the ink at least 12 units long going along the slant (65°, ±2°); for each, its distance across the grid from the
  // nearest line (in row units, as the notebook measures: a slant cell is 30)
  const sticks = [];
  for (const st of g.strokes) {
    const q = samplePath(toCubicPathD(st.d), 24);
    let run = [q[0]];
    const flush = () => {
      const L = run.length > 1 ? Math.hypot(run.at(-1)[0] - run[0][0], run.at(-1)[1] - run[0][1]) : 0;
      if (L >= 12) {
        const off = run.map(([x, y]) => { const u = (x - xAt(0, y)) / step; return (u - Math.round(u)) * 30; });
        const mean = off.reduce((a, b) => a + b, 0) / off.length;
        sticks.push(mean);
      }
      run = [];
    };
    for (let i = 1; i < q.length; i += 1) {
      const dx = q[i][0] - q[i - 1][0], dy = q[i][1] - q[i - 1][1];
      const ang = Math.abs(Math.atan2(Math.abs(dy), Math.sign(dy) * -dx) * 180 / Math.PI);
      const along = Math.hypot(dx, dy) > 1e-6 && Math.abs((Math.atan2(Math.abs(dy), dy > 0 ? -dx : dx) * 180) / Math.PI - 65) <= 2;
      if (along) { if (!run.length) run.push(q[i - 1]); run.push(q[i]); } else flush();
    }
    flush();
  }
  const stickNote = sticks.length ? `палочки от наклонных: ${sticks.map((v) => (v >= 0 ? "+" : "") + v.toFixed(1)).join(", ")} (клетка 30)` : "";
  const guides = slants.join("") + [-42, 10, 62, 114].map((y) => `<line x1="${x0}" x2="${x0 + w}" y1="${y}" y2="${y}" class="gl"/>`).join("") + `<line x1="${x0}" x2="${x0 + w}" y1="36" y2="36" class="gl mid"/>`;
  const svg = (inner, extra = "") => `<svg viewBox="${x0} ${y0} ${w} ${h}" ${extra}>${guides}${inner}</svg>`;
  const names = spec[ch]?.elements ?? [];
  const inkD = movesOf("lifted").filter((m) => m.kind === "ink").map((m) => m.d);
  const elems = inkD.map((d, i) => `<path d="${d}" stroke="${COLORS[i % 6]}" class="ink"/>`).join("");
  const legend = names.map((n, i) => `<span style="color:${COLORS[i % 6]}">● ${n}</span>`).join(" ");
  const anim = ["joined", "lifted"].map((t) => {
    const moves = movesOf(t);
    return `<div class="panel"><h3>${TITLE[t]}</h3>${svg("", `data-moves='${JSON.stringify(moves)}'`)}<button>▶ ещё раз</button></div>`;
  }).join("");
  return `<section><h2>${ch} <small class="note2">${stickNote}</small></h2><div class="row"><div class="panel"><h3>Элементы</h3>${svg(elems)}<p>${legend}</p></div>${anim}</div></section>`;
}).join("");

process.stdout.write(`<!doctype html><meta charset="utf-8"><title>Траектория прописных букв</title>
<style>
body{font-family:system-ui,sans-serif;margin:16px;color:#222}
.row{display:flex;flex-wrap:wrap;gap:16px}
.panel{border:1px solid #ddd;border-radius:8px;padding:8px;text-align:center}
.panel svg{height:300px;display:block;margin:auto}
h2{margin:8px 0}.note2{font-size:13px;font-weight:400;color:#64748b}h3{margin:0 0 4px;font-size:15px;font-weight:600}
.gl{stroke:#cbd5e1;stroke-width:1}.mid{stroke-dasharray:3 3}.sl{stroke:#94a3b8;stroke-width:0.6}
.ink{fill:none;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
button{margin-top:6px;font-size:14px;padding:4px 10px}
p{margin:6px 0 0;font-size:14px;max-width:260px;text-align:left}p span{display:block}
.note{max-width:720px;color:#555;font-size:14px}
</style>
<p class="note">Синяя линия — что остаётся на бумаге. Зелёная точка — где ручка касается бумаги. Безотрывно: у «р» после палочки ручка идёт по ней обратно вверх до средней линии (новой линии нет) и сразу пишет крючок; у «и» после закругления ручка поднимается по наклонной до верхней линии (линия остаётся) и оттуда пишет вторую палочку. С отрывом: палочка закончилась — ручка исчезает и появляется в начале крючка.</p>
${cards}
<script>
const NS = "http://www.w3.org/2000/svg", SPEED = 0.09; // units per ms
const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
function play(svg) {
  svg.querySelectorAll(".dyn").forEach((e) => e.remove());
  const moves = JSON.parse(svg.dataset.moves);
  const layer = el("g", { class: "dyn" }); svg.appendChild(layer);
  const ghost = el("g", { class: "dyn", opacity: 0.12 }); svg.insertBefore(ghost, layer);
  for (const m of moves) if (m.kind === "ink") ghost.appendChild(el("path", { d: m.d, class: "ink", stroke: "#1d4ed8" }));
  const pen = el("circle", { r: 4.5, fill: "#fbbf24", stroke: "#92400e", "stroke-width": 1.2, class: "dyn" });
  // a move that "continues" the previous one starts at the very moment that one ended (the clock is carried over, not restarted on the next
  // frame) and runs at the same speed: the pen goes over the joint without a stop. Pauses only where the pen is lifted, and at the end.
  let i = 0, clock = 0;
  const next = (now) => {
    if (i >= moves.length) { pen.remove(); svg._t = setTimeout(() => play(svg), 1600); return; }
    const m = moves[i++];
    if (m.kind === "lift") { pen.remove(); svg._t = setTimeout(() => requestAnimationFrame(start), 450); return; } // the way through the air is not shown
    const path = el("path", { d: m.d, class: "ink", stroke: m.kind === "ink" || m.ink ? "#1d4ed8" : "none" });
    layer.appendChild(path);
    if (m.startDot) { const p0 = path.getPointAtLength(0); layer.appendChild(el("circle", { cx: p0.x, cy: p0.y, r: 4, fill: "#16a34a" })); }
    const len = path.getTotalLength();
    const drawn = m.kind === "ink" || m.ink;
    if (drawn) { path.style.strokeDasharray = len; path.style.strokeDashoffset = len; }
    layer.appendChild(pen);
    const t0 = m.continues ? clock : now, dur = len / SPEED;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), p = path.getPointAtLength(len * k);
      pen.setAttribute("cx", p.x); pen.setAttribute("cy", p.y);
      if (drawn) path.style.strokeDashoffset = len * (1 - k);
      if (k < 1) { svg._raf = requestAnimationFrame(step); return; }
      clock = t0 + dur;
      // the next move in this same frame when it goes on with the pen down, else after the frame
      if (moves[i]?.continues) next(t); else svg._raf = requestAnimationFrame(next);
    };
    step(now);
  };
  const start = (t) => next(t);
  svg._t = setTimeout(() => requestAnimationFrame(start), 400);
}
document.querySelectorAll("svg[data-moves]").forEach((svg) => {
  play(svg);
  svg.parentElement.querySelector("button").onclick = () => { clearTimeout(svg._t); cancelAnimationFrame(svg._raf); play(svg); };
});
</script>
`);
