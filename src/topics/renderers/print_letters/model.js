import { FINE_MM } from "./Ruling";
import { canMiss, describeTask } from "./tasks";

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

// The size a block is actually drawn at on a page. On линейка the ruling
// sets the size (owner, 2026-11-03): one letter = one row between the lines,
// the same for every block on the page — a child gets used to that row; the
// large size is a step on клетка only (large → normal → then линейка).
export function drawnSize(block, paper) {
  return paper === "cell" ? blockSize(block) : 2;
}

// Blank space, in our 5mm cells, around rows on a paper: above each row,
// before its first letter, after its last one, under the block and between
// blocks. On the 1cm big cell it is a whole big cell (2 of ours), so every
// edge — block, plate, each letter's left side, top and bottom — lands on a
// 1cm line, and writing rows go every other row, as in Ilyukhina's workbook.
export function paperGap(paper = "cell") {
  return paper === "bigcell" ? 2 : GAP;
}

// The sheet header plus the blank space under it.
export function headerCells(paper = "cell") {
  return 2 + paperGap(paper);
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
export function rowBesidePlate(index, size = 2, paper = "cell") {
  const g = paperGap(paper);
  return index * (g + letterH(size)) + g < TILE + GAP;
}

// The plate's height (owner, 2026-11-03, drawing: «размер цветной плашки как на рисунке»): it runs
// down the block's left side beside every row that stands next to it — to the band of the first row
// that uses the full block width — never shorter than its 4 cells. With 2-cell letters on клетка
// that is 2 rows = 6 cells; on крупная клетка and for large letters 1 row.
export function plateHeightCells(rowCount, size = 2, paper = "cell") {
  const g = paperGap(paper);
  let beside = 0;
  while (beside < rowCount && rowBesidePlate(beside, size, paper)) beside++;
  return Math.max(TILE, beside * (g + letterH(size)));
}

// Where a row's letters start, in cells from the block's left edge. `plateW`: the plate's width —
// 4 cells for a letter, wider for a syllable or word (words.js plateCells).
export function rowStartCells(besidePlate, paper = "cell", plateW = TILE) {
  const g = paperGap(paper);
  return besidePlate ? plateW + g : g;
}

// Writing width of a row: from its start to one blank cell before the right edge.
export function rowCells(formatId, besidePlate = true, paper = "cell", plateW = TILE) {
  return blockCells(formatId) - rowStartCells(besidePlate, paper, plateW) - paperGap(paper);
}

// Width of a letter in our 5mm cells at the normal size. Ilyukhina
// (docs/print-letters-ilyukhina.md): a letter stands in one letter-cell
// (≈1cm = our 2×2 cells) at its left line and takes half of it (most letters:
// 1 of our cells) or two thirds (`wide`: Д Ж Л М Ф Ш Щ Ю Ы А Т — 4/3 cells).
export function letterCells(letter) {
  if (letter?.wide) return 4 / 3;
  return Math.max(1, Number(letter?.cells) || 1);
}

export function letterW(letter, size = 2) {
  return (letterCells(letter) * size) / 2;
}

// Copies of a letter in one row: its own width plus one blank cell each, no
// trailing gap after the last one.
// One copy per letter-cell: the step is the letter's own height (a square
// letter-cell — 2 of our cells at the normal size, 4 at the large one); the
// letter stands at the cell's left line, the rest of the cell stays blank.
export function copyPitch(size = 2) {
  return letterH(size);
}

export function copiesPerRow(letter, formatId, besidePlate = true, size = 2, paper = "cell") {
  const w = letterW(letter, size);
  return Math.max(1, Math.floor((rowCells(formatId, besidePlate, paper) - w) / copyPitch(size)) + 1);
}

export function blockHeightCells(block, paper = "cell") {
  const rows = block.rows.length;
  const g = paperGap(paper);
  return Math.max(TILE, rows * (g + letterH(drawnSize(block, paper))) + g);
}

export function pageHeightCells(page) {
  if (!page.blocks.length) return 0;
  const paper = paperOf(page);
  return page.blocks.reduce((sum, b) => sum + blockHeightCells(b, paper), 0) + (page.blocks.length - 1) * paperGap(paper);
}


export function pageOverflows(page, formatId) {
  return pageHeightCells(page) > sheetCells(formatId).rows - headerCells(paperOf(page));
}

// ---- Paper ---------------------------------------------------------------
// Page-level (owner, 2026-11-03), three papers:
//  - bigcell: the 1cm cell of Ilyukhina's workbook — one letter in one cell,
//    at its left line; the child divides the cell "with the eyes";
//  - cell: the 5mm school-notebook cell — top, bottom, left side and middle
//    of a letter all on lines (the most support);
//  - line: school ruled paper, rows 1cm tall: the letter stands on the solid
//    baseline, a dashed line marks its height, a blank gap between rows.
// The large letter size exists on `cell` only; on the other two one letter
// is always one cell / one row (1cm).
export const PAPERS = [
  { id: "bigcell", label: "Крупная клетка" },
  { id: "cell", label: "Клетка" },
  { id: "line", label: "Линейка" },
];

// Unpublished drafts once had two ruled papers ("line3", "line2").
export function paperOf(page) {
  const p = page?.paper;
  if (p === "line3" || p === "line2") return "line";
  return PAPERS.some((x) => x.id === p) ? p : "cell";
}

export function isRuled(paper) {
  return paper === "line";
}

// ---- Rows ----------------------------------------------------------------
// A row is { id, elements, support }: `elements` — indices of the letter's
// strokes drawn in this row (sorted; [] = a blank row for writing on one's
// own); `support` — how much help each copy gives (most-to-least prompting).
// How the copies after the sample look — three independent options of a row (owner, 2026-11-03;
// they replace the single «опора» list: dotted / starts / fade / sample):
//   line   — what a contour is drawn with: a half-tone solid line or a dotted line;
//   guide  — contours to the end of the row, fading along it, or none (write on your own);
//   dots   — green start dots: only on the sample, on every contour too, or none at all.
// Every stroke of the row gets its own dot.
export const LINES = [
  { id: "tone", label: "Полутон" },
  { id: "dash", label: "Пунктир" },
];
export const GUIDES = [
  { id: "full", label: "До конца строки" },
  { id: "fade", label: "Затухают" },
  { id: "none", label: "Без контуров" },
];
export const DOTS = [
  { id: "sample", label: "На образце" },
  { id: "all", label: "На всех" },
  { id: "none", label: "Без точек" },
];
// `arrows`: the thin red direction arrows on the sample (owner, 2026-11-03: «опцией вкл/выкл»).
export const DEFAULT_STYLE = { line: "dash", guide: "full", dots: "all", arrows: true };

// A row's three options; notebooks saved before them carry `support` instead.
const FROM_SUPPORT = {
  dotted: { line: "dash", guide: "full", dots: "sample" },
  starts: { line: "tone", guide: "full", dots: "all" },
  fade: { line: "tone", guide: "fade", dots: "sample" },
  sample: { line: "tone", guide: "none", dots: "sample" },
};
export function rowStyle(row) {
  const base = FROM_SUPPORT[row?.support] ?? DEFAULT_STYLE;
  return {
    line: row?.line ?? base.line,
    guide: row?.guide ?? base.guide,
    dots: row?.dots ?? base.dots,
    arrows: row?.arrows ?? true,
  };
}
// Set one option; the row is rewritten in the new form (the old `support` goes).
export function withStyle(row, patch) {
  const { support, ...rest } = row;
  return { ...rest, ...rowStyle(row), ...patch };
}
// Short words for a status line: «пунктир · затухают · точки на всех».
export function describeStyle(row) {
  const task = describeTask(row);
  if (task) return task;
  if (!row.elements.length) return "пустая строка";
  const st = rowStyle(row);
  const parts = [];
  if (st.guide === "none") parts.push("только образец");
  else parts.push(LINES.find((l) => l.id === st.line).label.toLowerCase(), GUIDES.find((g) => g.id === st.guide).label.toLowerCase());
  if (st.dots !== "none") parts.push(st.dots === "all" ? "точки на всех" : "точки на образце");
  if (!st.arrows) parts.push("без стрелок");
  if (row.sample === false && st.guide !== "none") parts.unshift("без образца");
  return parts.join(" · ");
}

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
// all dotted), then the support fades (whole letter fading), then «допиши штрих» with a start dot and
// without (tasks.js; owner, 2026-11-05 — after the contours, where the child has traced the letter),
// one sample and write on, then a blank row. Matches the printed workbook the owner sent
// (first row one stroke, then strokes add up, last row the whole letter)
// plus the most-to-least prompting ladder from docs/print-letters.md.
export function ladderRows(letter) {
  const n = letter.strokes.length;
  const all = allElements(letter);
  const rows = [];
  for (let k = 1; k <= n; k++) rows.push({ elements: all.slice(0, k), ...DEFAULT_STYLE });
  rows.push({ elements: all, line: "tone", guide: "fade", dots: "all" });
  if (canMiss(letter)) {
    rows.push({ elements: all, ...DEFAULT_STYLE, task: "miss", hint: "dot" });
    rows.push({ elements: all, ...DEFAULT_STYLE, task: "miss", hint: "none" });
  }
  rows.push({ elements: all, line: "tone", guide: "none", dots: "sample" });
  rows.push({ elements: [], ...DEFAULT_STYLE });
  return rows;
}

// A NEW letter block (owner, 2026-11-10: «слишком много вариантов в каждый новый блок… ограничиться
// 3-4 строками с разной комбинацией штрихов и обязательно внизу целая буква»): the letter assembled in a
// few steps, the whole letter always last — the full ladder above stays on the block's «Лесенка» button
// and in the ready notebooks.
//   1 stroke (О, С): the whole letter dotted, fading, then after a sample only;
//   2 strokes: the first, the second, the whole letter;
//   3 strokes: the first, the first two, the whole letter;
//   4 and more: the first, two, three, the whole letter.
export function starterRows(letter) {
  const n = letter.strokes.length;
  const all = allElements(letter);
  if (n <= 1) {
    return [
      { elements: all, ...DEFAULT_STYLE },
      { elements: all, line: "tone", guide: "fade", dots: "all", arrows: true },
      { elements: all, line: "tone", guide: "none", dots: "sample", arrows: true },
    ];
  }
  const steps = n === 2 ? [[0], [1]] : all.slice(0, Math.min(n - 1, 3)).map((_, k) => all.slice(0, k + 1));
  return [...steps, all].map((elements) => ({ elements, ...DEFAULT_STYLE }));
}

// What each copy in a row draws. The first copy of every non-blank row is the SAMPLE — solid, with
// arrows and (unless dots are off) numbered start dots: the child first sees how the letter is
// written, then practises. The others follow the row's options (rowStyle): a half-tone or dotted
// contour, to the end of the row or fading along it, or nothing after the sample; start dots on
// them too when dots are «на всех». One entry per copy: null or { variant, opacity, dots }.
export function copyPlan(row, copies) {
  if (!row.elements.length) return Array.from({ length: copies }, () => null);
  const st = rowStyle(row);
  // `row.sample === false` (syllable / word rows, owner 2026-11-03): no sample at the start — the row
  // is contours from its first copy; a «sample only» row always keeps it (it would be empty otherwise)
  const withSample = row.sample !== false || st.guide === "none";
  const first = withSample ? 1 : 0;
  return Array.from({ length: copies }, (_, i) => {
    if (i === 0 && withSample) return { variant: "sample", opacity: 1, dots: st.dots !== "none", arrows: st.arrows };
    if (st.guide === "none") return null;
    const variant = st.line === "dash" ? "dotted" : "trace";
    let opacity = 1;
    if (st.guide === "fade") {
      const t = copies - first > 1 ? (i - first) / (copies - first - 1) : 0;
      opacity = Math.max(0.15, 1 - t * 0.85);
    }
    return { variant, opacity, dots: st.dots === "all" };
  });
}
