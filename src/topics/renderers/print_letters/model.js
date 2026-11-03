import { FINE_MM } from "./Ruling";

// ---- Page formats -------------------------------------------------------
// A notebook-wide setting (one physical paper size per print job). The sheet
// on screen is the printable area: the paper minus the printer margin set in
// @page, so what fits on screen is exactly what fits on paper.
export const PAGE_MARGIN_MM = 5;
export const FORMATS = {
  a4: { id: "a4", label: "А4", w: 210, h: 297 },
  a5: { id: "a5", label: "А5", w: 148, h: 210 },
};

export function formatOf(id) {
  return FORMATS[id] ?? FORMATS.a4;
}

export function sheetSizeMm(formatId) {
  const f = formatOf(formatId);
  return { w: f.w - 2 * PAGE_MARGIN_MM, h: f.h - 2 * PAGE_MARGIN_MM };
}

// ---- Block geometry, in whole notebook cells (FINE_MM) -------------------
export const LETTER_H = 2; // a letter is 2 cells tall
export const TILE = 4;     // letter plate: 4×4 cells, flush with the block's top-left corner
export const GAP = 1;      // blank cell: between letters, above each row, after the tile, page padding

// Usable cells inside the sheet's own 1-cell padding.
export function sheetCells(formatId) {
  const { w, h } = sheetSizeMm(formatId);
  return { cols: Math.floor(w / FINE_MM) - 2 * GAP, rows: Math.floor(h / FINE_MM) - 2 * GAP };
}

// A block spans the whole usable width: tile, gap, writing row, gap.
export function blockCells(formatId) {
  return sheetCells(formatId).cols;
}

export function rowCells(formatId) {
  return blockCells(formatId) - TILE - 2 * GAP;
}

export function letterCells(letter) {
  return Math.max(1, Number(letter?.cells) || 1);
}

// Copies of a letter in one row: its own width plus one blank cell each, no
// trailing gap after the last one.
export function copiesPerRow(letter, formatId) {
  const w = letterCells(letter);
  return Math.max(1, Math.floor((rowCells(formatId) + GAP) / (w + GAP)));
}

export function blockHeightCells(block) {
  const rows = block.rows.length;
  return Math.max(TILE, rows * (GAP + LETTER_H) + GAP);
}

export function pageHeightCells(page) {
  if (!page.blocks.length) return 0;
  return page.blocks.reduce((sum, b) => sum + blockHeightCells(b), 0) + (page.blocks.length - 1) * GAP;
}

// The sheet header («Имя ____ Дата ____ · Буква Н»): 2 cells tall plus a
// blank cell before the first block.
export const HEADER_CELLS = 3;

export function pageOverflows(page, formatId) {
  return pageHeightCells(page) > sheetCells(formatId).rows - HEADER_CELLS;
}

// ---- Rows ----------------------------------------------------------------
// A row is { id, elements, support }: `elements` — indices of the letter's
// strokes drawn in this row (sorted; [] = a blank row for writing on one's
// own); `support` — how much help each copy gives (most-to-least prompting).
export const SUPPORTS = [
  { id: "dotted", label: "Пунктир", hint: "образец, дальше обвести по пунктиру" },
  { id: "starts", label: "Точки", hint: "образец, дальше только зелёная точка начала и бледный след" },
  { id: "fade", label: "Бледнеет", hint: "образец, дальше след тает к концу строки" },
  { id: "sample", label: "Образец", hint: "один образец, дальше сам" },
];

export function allElements(letter) {
  return letter.strokes.map((_, i) => i);
}

export function isFull(letter, elements) {
  return elements.length === letter.strokes.length;
}

export function toggleElement(elements, index) {
  const set = new Set(elements);
  if (set.has(index)) set.delete(index); else set.add(index);
  return [...set].sort((a, b) => a - b);
}

export function elementName(letter, index) {
  return letter.strokes[index]?.name ?? `элемент ${index + 1}`;
}

// «Лесенка»: the letter assembled one element at a time (1, 1+2, … whole,
// all dotted), then the support fades (whole letter fading, one sample and
// write on), then a blank row. Matches the printed workbook the owner sent
// (first row one stroke, then strokes add up, last row the whole letter)
// plus the most-to-least prompting ladder from docs/print-letters.md.
export function ladderRows(letter) {
  const n = letter.strokes.length;
  const all = allElements(letter);
  const rows = [];
  for (let k = 1; k <= n; k++) rows.push({ elements: all.slice(0, k), support: "dotted" });
  rows.push({ elements: all, support: "fade" });
  rows.push({ elements: all, support: "sample" });
  rows.push({ elements: [], support: "sample" });
  return rows;
}

// What each copy in a row draws. The first copy of every non-blank row is
// the SAMPLE — solid, with arrows, start dots and numbers: the child first
// sees how the element is written, then practises. The rest depends on the
// support level, from most help to least: dotted guide to trace → start dots
// over a faint trace → a guide fading away along the row → nothing (write on
// your own after the sample). Returns one entry per copy: null or
// { variant, opacity } (variants as in LetterGlyph).
export function copyPlan(row, copies) {
  if (!row.elements.length) return Array.from({ length: copies }, () => null);
  return Array.from({ length: copies }, (_, i) => {
    if (i === 0) return { variant: "sample", opacity: 1 };
    switch (row.support) {
      case "starts":
        return { variant: "starts", opacity: 1 };
      case "fade": {
        const t = copies > 2 ? (i - 1) / (copies - 2) : 0;
        return { variant: "trace", opacity: Math.max(0.15, 1 - t * 0.85) };
      }
      case "sample":
        return null;
      case "dotted":
      default:
        return { variant: "dotted", opacity: 1 };
    }
  });
}
