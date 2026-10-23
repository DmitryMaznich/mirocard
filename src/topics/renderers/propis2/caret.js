// `propis2`: typing straight onto the sheet (owner, 2026-10-23: no text field, the letters appear on the copybook row as they are
// typed, as in a word processor). The text of the page is still one string, one line per row, as the field had it (fieldText.js:
// element codes {э1}, digits typed bare); this module maps a place in that text to a place on the sheet and back:
//  - caretOnSheet: (row, offset in its line) -> the sheet row (engine line index) and the x on it, in the row's own units;
//  - caretFromSheet: a point on a sheet row -> the offset in the line of the row that owns it, the nearest letter boundary.
// x is measured the way the page draws the row: the text up to the caret is laid out by the engine on the SAME row of the page (the
// slant grid's phase differs from row to row), so the caret stands right after the ink of the last letter typed.
import { layoutWideLinesIntoRows } from "../propis/wordEngine.js";
import { bboxOf } from "./glyphReach.js";
import { bracesOut } from "./fieldText.js";
import { indentUnitsOf, leadingSpaces, pageRuling, pageSnap, rowMaxX, rowToLine, wrapPassage } from "./model.js";

const SPACE_UNITS = 14; // the caret after a typed space stands this far (× the row's scale) right of the last ink

// The page's snapping function, but for one sheet row: the engine lays a single line out as row 0, the page lays it out as row `row`.
const snapAt = (snap, row) => (snap
  ? Object.assign((_r, x, y) => snap(row, x, y), snap.cell ? { cell: { ...snap.cell, origin: () => snap.cell.origin(row) } } : {}, snap.hidden ? { hidden: true } : {}, snap.letterScale ? { letterScale: snap.letterScale } : {})
  : undefined);

const CACHE = new WeakMap(); // glyphMap -> Map(key -> { width, minX })
function placed(line, page, glyphMap, row) {
  let m = CACHE.get(glyphMap);
  if (!m) { m = new Map(); CACHE.set(glyphMap, m); }
  if (m.size > 8000) m.clear();
  const snap = pageSnap(page);
  const key = `${JSON.stringify([pageRuling(page), rowMaxX(page)])}|${snap?.cacheable ? JSON.stringify([page.ruling, page.grid, page.gridKind, page.margin, page.format]) : Math.random()}|${row}|${line}`;
  if (m.has(key)) return m.get(key);
  const { placed: rows } = layoutWideLinesIntoRows([line], glyphMap, snapAt(snap, row), false, pageRuling(page) === "narrow" ? 0.5 : 1, rowMaxX(page));
  const seg = rows[0]?.segments?.[0];
  const box = seg ? bboxOf((seg.strokes ?? []).map((s) => s.d).filter(Boolean)) : null;
  const out = { width: seg?.width ?? 0, minX: box ? box.minX : null };
  m.set(key, out);
  return out;
}
const scaleOf = (page) => (pageRuling(page) === "narrow" ? 0.5 : 1);
// where a row's writing starts: the ink of a first letter («и»: it has no lead-in to the left) on that row
const startX = (page, glyphMap, row) => placed("и#1", page, glyphMap, row).minX ?? 0;

// The text of the line up to `offset` as the rows keep it (element ids, digits as «№5»): an element code cut in the middle counts as
// not typed yet.
function rowPrefix(line, offset, codes) {
  let pre = String(line ?? "").slice(0, Math.max(0, offset));
  const open = pre.lastIndexOf("{");
  if (open >= 0 && pre.indexOf("}", open) < 0) pre = pre.slice(0, open);
  return bracesOut(pre, codes);
}

// The words of a text with where they stand (the same split wrapPassage makes).
const wordsOf = (text) => [...String(text ?? "").matchAll(/(\s*)(\S+)/g)].map((m) => ({ word: m[2], s: m.index + m[1].length, e: m.index + m[0].length }));

// First engine line (sheet row) of every row of the page, and how many sheet rows a row's wrapped lines are apart.
function firstLines(owners) {
  const first = new Map();
  owners.forEach((o, abs) => { if (o != null && !first.has(o)) first.set(o, abs); });
  return first;
}

// Where the caret stands on the sheet: `rowIndex` (in page.rows), `line` (the field text of that row), `offset` in it.
// Returns { abs, x } (abs: the sheet row, engine line index; x: in the row's own units) or null.
export function caretOnSheet({ page, glyphMap, owners, rowIndex, line, offset, codes }) {
  const row = page?.rows?.[rowIndex];
  const first = firstLines(owners);
  const abs0 = first.get(rowIndex);
  if (!row || abs0 == null) return null;
  const k = scaleOf(page);
  if (row.kind === "blank" || !String(row.text ?? "").trim()) return { abs: abs0, x: startX(page, glyphMap, abs0) };
  if (row.kind !== "passage") {
    const pre = rowPrefix(line, offset, codes);
    if (!pre) return { abs: abs0, x: placed(`${rowToLine(row)}`, page, glyphMap, abs0).minX ?? startX(page, glyphMap, abs0) };
    const lineOf = rowToLine({ ...row, text: pre.trimEnd() });
    const w = lineOf ? placed(lineOf, page, glyphMap, abs0).width : startX(page, glyphMap, abs0);
    const spaces = pre.length - pre.trimEnd().length;
    return { abs: abs0, x: w + spaces * SPACE_UNITS * k };
  }
  // running text: the wrapped line the caret is on, the text of that line up to the caret
  const text = String(row.text ?? "");
  const ruling = pageRuling(page);
  const wrapped = wrapPassage(text, glyphMap, ruling, rowMaxX(page), indentUnitsOf(text, ruling), pageSnap(page));
  const step = page?.writeAfter ? 2 : 1;
  const words = wordsOf(text);
  const pre = rowPrefix(line, offset, codes);
  const at = pre.length; // the caret in the row's own text (the prefix is the row text up to it)
  // the word the caret is in or right after
  let j = -1;
  for (let i = 0; i < words.length; i += 1) if (words[i].s < at) j = i;
  // which wrapped line each word is on
  const lineOfWord = [];
  wrapped.forEach((l, L) => { for (const t of l.split(" ")) if (t && !/^_\d+$/.test(t)) lineOfWord.push(L); });
  if (j < 0) {
    const flags = leadingSpaces(text) ? `#1#i${leadingSpaces(text)}` : "#1";
    return { abs: abs0, x: wrapped[0] ? (placed(`${wrapped[0]}${flags}`, page, glyphMap, abs0).minX ?? startX(page, glyphMap, abs0)) : startX(page, glyphMap, abs0) };
  }
  const L = lineOfWord[j] ?? Math.max(0, wrapped.length - 1);
  const abs = abs0 + L * step;
  // the line's own tokens up to word j, the word itself cut at the caret
  const toks = String(wrapped[L] ?? "").split(" ");
  const out = [];
  let wi = lineOfWord.indexOf(L);
  for (const t of toks) {
    if (/^_\d+$/.test(t)) { out.push(t); continue; }
    if (wi === j) { out.push(text.slice(words[j].s, Math.min(at, words[j].e))); break; }
    out.push(t);
    wi += 1;
  }
  const flags = L === 0 && leadingSpaces(text) ? `#1#i${leadingSpaces(text)}` : "#1";
  const w = placed(`${out.join(" ")}${flags}`, page, glyphMap, abs).width;
  const spaces = at > words[j].e ? at - words[j].e : 0;
  return { abs, x: w + spaces * SPACE_UNITS * k };
}

// A point on sheet row `abs` (x in the row's units) -> { rowIndex, offset }: the letter boundary of the line nearest to the point.
// `lines`: the field text, one line per row. A row the «write after» option adds (owner null) belongs to the row above it.
export function caretFromSheet({ page, glyphMap, owners, abs, x, lines, codes }) {
  let at = abs;
  while (at > 0 && owners[at] === null) at -= 1;
  const rowIndex = owners[at];
  if (rowIndex == null) return null;
  const line = String(lines[rowIndex] ?? "");
  let best = { offset: line.length, d: Infinity };
  for (let off = 0; off <= line.length; off += 1) {
    const pre = line.slice(0, off);
    if (pre.lastIndexOf("{") > pre.lastIndexOf("}")) continue; // inside an element code
    const spot = caretOnSheet({ page, glyphMap, owners, rowIndex, line, offset: off, codes });
    if (!spot || spot.abs !== at) continue;
    const d = Math.abs(spot.x - x);
    if (d < best.d) best = { offset: off, d };
  }
  return { rowIndex, offset: best.offset };
}
