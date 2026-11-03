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
export const LETTER_H = 2; // a letter is 2 cells tall at the normal size

// Letter size, per block (methodology: large before small — a new letter is
// written big, a practised one at the working size). Only 2 and 4 cells:
// doubling keeps every stroke on a grid line (3 cells would put crossbars
// and right sticks in the middle of a cell, or change the letter's shape).
export const SIZES = [
  { id: 2, label: "Обычный", hint: "буква в 2 клетки (1 см) — рабочий размер" },
  { id: 4, label: "Крупный", hint: "буква в 4 клетки (2 см) — для новой буквы и маленьких" },
];

export function blockSize(block) {
  return block?.size === 4 ? 4 : 2;
}

// Height and width of a letter, in cells, at a block size.
export function letterH(size = 2) {
  return size;
}
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

// Rows beside the letter plate start one cell after it; every row below the
// plate uses the block from edge to edge (owner, 2026-11-03: no wasted space
// under the plate). A row is beside the plate when its letters would start
// higher than one blank cell below the plate's bottom edge.
export function rowBesidePlate(index, size = 2) {
  return index * (GAP + letterH(size)) + GAP < TILE + GAP;
}

// Where a row's letters start, in cells from the block's left edge.
export function rowStartCells(besidePlate) {
  return besidePlate ? TILE + GAP : GAP;
}

// Writing width of a row: from its start to one blank cell before the right edge.
export function rowCells(formatId, besidePlate = true) {
  return blockCells(formatId) - rowStartCells(besidePlate) - GAP;
}

export function letterCells(letter) {
  return Math.max(1, Number(letter?.cells) || 1);
}

export function letterW(letter, size = 2) {
  return (letterCells(letter) * size) / 2;
}

// Copies of a letter in one row: its own width plus one blank cell each, no
// trailing gap after the last one.
export function copiesPerRow(letter, formatId, besidePlate = true, size = 2) {
  const w = letterW(letter, size);
  return Math.max(1, Math.floor((rowCells(formatId, besidePlate) + GAP) / (w + GAP)));
}

export function blockHeightCells(block) {
  const rows = block.rows.length;
  return Math.max(TILE, rows * (GAP + letterH(blockSize(block))) + GAP);
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

// ---- Paper ---------------------------------------------------------------
// Page-level. A step of the support ladder too: клетка holds the letter on
// every side; линейка leaves the width and the spacing to the child, with
// the height (2 lines) and also the middle (3 lines: a dashed middle line
// for crossbars) still marked. On линейка each row draws its own lines for
// its block's size — there is no page-wide ruling, the sheet is plain.
export const PAPERS = [
  { id: "cell", label: "Клетка" },
  { id: "line3", label: "Линейка: 3 линии" },
  { id: "line2", label: "Линейка: 2 линии" },
];

// Pages saved before the two ruled papers existed say "line".
export function paperOf(page) {
  const p = page?.paper;
  return p === "line" ? "line3" : PAPERS.some((x) => x.id === p) ? p : "cell";
}

export function isRuled(paper) {
  return paper === "line3" || paper === "line2";
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
