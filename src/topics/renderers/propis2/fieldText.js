// «Прописи 2»: the one text field of the constructor. It holds the rows of the page from a chosen row to the end, one row
// per line (Enter = a new row on the sheet). Typing in it rewrites exactly that tail of the page; the rows above are not
// touched. This module is the pure part: rows -> field text, field text -> rows.
import { newRow } from "./model.js";

const isEmptyRow = (r) => r.kind === "blank" || (r.kind !== "passage" && !String(r.text ?? "").trim());

// Rows shown in the field: from `startIndex` on, trailing empty rows left out.
export function fieldFromRows(rows, startIndex) {
  const tail = rows.slice(Math.max(0, startIndex));
  let end = tail.length;
  while (end > 0 && isEmptyRow(tail[end - 1])) end -= 1;
  return tail.slice(0, end).map((r) => (r.kind === "blank" ? "" : String(r.text ?? "").replace(/\s*\n\s*/g, " "))).join("\n");
}

// What one line of the field is on the sheet: empty -> a blank writing row; ANY space (leading too: spaces before the text
// move it to the right, so a word can stand mid-row; a trailing one: the adult is going on to the next word) -> running text,
// wrapped over the rows; otherwise a sample row. `asText` (true / false) is the adult's own choice for the row.
export function inferRowKind(line, glyphMap, page, asText) {
  void glyphMap; void page;
  const t = String(line ?? "");
  if (!t.trim()) return "blank";
  if (asText === true) return "passage";
  if (asText === false) return "text";
  return /\s/.test(t) ? "passage" : "text";
}

const PARAM_KEYS = ["repeat", "dots", "copies", "mark", "asText", "gap"];
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
  // Lines are matched to the rows that stood there by what did not change: the unchanged lines at the start and at the end
  // keep their rows (and so their options), only the changed stretch in between is rewritten by place. So pressing Enter in
  // the middle of a row, or deleting a line, does not push the rows below out of step with their own options.
  const oldText = tail.map((r) => (r.kind === "blank" ? "" : String(r.text ?? "").replace(/\s*\n\s*/g, " ")));
  let pre = 0;
  while (pre < lines.length && pre < tail.length && lines[pre] === oldText[pre]) pre += 1;
  let suf = 0;
  while (suf < lines.length - pre && suf < tail.length - pre && lines[lines.length - 1 - suf] === oldText[tail.length - 1 - suf]) suf += 1;
  const build = (line, old) => {
    const kind = inferRowKind(line, glyphMap, page, old?.asText);
    const keepKind = old?.kind === "element" && kind === "text" ? "element" : kind;
    const row = old ? { ...old, kind: keepKind, text: line } : { ...newRow({ kind: keepKind, text: line }), ...(prev ? paramsOf(prev) : {}) };
    if (kind === "blank") row.text = "";
    return row;
  };
  const next = [];
  for (let i = 0; i < pre; i += 1) { next.push(tail[i]); prev = tail[i]; }
  for (let i = pre; i < lines.length - suf; i += 1) { const row = build(lines[i], i < tail.length - suf ? tail[i] : undefined); next.push(row); prev = row; }
  for (let j = suf; j > 0; j -= 1) next.push(tail[tail.length - j]);
  return { rows: [...head, ...next], firstId: next[0]?.id ?? null };
}

// Which row of the page the caret is on, given the field's text, the caret offset and the row the field starts at.
export function rowIdAtCaret(rows, startId, value, caret) {
  const start = Math.max(0, startId ? rows.findIndex((r) => r.id === startId) : rows.length);
  const line = String(value ?? "").slice(0, caret).split("\n").length - 1;
  return rows[start + line]?.id ?? null;
}

// Puts `token` (an element's id) into the field AT THE CARET, as a word of its own: spaces are added where it touches other
// text, none at the end of the line (a trailing space would turn the row into running text). Returns the new text and the caret.
export function insertToken(value, caret, token) {
  const text = String(value ?? "");
  const at = Math.max(0, Math.min(text.length, caret));
  const left = text.slice(0, at);
  const right = text.slice(at);
  const spaceBefore = left && !/[\s]$/.test(left) ? " " : "";
  const spaceAfter = right && !/^[\s]/.test(right) ? " " : "";
  const before = left + spaceBefore + token;
  return { value: before + spaceAfter + right, caret: before.length + spaceAfter.length };
}
