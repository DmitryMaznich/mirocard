import { BAND_UNITS, styleOf, rowUnits } from "./styles";
import { languageOf } from "./languages";

// «Латиница» notebook model and page layout (docs/latin-letters.md).
//
// A notebook = language + style + paper + size + format + a list of blocks. Blocks flow onto pages by
// themselves (no manual pages): a block is a letter (its rows: capital, small, the pair) or a word.
// Each row is a writing line of the ruling; its `support` says what is printed on it after the sample.
//
// Every length here is in millimetres of the printable sheet. On «Клетка» the band of the ruling is
// one 5 mm cell, and every offset is a whole number of cells, so letters sit on the grid lines.

export const PAGE_MARGIN_MM = 5; // printer margin, as print_letters
export const CELL_MM = 5;
export const FORMATS = {
  a4: { id: "a4", label: "А4", w: 210, h: 297 },
  a5: { id: "a5", label: "А5", w: 148, h: 210 },
};
export const PAPERS = [
  { id: "lines", label: "Четыре линии" },
  { id: "cell", label: "Клетка" },
];
// height of the x-band (a small letter) on the four-line paper; on «Клетка» it is always one cell
export const SIZES = [
  { id: 4, label: "Мелко", hint: "строчная 4 мм" },
  { id: 5, label: "Обычно", hint: "строчная 5 мм" },
  { id: 6, label: "Крупно", hint: "строчная 6 мм" },
  { id: 8, label: "Очень крупно", hint: "строчная 8 мм — для первых букв" },
];
export const SUPPORTS = [
  { id: "trace", label: "Обвести", hint: "образец, дальше пунктир с точками начала" },
  { id: "fade", label: "Бледнеет", hint: "образец, дальше след всё светлее" },
  { id: "dots", label: "Точки", hint: "образец, дальше только точки начала" },
  { id: "sample", label: "Сам", hint: "образец, дальше пустая строка" },
  { id: "empty", label: "Пустая", hint: "строка без образца" },
];
export const CASES = [
  { id: "upper", label: "Заглавная" },
  { id: "lower", label: "Строчная" },
  { id: "pair", label: "Пара" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

export function sheetSizeMm(formatId) {
  const f = FORMATS[formatId] ?? FORMATS.a4;
  return { w: f.w - 2 * PAGE_MARGIN_MM, h: f.h - 2 * PAGE_MARGIN_MM };
}

export function bandMm(nb) {
  return nb.paper === "cell" ? CELL_MM : SIZES.find((s) => s.id === Number(nb.size))?.id ?? 5;
}

// ---- notebook ------------------------------------------------------------------------------

export function newNotebook(over = {}) {
  return {
    id: uid(),
    title: "Новая тетрадь",
    lang: "en",
    style: "print",
    paper: "lines",
    size: 5,
    format: "a4",
    nameLine: true,
    blocks: [],
    updatedAt: Date.now(),
    ...over,
  };
}

export function letterRows() {
  return [
    { id: uid(), case: "upper", support: "trace" },
    { id: uid(), case: "upper", support: "fade" },
    { id: uid(), case: "lower", support: "trace" },
    { id: uid(), case: "lower", support: "fade" },
    { id: uid(), case: "pair", support: "sample" },
  ];
}

export function wordRows() {
  return [
    { id: uid(), support: "trace" },
    { id: uid(), support: "fade" },
    { id: uid(), support: "sample" },
  ];
}

export function newLetterBlock(letter) {
  return { id: uid(), kind: "letter", letter, rows: letterRows() };
}

export function newWordBlock(text) {
  return { id: uid(), kind: "word", text: String(text).trim(), rows: wordRows() };
}

export function newRow(block) {
  return block.kind === "word" ? { id: uid(), support: "sample" } : { id: uid(), case: "pair", support: "sample" };
}

// Only the characters the style can draw (and spaces) stay in a word.
export function cleanWord(text, style) {
  return [...String(text ?? "")].filter((ch) => ch === " " || style.glyphs[ch]).join("").replace(/\s+/g, " ").trim();
}

// ---- text geometry, in glyph units -----------------------------------------------------------

export const LETTER_GAP = 14;      // between letters of a word
export const SPACE = BAND_UNITS;   // a space in a word
export const COPY_GAP = BAND_UNITS; // between copies in a row

// [{ ch, x }] and the width of a text, in units
export function shapeText(text, style) {
  const out = [];
  let x = 0;
  let prevLetter = false;
  for (const ch of text) {
    if (ch === " ") { x += SPACE; prevLetter = false; continue; }
    const g = style.glyphs[ch];
    if (!g) continue;
    if (prevLetter) x += LETTER_GAP;
    out.push({ ch, x });
    x += g.width;
    prevLetter = true;
  }
  return { glyphs: out, width: x };
}

export function rowText(block, row) {
  if (block.kind === "word") return block.text;
  if (row.case === "upper") return block.letter;
  if (row.case === "lower") return block.letter.toLowerCase();
  return block.letter + block.letter.toLowerCase();
}

export function blockLabel(block) {
  return block.kind === "word" ? block.text : block.letter + block.letter.toLowerCase();
}

// What each copy of a row shows: the first is the sample (except «Пустая»), then the support.
export function copyKinds(support, n) {
  const kinds = [];
  for (let i = 0; i < n; i++) {
    if (support === "empty") { kinds.push({ kind: "blank" }); continue; }
    if (i === 0) { kinds.push({ kind: "sample" }); continue; }
    if (support === "trace") kinds.push({ kind: "trace" });
    else if (support === "dots") kinds.push({ kind: "dots" });
    else if (support === "fade") {
      // the trace fades over the first ~2/3 of the copies, then the row is the child's own
      const fading = Math.max(1, Math.round((n - 1) * 0.66));
      const j = i - 1;
      kinds.push(j < fading ? { kind: "fade", opacity: 0.55 - (0.43 * j) / Math.max(1, fading - 1) } : { kind: "blank" });
    } else kinds.push({ kind: "blank" });
  }
  return kinds;
}

// ---- page layout -----------------------------------------------------------------------------

export const PAD_MM = 5;       // sheet padding (1 cell)
export const HEADER_MM = 10;   // «Name ___» line (2 cells)

// Lays the notebook's blocks out on pages. Returns
// { w, h, band, k, pages: [{ rows: [{ blockId, rowId, x, y, w, plate?, copies: [{ x, text, kind, opacity }] }] }] }
// — all in mm; `k` = mm per glyph unit; a row's y is its top line.
export function layout(nb) {
  const style = styleOf(nb.style);
  const { w, h } = sheetSizeMm(nb.format);
  const band = bandMm(nb);
  const k = band / BAND_UNITS;
  const rowH = rowUnits(style) * k;
  const rowGap = band;
  const blockGap = band;
  const onCell = nb.paper === "cell";
  const snap = (mm) => (onCell ? Math.ceil(mm / CELL_MM - 1e-6) * CELL_MM : mm);
  const top0 = PAD_MM + (nb.nameLine === false ? 0 : HEADER_MM);
  const left = PAD_MM;
  const right = w - PAD_MM;
  const bottom = h - PAD_MM;

  const pages = [{ rows: [] }];
  let y = top0;
  nb.blocks.forEach((block, bi) => {
    const label = blockLabel(block);
    const plateW = snap(shapeText(label, style).width * k + 2 * band);
    block.rows.forEach((row, ri) => {
      const page = pages[pages.length - 1];
      if (ri === 0 && page.rows.length) y += blockGap;
      if (y + rowH > bottom + 1e-6) {
        pages.push({ rows: [] });
        y = top0;
      }
      const plate = ri === 0 ? { w: plateW, label, color: plateColor(bi) } : null;
      const x0 = plate ? left + plateW + band : left;
      const text = rowText(block, row);
      const tw = shapeText(text, style).width * k;
      const gap = COPY_GAP * k;
      const avail = right - x0;
      let n = 1;
      if (tw > 0) {
        n = 0;
        let cx = x0;
        while (cx + tw <= right + 1e-6) { n += 1; cx = snap(cx + tw + gap); }
        n = Math.max(1, n);
      }
      const kinds = copyKinds(row.support, n);
      const copies = [];
      let cx = x0;
      for (let i = 0; i < n; i++) {
        copies.push({ x: cx, text, ...kinds[i] });
        cx = snap(cx + tw + gap);
      }
      pages[pages.length - 1].rows.push({ blockId: block.id, rowId: row.id, x: left, x0, y, w: right - left, avail, plate, copies });
      y += rowH + rowGap;
    });
  });
  return { w, h, band, k, rowH, style, pages };
}

// Plate colours — the literacy family's palette (designing-mirocard-screens): teal, blue, red,
// amber, violet; they print as distinct greys too.
export const PLATE_COLORS = ["#4a9b8f", "#1d4ed8", "#dc2626", "#c2410c", "#7c3aed"];
export function plateColor(i) {
  return PLATE_COLORS[i % PLATE_COLORS.length];
}

// ---- ready notebooks -------------------------------------------------------------------------

export function alphabetNotebook(langId = "en") {
  const lang = languageOf(langId);
  return newNotebook({ title: "Алфавит Aa–Zz", lang: lang.id, blocks: lang.alphabet.map(newLetterBlock) });
}
