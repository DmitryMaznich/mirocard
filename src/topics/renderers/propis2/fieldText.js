// «Прописи 2»: the one text field of the constructor. It holds the rows of the page from a chosen row to the end, one row
// per line (Enter = a new row on the sheet). Typing in it rewrites exactly that tail of the page; the rows above are not
// touched. This module is the pure part: rows -> field text, field text -> rows.
import { lineWidth, newRow, rowMaxX } from "./model.js";

const isEmptyRow = (r) => r.kind === "blank" || (r.kind !== "passage" && !String(r.text ?? "").trim());

// Rows shown in the field: from `startIndex` on, trailing empty rows left out.
export function fieldFromRows(rows, startIndex) {
  const tail = rows.slice(Math.max(0, startIndex));
  let end = tail.length;
  while (end > 0 && isEmptyRow(tail[end - 1])) end -= 1;
  return tail.slice(0, end).map((r) => (r.kind === "blank" ? "" : String(r.text ?? "").replace(/\s*\n\s*/g, " "))).join("\n");
}

// What one line of the field is on the sheet: empty -> a blank writing row; more than two words (or two words that do not
// fit the row) -> running text, wrapped over the rows; otherwise a sample row. `asText` (true / false) is the adult's own
// choice for the row and wins over the rule.
export function inferRowKind(line, glyphMap, page, asText) {
  const t = String(line ?? "").trim();
  if (!t) return "blank";
  if (asText === true) return "passage";
  if (asText === false) return "text";
  const words = t.split(/\s+/).length;
  if (words > 2) return "passage";
  if (words === 2 && glyphMap && lineWidth(t, glyphMap, page?.ruling) > rowMaxX(page)) return "passage";
  return "text";
}

const PARAM_KEYS = ["repeat", "dots", "copies", "mark", "asText"];
const paramsOf = (row) => Object.fromEntries(PARAM_KEYS.filter((k) => row?.[k] !== undefined).map((k) => [k, row[k]]));

// Rewrites the tail of the page that starts at row `startId` (null = after the last row with content) from the field's
// text. A line keeps the row that stood at its place (its id and options); a new line gets the options of the row above it;
// rows past the last line are removed.
export function rowsFromField({ rows, startId, value, glyphMap, page }) {
  const lines = String(value ?? "").split(/\r?\n/);
  let startIndex = startId ? rows.findIndex((r) => r.id === startId) : -1;
  if (startIndex < 0) {
    startIndex = rows.length;
    while (startIndex > 0 && isEmptyRow(rows[startIndex - 1])) startIndex -= 1;
  }
  if (!startId && lines.length === 1 && !lines[0].trim()) return { rows, firstId: null };
  const head = rows.slice(0, startIndex);
  const tail = rows.slice(startIndex);
  let prev = head[head.length - 1] ?? null;
  const next = lines.map((line, k) => {
    const old = tail[k];
    const kind = inferRowKind(line, glyphMap, page, old?.asText);
    const keepKind = old?.kind === "element" && kind === "text" ? "element" : kind;
    const row = old ? { ...old, kind: keepKind, text: line } : { ...newRow({ kind: keepKind, text: line }), ...(prev ? paramsOf(prev) : {}) };
    if (kind === "blank") row.text = "";
    prev = row;
    return row;
  });
  return { rows: [...head, ...next], firstId: next[0]?.id ?? null };
}

// Which row of the page the caret is on, given the field's text, the caret offset and the row the field starts at.
export function rowIdAtCaret(rows, startId, value, caret) {
  const start = Math.max(0, startId ? rows.findIndex((r) => r.id === startId) : rows.length);
  const line = String(value ?? "").slice(0, caret).split("\n").length - 1;
  return rows[start + line]?.id ?? null;
}

// Puts `token` (an element's id) into the field: into the caret's line when that is empty, else on a new line below it.
export function insertLine(value, caret, token) {
  const lines = String(value ?? "").split("\n");
  const at = Math.min(lines.length - 1, String(value ?? "").slice(0, caret).split("\n").length - 1);
  if (!lines[at]?.trim()) lines[at] = token;
  else lines.splice(at + 1, 0, token);
  const line = lines[at]?.trim() === token && !String(value ?? "").split("\n")[at]?.trim() ? at : at + 1;
  const text = lines.join("\n");
  const caretAfter = lines.slice(0, line + 1).join("\n").length;
  return { value: text, caret: caretAfter };
}
