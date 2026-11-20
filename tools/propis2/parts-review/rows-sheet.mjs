// Review page of the PARTS of the copybook letters as the notebook writes them (docs/propis2-letter-parts.md): rows of one letter laid out by
// the engine on the dense slant grid with the letters as the deck carries them (wide.json + the app's fixes + letter_elements.json as
// `trajectory`, the way scripts/build-propis2-deck.mjs puts it on) — whole, and with only some of its elements written (`#p…`, the mark the
// row panel's «Что пишем» gives the row). Drawn as the sheet draws them: the written strokes and the red start dots.
//   node tools/propis2/parts-review/rows-sheet.mjs "п:1;и:0;ю:1" > out.html     (letter:kept parts separated by dots; no list = a default set)
import { readFileSync } from "node:fs";
import { runnerImport } from "vite";
const root = new URL("../../..", import.meta.url).pathname;
const imp = async (p) => (await runnerImport(root + p, { root, logLevel: "error" })).module;
const page = await imp("src/handwriting/PrintPageView.jsx"), pageTask = await imp("src/topics/renderers/propis2/pageTask.js"), eng = await imp("src/handwriting/wordEngine.js"), geo = await imp("src/handwriting/pathGeometry.js"), lp = await imp("src/handwriting/letterParts.js");
const wide = JSON.parse(readFileSync(root + "tools/handwriting/cyrillic/wide.json", "utf-8")).glyphs;
const elements = JSON.parse(readFileSync(root + "tools/handwriting/cyrillic/elements.json", "utf-8")).elements;
const marks = JSON.parse(readFileSync(root + "tools/handwriting/cyrillic/letter_elements.json", "utf-8")).letters;
// as the deck build does
for (const [ch, m] of Object.entries(marks)) {
  if (!m.strokes || m.composed) continue;
  const g = wide.find((x) => x.label === ch) ?? wide.find((x) => x.aliases?.includes(ch));
  if (g && !g.compose) g.trajectory = { strokes: m.strokes };
}
const map = pageTask.buildGlyphMap({ wide, elements });
const snap = page.snapXFor({ narrowRows: false, simpleGrid: "dense", margin: "off", format: "a5" });
const spec = process.argv[2] ?? "п:0;п:1;и:0;и:1;т:1;т:2;н:0;н:1;н:2;к:0;к:1;к:2;ж:0;ж:1;ж:2;ю:0;ю:1;ю:2;ю:0.2;ф:0;ф:1;ф:2;а:0;а:1;б:0;б:1;д:0;д:1;я:0;я:1;у:1;ц:2;щ:3;ъ:0;ъ:1;л:1;м:1;ч:0;ч:1;з:0;з:1;э:1;х:1;й:2";
const rows = spec.split(";").map((x) => { const [ch, keep] = x.split(":"); return { ch, keep }; });
const letters = [...new Set(rows.map((r) => r.ch))];
const lines = [];
const label = [];
for (const ch of letters) {
  const n = lp.letterPieces(map.get(ch)).length;
  lines.push(ch); label.push(`${ch} — целиком (элементов: ${n}; ${(marks[ch]?.elements ?? []).map((e, i) => `${i}: ${e}`).join("; ")})`);
  for (const r of rows.filter((x) => x.ch === ch && x.keep !== undefined)) { lines.push(`${ch}#p${r.keep}`); label.push(`${ch} — только ${r.keep.split(".").map((i) => (marks[ch]?.elements ?? [])[+i] ?? i).join(" + ")}`); }
}
const placed = eng.layoutWideLinesIntoRows(lines, map, snap, true).placed;
const TAN = Math.tan((25 * Math.PI) / 180);
const html = placed.map((row, ri) => {
  const segs = row.segments ?? [];
  const strokes = segs.flatMap((s) => s.strokes ?? []).filter((s) => !s.hidden);
  const dots = segs.flatMap((s) => s.startPoints ?? []);
  const xs = strokes.flatMap((s) => geo.samplePath(geo.toCubicPathD(s.d), 6).map((q) => q[0]));
  const x0 = Math.min(-10, ...xs) - 20, x1 = Math.max(200, ...xs) + 20;
  let sl = "";
  for (let x = snap(ri, x0, 0) - 60; x < x1 + 60; x += 30) { const xb = snap(ri, x, 0); sl += `<line x1="${xb + 44 * TAN}" y1="-44" x2="${xb - 130 * TAN}" y2="130" class="sl"/>`; }
  const h = [-32, 16, 40, 64, 112].map((y) => `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" class="gl${y === 40 ? " mid" : ""}"/>`).join("");
  return `<div class="r"><div class="t">${label[ri]}</div><svg viewBox="${x0} -40 ${x1 - x0} 162" height="190">${sl}${h}${strokes.map((s) => `<path d="${s.d}" class="ink"/>`).join("")}${dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" class="dot"/>`).join("")}</svg></div>`;
}).join("");
process.stdout.write(`<!doctype html><meta charset="utf-8"><title>Части письменных букв в строках тетради</title><style>
body{font-family:system-ui,sans-serif;margin:12px;color:#222}.r{margin:2px 0 10px}.t{font-size:13px;color:#475569}
.gl{stroke:#cbd5e1;stroke-width:0.6}.mid{stroke-dasharray:3 3}.sl{stroke:#e2e8f0;stroke-width:0.5}
.ink{fill:none;stroke:#1d4ed8;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}.dot{fill:#dc2626}
</style><p style="font-size:14px;max-width:760px">Строки тетради (частая сетка), разложенные движком приложения: буква целиком и только выбранные элементы (метка «Что пишем»). Красные точки — начала, как на листе.</p>${html}`);
