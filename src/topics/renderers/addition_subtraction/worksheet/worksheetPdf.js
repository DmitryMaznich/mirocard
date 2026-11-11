// «Контрольная работа» as an A4 vector PDF: the sheet (one or more pages) and,
// on a separate page, the answers for the adult. Laid out here in millimetres
// from the generated sheet (sections.js), drawn as SVG and turned into a PDF by
// the app's svgPagesToPdf; every text is Nunito outlines (outlineText), the
// signs + − = and the chain arrows are drawn as strokes (the outline font has
// no «−»). Black and white: plus and minus differ by shape, not colour.
// This module is in the app bundle (the topic's deck ZIP has only topic.json).

const PAGE = { w: 210, h: 297, left: 16, right: 16, top: 16, bottom: 16 };
const INK = "#1d2422";
const GREY = "#5b6663";
const NUM = 7.2;          // number height (mm, font size)
const BOX = 10;           // answer box (1 cm, a notebook square pair)
const GAP = 2.2;          // between tokens
const ROW = 15;           // row pitch
const COL_GAP = 12;
const SECTION_HEAD = 11;

const f = (v) => Number(v.toFixed(2));

function signPath(op, cx, cy, size = 4.2, width = 0.75) {
  const h = size / 2;
  const plus = op === "add" ? `M${f(cx)} ${f(cy - h)}V${f(cy + h)}` : "";
  return `<path d="M${f(cx - h)} ${f(cy)}H${f(cx + h)}${plus}" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" fill="none"/>`;
}

function equalsPath(cx, cy) {
  return `<path d="M${f(cx - 2)} ${f(cy - 1)}H${f(cx + 2)}M${f(cx - 2)} ${f(cy + 1)}H${f(cx + 2)}" stroke="${INK}" stroke-width="0.7" stroke-linecap="round" fill="none"/>`;
}

const boxRect = (x, y, w = BOX, h = BOX, r = 1.2) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}" fill="none" stroke="${INK}" stroke-width="0.35"/>`;

// Draws one item from (x, baseline) and returns { markup, width }.
async function drawItem(item, x, baseline, outlineText, { dryRun = false } = {}) {
  const parts = [];
  let cx = x;
  const mid = baseline - NUM * 0.36; // optical middle of the digits
  const isChain = item.tokens.some((t) => t.t === "arrow");
  for (const tok of item.tokens) {
    if (tok.t === "num") {
      if (isChain) {
        const r = BOX / 2;
        const label = await outlineText(String(tok.v), NUM * 0.85, 0, 0, { weight: 800, fill: INK });
        const t = await outlineText(String(tok.v), NUM * 0.85, cx + r - label.width / 2, mid + NUM * 0.3, { weight: 800, fill: INK });
        if (!dryRun) parts.push(`<circle cx="${f(cx + r)}" cy="${f(mid)}" r="${r}" fill="none" stroke="${INK}" stroke-width="0.35"/>`, t.markup);
        cx += BOX + GAP;
      } else {
        const t = await outlineText(String(tok.v), NUM, cx, baseline, { weight: 800, fill: INK });
        if (!dryRun) parts.push(t.markup);
        cx += t.width + GAP;
      }
    } else if (tok.t === "op") {
      if (!dryRun) parts.push(signPath(tok.op, cx + 2.4, mid));
      cx += 4.8 + GAP;
    } else if (tok.t === "eq") {
      if (!dryRun) parts.push(equalsPath(cx + 2, mid));
      cx += 4 + GAP;
    } else if (tok.t === "blank") {
      if (!dryRun) {
        if (isChain) parts.push(`<circle cx="${f(cx + BOX / 2)}" cy="${f(mid)}" r="${BOX / 2}" fill="none" stroke="${INK}" stroke-width="0.35"/>`);
        else parts.push(boxRect(cx, mid - BOX / 2));
      }
      cx += BOX + GAP;
    } else if (tok.t === "arrow") {
      const len = 13;
      const label = await outlineText(String(tok.d), 3.6, 0, 0, { weight: 800, fill: INK });
      const labelW = 3 + 0.8 + label.width;
      if (!dryRun) {
        const lx = cx + (len - labelW) / 2;
        parts.push(signPath(tok.op, lx + 1.5, mid - 3.6, 2.6, 0.5));
        parts.push((await outlineText(String(tok.d), 3.6, lx + 3.8, mid - 2.4, { weight: 800, fill: INK })).markup);
        parts.push(`<path d="M${f(cx + 0.5)} ${f(mid)}H${f(cx + len - 0.5)}M${f(cx + len - 2.5)} ${f(mid - 1.4)}L${f(cx + len - 0.5)} ${f(mid)}L${f(cx + len - 2.5)} ${f(mid + 1.4)}" stroke="${INK}" stroke-width="0.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
      cx += len + GAP;
    }
  }
  return { markup: parts.join(""), width: cx - x - GAP };
}

function line(x1, x2, y, width = 0.35, color = INK) {
  return `<path d="M${f(x1)} ${f(y)}H${f(x2)}" stroke="${color}" stroke-width="${width}" fill="none"/>`;
}

async function header(sheet, outlineText, { answers = false } = {}) {
  const out = [];
  const x = PAGE.left;
  const right = PAGE.w - PAGE.right;
  out.push((await outlineText(answers ? "ОТВЕТЫ · ДЛЯ ВЗРОСЛОГО" : "КОНТРОЛЬНАЯ РАБОТА · ПЛЮС И МИНУС", 3, x, PAGE.top + 3, { weight: 800, fill: GREY })).markup);
  out.push((await outlineText(sheet.title, 7.5, x, PAGE.top + 12, { weight: 900, fill: INK })).markup);
  if (!answers) {
    const label = await outlineText("Отметка", 3.4, 0, 0, { weight: 700 });
    out.push((await outlineText("Отметка", 3.4, right - 14 - label.width - 2, PAGE.top + 9, { weight: 700, fill: GREY })).markup);
    out.push(`<circle cx="${f(right - 7)}" cy="${f(PAGE.top + 8)}" r="6.5" fill="none" stroke="${INK}" stroke-width="0.4"/>`);
    const y = PAGE.top + 24;
    const name = await outlineText("Имя", 4, x, y, { weight: 700, fill: INK });
    out.push(name.markup, line(x + name.width + 2, x + 112, y + 0.6, 0.35));
    const date = await outlineText("Дата", 4, x + 120, y, { weight: 700, fill: INK });
    out.push(date.markup, line(x + 120 + date.width + 2, right, y + 0.6, 0.35));
    out.push(line(x, right, PAGE.top + 29, 0.6));
    return { markup: out.join(""), bottom: PAGE.top + 37 };
  }
  out.push(line(x, right, PAGE.top + 17, 0.6));
  return { markup: out.join(""), bottom: PAGE.top + 25 };
}

async function sectionHeading(index, text, y, outlineText) {
  const x = PAGE.left;
  const n = await outlineText(String(index + 1), 4, 0, 0, { weight: 900 });
  return [
    `<circle cx="${f(x + 3.6)}" cy="${f(y - 1.4)}" r="3.6" fill="none" stroke="${INK}" stroke-width="0.5"/>`,
    (await outlineText(String(index + 1), 4, x + 3.6 - n.width / 2, y, { weight: 900, fill: INK })).markup,
    (await outlineText(text, 5, x + 10, y + 0.3, { weight: 900, fill: INK })).markup,
  ].join("");
}

function footer(pageIndex, pageCount, total) {
  return { pageIndex, pageCount, total };
}

async function footerMarkup({ pageIndex, pageCount, total }, outlineText, { answers }) {
  const y = PAGE.h - PAGE.bottom + 4;
  const x = PAGE.left;
  const right = PAGE.w - PAGE.right;
  const out = [line(x, right, y - 4.5, 0.25, "#9aa5a2")];
  out.push((await outlineText("Mirocard · Плюс и минус", 3, x, y, { weight: 700, fill: GREY })).markup);
  const tail = answers ? `стр. ${pageIndex + 1} из ${pageCount}` : `Верно: ______ из ${total}${pageCount > 1 ? `   ·   стр. ${pageIndex + 1} из ${pageCount}` : ""}`;
  const t = await outlineText(tail, 3, 0, 0, { weight: 700 });
  out.push((await outlineText(tail, 3, right - t.width, y, { weight: 700, fill: GREY })).markup);
  return out.join("");
}

// Pages of the sheet: sections one after another, a row never split, a new
// page when the next row (with its section heading) doesn't fit.
async function sheetPages(sheet, outlineText) {
  const pages = [];
  let current = null;
  const maxY = PAGE.h - PAGE.bottom - 8;
  const newPage = async (first) => {
    const h = first ? await header(sheet, outlineText) : { markup: "", bottom: PAGE.top + 4 };
    current = { parts: [h.markup], y: h.bottom };
    pages.push(current);
  };
  await newPage(true);
  const usable = PAGE.w - PAGE.left - PAGE.right - 10;
  for (const [si, section] of sheet.sections.entries()) {
    let widest = 0;
    for (const item of section.items) widest = Math.max(widest, (await drawItem(item, 0, 0, outlineText, { dryRun: true })).width + 7);
    const cols = Math.max(1, Math.min(3, Math.floor((usable + COL_GAP) / (widest + COL_GAP))));
    const colW = (usable - COL_GAP * (cols - 1)) / cols;
    const rows = Math.ceil(section.items.length / cols);
    // Keep a section on one page when it fits on a page at all.
    const sectionH = SECTION_HEAD + rows * ROW;
    const pageH = maxY - (PAGE.top + 4);
    if (current.y + sectionH > maxY && sectionH <= pageH) await newPage(false);
    else if (current.y + SECTION_HEAD + ROW > maxY) await newPage(false);
    current.parts.push(await sectionHeading(si, section.instruction, current.y, outlineText));
    current.y += SECTION_HEAD;
    for (let r = 0; r < rows; r += 1) {
      if (current.y + ROW - 4 > maxY) await newPage(false);
      const baseline = current.y + NUM * 0.55;
      for (let c = 0; c < cols; c += 1) {
        const k = c * rows + r; // column-major: reads down, like a notebook
        const item = section.items[k];
        if (!item) continue;
        const x = PAGE.left + 10 + c * (colW + COL_GAP);
        const no = await outlineText(`${k + 1}.`, 3.2, x, baseline - 0.5, { weight: 700, fill: GREY });
        current.parts.push(no.markup, (await drawItem(item, x + 6, baseline, outlineText)).markup);
      }
      current.y += ROW;
    }
    current.y += 5;
  }
  return pages;
}

const answerText = (section, item) => item.answers
  .map((a) => (a === "add" ? "+" : a === "subtract" ? "–" : String(a)))
  .join(section.type === "chain" ? ", " : " ");

async function answerPages(sheet, outlineText) {
  const pages = [];
  const h = await header(sheet, outlineText, { answers: true });
  let current = { parts: [h.markup], y: h.bottom };
  pages.push(current);
  const maxY = PAGE.h - PAGE.bottom - 30;
  const width = PAGE.w - PAGE.left - PAGE.right - 10;
  for (const [si, section] of sheet.sections.entries()) {
    if (current.y + 20 > maxY) { current = { parts: [], y: PAGE.top + 4 }; pages.push(current); }
    current.parts.push(await sectionHeading(si, section.instruction, current.y, outlineText));
    current.y += 9;
    let x = PAGE.left + 10;
    for (const [k, item] of section.items.entries()) {
      const label = `${k + 1}) ${answerText(section, item)}`;
      const t = await outlineText(label, 4.6, 0, 0, { weight: 800 });
      if (x + t.width > PAGE.left + 10 + width) { x = PAGE.left + 10; current.y += 7.5; }
      current.parts.push((await outlineText(label, 4.6, x, current.y, { weight: 800, fill: INK })).markup);
      x += t.width + 8;
    }
    current.y += 12;
  }
  // Score per section, to fill in.
  const y = Math.max(current.y + 4, PAGE.h - PAGE.bottom - 24);
  const x0 = PAGE.left;
  const boxW = PAGE.w - PAGE.left - PAGE.right;
  current.parts.push(boxRect(x0, y - 6.5, boxW, 13, 2));
  const per = boxW / Math.max(1, sheet.sections.length);
  for (const [si, section] of sheet.sections.entries()) {
    current.parts.push((await outlineText(`${si + 1}. ___ из ${section.items.length}`, 3.8, x0 + 4 + si * per, y + 1.3, { weight: 700, fill: INK })).markup);
  }
  return pages;
}

// Returns the PDF as a Blob: the sheet page(s), then the answers page.
// The outline font has no «−» (U+2212): print an en dash in text instead.
const safeText = (outlineText) => (text, ...rest) => outlineText(String(text).replace(/\u2212/g, "–"), ...rest);

export async function makeWorksheetPdf(sheet) {
  const lib = await import("@/features/printLetters/printLettersPdf");
  const { svgPagesToPdf } = lib;
  const outlineText = safeText(lib.outlineText);
  const sheetP = await sheetPages(sheet, outlineText);
  const answerP = await answerPages(sheet, outlineText);
  const pages = [];
  for (const [i, p] of sheetP.entries()) {
    const foot = await footerMarkup(footer(i, sheetP.length, sheet.total), outlineText, { answers: false });
    pages.push({ w: PAGE.w, h: PAGE.h, markup: `<rect width="${PAGE.w}" height="${PAGE.h}" fill="#fff"/>${p.parts.join("")}${foot}` });
  }
  for (const [i, p] of answerP.entries()) {
    const foot = await footerMarkup(footer(i, answerP.length, sheet.total), outlineText, { answers: true });
    pages.push({ w: PAGE.w, h: PAGE.h, markup: `<rect width="${PAGE.w}" height="${PAGE.h}" fill="#fff"/>${p.parts.join("")}${foot}` });
  }
  return svgPagesToPdf(pages);
}

// Exposed for a preview / tests: the pages' SVG markup without making a PDF.
export async function worksheetSvgPages(sheet, rawOutlineText) {
  const outlineText = safeText(rawOutlineText);
  const sheetP = await sheetPages(sheet, outlineText);
  const answerP = await answerPages(sheet, outlineText);
  const out = [];
  for (const [i, p] of sheetP.entries()) out.push(`${p.parts.join("")}${await footerMarkup(footer(i, sheetP.length, sheet.total), outlineText, { answers: false })}`);
  for (const [i, p] of answerP.entries()) out.push(`${p.parts.join("")}${await footerMarkup(footer(i, answerP.length, sheet.total), outlineText, { answers: true })}`);
  return out;
}
