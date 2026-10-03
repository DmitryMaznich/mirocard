// «Прописи 2»: page model and its translation into the line strings the shared wide-row engine
// understands ("И#d" = sample with start dots, "И#c" = clean row, see wordEngine.js).
import { layoutWideLinesIntoRows, wideTokenToLabels, WIDE_ROW_MAX_X } from "../propis/wordEngine.js";

export const RULINGS = [
  { id: "narrow", label: "Узкая строка" },
  { id: "wide", label: "Широкая строка" },
];

export const ROW_KINDS = [
  { id: "text", label: "Буквы, слоги, слова" },
  { id: "element", label: "Элемент" },
  { id: "passage", label: "Текст (переносится по строкам)" },
  { id: "blank", label: "Пустая строка для письма" },
];

export const ROW_MARKS = [
  { id: "", label: "Образец" },
  { id: "d", label: "Образец + точки старта" },
  { id: "c", label: "Чистая строка" },
];

let counter = 0;
export function newId(prefix = "p") {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function newRow(patch = {}) {
  return { id: newId("r"), kind: "text", text: "", mark: "", marked: false, ...patch };
}

export function newPage(title = "Новая страница", patch = {}) {
  const now = Date.now();
  return { id: newId("pg"), title, ruling: "narrow", writeAfter: false, rows: [newRow()], createdAt: now, updatedAt: now, ...patch };
}

// A ready methodology sheet ("Н#d", "г1 г1", "5 5"...) becomes an editable page.
export function pageFromLines(title, lines, ruling = "narrow", elementLabels = new Set()) {
  const rows = (lines ?? []).map((line) => {
    const m = /^(.*?)#([dc])$/.exec(line);
    const text = m ? m[1] : line;
    const isElement = elementLabels.has(text.trim());
    return newRow({ kind: isElement ? "element" : "text", text, mark: m ? m[2] : "" });
  });
  return newPage(title, { ruling, rows: rows.length ? rows : [newRow()] });
}

export function rowToLine(row) {
  if (row?.kind === "blank") return "";
  const text = String(row?.text ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  return row.mark === "d" || row.mark === "c" ? `${text}#${row.mark}` : text;
}

const lineWidth = (text, glyphMap, ruling) => {
  const { placed } = layoutWideLinesIntoRows([text], glyphMap, undefined, false, ruling === "narrow" ? 0.5 : 1);
  return placed[0]?.segments?.[0]?.width ?? 0;
};

// Greedy wrap of running text into lines that fit the printable width. A single word wider than
// the line stays on its own line (the editor warns about it); nothing is cut.
export function wrapPassage(text, glyphMap, ruling = "narrow") {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const cand = cur ? `${cur} ${word}` : word;
    if (!cur || lineWidth(cand, glyphMap, ruling) <= WIDE_ROW_MAX_X) cur = cand;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Rows -> engine lines, in order. Row numbers on screen and on paper count this same list:
// sample rows, wrapped text lines (each written once, "#1"), blank writing rows ("" is a ruled
// empty row for the engine) and, when page.writeAfter is on, a blank row after every sample row.
export function pageToLines(page, glyphMap) {
  const out = [];
  for (const row of page?.rows ?? []) {
    if (row.kind === "blank") { out.push(""); continue; }
    if (row.kind === "passage") {
      const wrapped = glyphMap ? wrapPassage(row.text, glyphMap, page?.ruling) : String(row.text ?? "").trim() ? [String(row.text).trim()] : [];
      for (const l of wrapped) { out.push(`${l}#1`); if (page?.writeAfter) out.push(""); }
      continue;
    }
    const line = rowToLine(row);
    if (!line) continue;
    out.push(line);
    if (page?.writeAfter) out.push("");
  }
  return out;
}

// A new editable page from the rows marked "для повторения" (whole rows only in this version).
export function pageFromMarked(sourcePage, title) {
  const rows = (sourcePage?.rows ?? []).filter((r) => r.marked).map((r) => ({ ...r, id: newId("r"), marked: false }));
  if (!rows.length) return null;
  return newPage(title ?? `${sourcePage.title}: повторение`, { ruling: sourcePage.ruling, writeAfter: sourcePage.writeAfter, rows });
}

export function duplicateRow(rows, index) {
  const copy = { ...rows[index], id: newId("r") };
  return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
}

export function moveRow(rows, index, delta) {
  const to = index + delta;
  if (to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
}

// Characters of `text` that no glyph covers (the engine silently skips them; the constructor
// must say so). Same longest-match walk as wideTokenToLabels, so the verdicts agree.
export function findUnsupported(text, glyphMap) {
  const out = [];
  for (const token of String(text ?? "").split(/\s+/).filter(Boolean)) {
    if (token.includes("+") || glyphMap.has(token)) continue;
    let i = 0;
    while (i < token.length) {
      let hit = 0;
      for (let len = Math.min(token.length - i, 4); len >= 1; len -= 1) {
        if (glyphMap.has(token.slice(i, i + len))) { hit = len; break; }
      }
      if (hit) i += hit;
      else { if (!out.includes(token[i])) out.push(token[i]); i += 1; }
    }
  }
  return out;
}

// { empty, unsupported: [chars], overflow } for one row. Overflow = the row, written once with no
// multiplying, is wider than the printable line (it would be clipped on the page).
export function analyzeRow(row, glyphMap, ruling = "narrow") {
  const text = String(row?.text ?? "").trim();
  if (row?.kind === "blank") return { empty: false, blank: true, unsupported: [], overflow: false };
  if (!text) return { empty: true, unsupported: [], overflow: false };
  const unsupported = findUnsupported(text, glyphMap);
  if (row?.kind === "passage") {
    // wrapped, so only a single word wider than the line can overflow
    const tooWide = text.split(/\s+/).some((w) => lineWidth(w, glyphMap, ruling) > WIDE_ROW_MAX_X);
    return { empty: false, unsupported, overflow: tooWide };
  }
  let overflow = false;
  if (!unsupported.length || wideTokenToLabels(text.split(/\s+/)[0], glyphMap).length) {
    try {
      const { placed } = layoutWideLinesIntoRows([text], glyphMap, undefined, false, ruling === "narrow" ? 0.5 : 1);
      const width = placed[0]?.segments?.[0]?.width ?? 0;
      overflow = width > WIDE_ROW_MAX_X;
    } catch {
      overflow = false;
    }
  }
  return { empty: false, unsupported, overflow };
}

export function analyzePage(page, glyphMap) {
  const rows = (page?.rows ?? []).map((row) => analyzeRow(row, glyphMap, page?.ruling));
  return {
    rows,
    problems: rows.filter((r) => r.unsupported.length || r.overflow).length,
  };
}

// The word under a tap: `rowWord` is the placed row's text (words separated by spaces, possibly the
// same word repeated across the line), `localX` the tap position in the row's own units. Word k is
// where the line written up to word k has not yet reached the tap.
export function pickFragment(rowWord, localX, glyphMap, ruling = "narrow") {
  const words = String(rowWord ?? "").split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? "";
  for (let k = 0; k < words.length; k += 1) {
    if (lineWidth(words.slice(0, k + 1).join(" "), glyphMap, ruling) >= localX - 6) return words[k];
  }
  return words[words.length - 1];
}
