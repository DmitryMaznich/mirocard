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
  return { id: newId("r"), kind: "text", text: "", mark: "", ...patch };
}

export function newPage(title = "Новая страница", patch = {}) {
  const now = Date.now();
  return { id: newId("pg"), title, ruling: "narrow", rows: [newRow()], createdAt: now, updatedAt: now, ...patch };
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
  const text = String(row?.text ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  return row.mark === "d" || row.mark === "c" ? `${text}#${row.mark}` : text;
}

// Non-empty rows only, in order; row numbers on screen and on paper count the same list.
export function pageToLines(page) {
  return (page?.rows ?? []).map(rowToLine).filter(Boolean);
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
  if (!text) return { empty: true, unsupported: [], overflow: false };
  const unsupported = findUnsupported(text, glyphMap);
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
