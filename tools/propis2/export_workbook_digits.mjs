// Exports the «Прописи 2» digits and signs for the printed digits workbook (scripts/digits_workbook), with the geometry the app
// itself uses, so the notebook and the screen show the same digits:
//   cell — squared paper (wordEngine `cellGlyphLocal`): one cell tall, 65deg slant, the span of the cell the app gives each digit;
//          units = cells, x from the cell's left side (a digit's ink touches x = 1, the right side; a sign is centred on x = 0.5),
//          y down from the baseline (the top of a digit is y = -1).
//   text — the copybook row (wordEngine `wideGlyphLocal`, scale 1), for digits inside handwritten text: units = the height of a
//          capital (= of a digit), x from the ink's left edge, y down from the baseline.
// Paths are SVG `d` strings (M/C/L, absolute).
//
//   node tools/propis2/export_workbook_digits.mjs     -> scripts/digits_workbook/p2_digits.json
import { readFileSync, writeFileSync } from "node:fs";
import { cellGlyphLocal, wideGlyphLocal } from "../../src/topics/renderers/propis/wordEngine.js";
import { transformPathD, samplePath } from "../../src/topics/renderers/propis/pathGeometry.js";
import { mmToNativeUnits, TEXT_ROW_PITCH, TEXT_ROW_THIN_OFFSET, NATIVE_L3 } from "../../src/topics/renderers/propis/propisRuling.js";

const GLYPHS = JSON.parse(readFileSync(new URL("../../src/topics/renderers/propis2/digitGlyphs.json", import.meta.url), "utf-8"));
const OUT = new URL("../../scripts/digits_workbook/p2_digits.json", import.meta.url);

const BASELINE = NATIVE_L3 - TEXT_ROW_THIN_OFFSET; // wordEngine WIDE_BASELINE_Y
const CELL = mmToNativeUnits(5); // PrintPageView SQUARE_CELL
const SCALE = (0.75 * CELL) / (TEXT_ROW_PITCH - TEXT_ROW_THIN_OFFSET); // PrintPageView SQUARE_LETTER_SCALE
const CHAR = { "№-": "−" };
const round = (d) => d.replace(/-?\d+\.\d+/g, (v) => String(Number(Number(v).toFixed(4))));

const xsOf = (strokes) => strokes.flatMap((s) => samplePath(s.d, 60).map((p) => p[0]));
const ysOf = (strokes) => strokes.flatMap((s) => samplePath(s.d, 60).map((p) => p[1]));

const out = {};
for (const g of GLYPHS) {
  const ch = CHAR[g.label] ?? g.label.replace(/^№/, "");
  const kind = /^№[0-9]/.test(g.label) ? "digit" : "sign"; // wordEngine isCellSign
  // squared paper
  const cell = cellGlyphLocal(g, SCALE, CELL);
  const k = 1 / CELL;
  const anchor = kind === "digit" ? cell.maxX - CELL : (cell.minX + cell.maxX) / 2 - CELL / 2;
  const cellStrokes = cell.strokes.map((s) => round(transformPathD(s.d, { translateX: -anchor, translateY: -BASELINE, scaleX: 1, scaleY: 1 })))
    .map((d) => round(transformPathD(d, { scaleX: k, scaleY: k })));
  // copybook row
  const wide = wideGlyphLocal(g, 1);
  const capH = -Math.min(...ysOf(GLYPHS.filter((x) => /^№[0-9]/.test(x.label)).flatMap((x) => wideGlyphLocal(x, 1).strokes)).map((y) => y - BASELINE));
  const minX = Math.min(...xsOf(wide.strokes));
  const textStrokes = wide.strokes.map((s) => round(transformPathD(transformPathD(s.d, { translateX: -minX, translateY: -BASELINE }), { scaleX: 1 / capH, scaleY: 1 / capH })));
  out[ch] = { kind, cell: cellStrokes, text: textStrokes };
}
writeFileSync(OUT, `${JSON.stringify({ source: "src/topics/renderers/propis2/digitGlyphs.json via tools/propis2/export_workbook_digits.mjs", glyphs: out }, null, 1)}\n`);
console.log(Object.keys(out).join(" "));
