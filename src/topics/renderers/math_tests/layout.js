// «Контрольные по математике»: the sheet as a school notebook page. Everything stands on the
// grid: one digit or sign per cell, an answer box is as many cells as the biggest answer has
// digits, a sign box is one cell. A block is a frame with its number and name, its examples in
// columns (top to bottom, like in a notebook). Pages follow from the blocks: a block that does not
// fit the rest of a page starts the next one (a block is never cut).
// `layoutTest(test)` gives the pages; `pagePrimitives(page, …)` turns one page into plain shapes
// (lines, rects, texts) that both the screen (SheetSvg.jsx) and the PDF (pdf.js) draw — one
// source for what the child sees and what is printed.
import { buildBlock, blockTitle, blockInstruction } from "./blocks.js";

export const FORMATS = {
  a4: { id: "a4", label: "А4", w: 210, h: 297 },
  a5: { id: "a5", label: "А5", w: 148, h: 210 },
};
export const PAPERS = {
  cell: { id: "cell", label: "Клетка", cell: 5 },
  bigcell: { id: "bigcell", label: "Крупная клетка", cell: 7.5 },
};
const MARGIN = 5; // mm, the printer's margin

export function gridOf(test) {
  const f = FORMATS[test.format] ?? FORMATS.a4;
  const cell = (PAPERS[test.paper] ?? PAPERS.cell).cell;
  const cols = Math.floor((f.w - 2 * MARGIN) / cell);
  const rows = Math.floor((f.h - 2 * MARGIN) / cell);
  return { w: f.w, h: f.h, cell, cols, rows, ox: (f.w - cols * cell) / 2, oy: (f.h - rows * cell) / 2 };
}

const tokenWidth = (t, bw) => (t.t === "num" ? String(t.v).length : t.t === "arrow" ? 3 : t.t === "blank" ? (t.kind === "num" || !t.kind ? bw : 1) : 1);

// one block laid out from row r0 (relative cells); returns its height and items with cell positions
function layoutBlock(block, built, grid, r0) {
  const bw = String(built.maxNumber ?? 20).length;
  const items = built.items.map((item) => {
    let c = 0;
    const tokens = item.tokens.map((t) => {
      const w = tokenWidth(t, bw);
      const placed = { ...t, c, w };
      c += w;
      return placed;
    });
    return { ...item, tokens, width: c };
  });
  const itemW = Math.max(1, ...items.map((it) => it.width));
  const inner = grid.cols - 4; // frame on columns 1 and cols-1, one cell of padding inside
  const gap = 3;
  const fitCols = Math.max(1, Math.floor((inner + gap) / (itemW + gap)));
  const cols = Math.max(1, Math.min(block.cols === "auto" ? Math.min(fitCols, 4) : block.cols, fitCols, items.length));
  const perCol = Math.ceil(items.length / cols);
  const hasArrows = items.some((it) => it.tokens.some((t) => t.t === "arrow"));
  const pitch = hasArrows ? 3 : 2;
  const colStep = cols > 1 ? Math.max(itemW + gap, Math.floor((inner - itemW) / (cols - 1))) : 0;
  const firstRow = r0 + 3 + (hasArrows ? 1 : 0);
  const placed = items.map((it, k) => {
    const col = Math.floor(k / perCol);
    const row = k % perCol;
    return { ...it, index: k, c0: 2 + col * colStep, r: firstRow + row * pitch };
  });
  const lastRow = firstRow + (perCol - 1) * pitch;
  const h = lastRow + 2 - r0;
  return { h, items: placed };
}

export function layoutTest(test) {
  const grid = gridOf(test);
  const pages = [];
  let page = null;
  let r = 0;
  const startPage = () => {
    page = { index: pages.length, blocks: [] };
    pages.push(page);
    r = pages.length === 1 ? (test.nameLine !== false ? 5 : 3) : 1;
  };
  startPage();
  let no = 0;
  for (const block of test.blocks ?? []) {
    const built = buildBlock(block);
    no += 1;
    let laid = layoutBlock(block, built, grid, r);
    if (r + laid.h > grid.rows - 1 && page.blocks.length > 0) {
      startPage();
      laid = layoutBlock(block, built, grid, r);
    }
    page.blocks.push({ block, built, no, r0: r, h: laid.h, items: laid.items });
    r += laid.h + 2;
  }
  return { grid, pages, overflow: pages.some((p) => p.blocks.some((b) => b.r0 + b.h > grid.rows)) };
}

// every answer box of the test, in solving order (block by block, column by column)
export function blanksOf(layout) {
  const list = [];
  for (const page of layout.pages) {
    for (const b of page.blocks) {
      for (const it of b.items) {
        for (const t of it.tokens) {
          if (t.t !== "blank") continue;
          list.push({ key: `${b.block.id}:${it.index}:${t.i}`, blockId: b.block.id, kind: t.kind, w: t.w, answer: it.answers[t.i], page: page.index });
        }
      }
    }
  }
  return list;
}

export const COLORS = {
  grid: "#b9d3ea",
  ink: "#263131",
  muted: "#5b6663",
  frame: "#45524f",
  child: "#1d4ed8",
  box: "#7f8e8b",
  focus: "#fff3c4",
  focusStroke: "#d9a21b",
  right: "#e3f5e9",
  rightStroke: "#2e9b5a",
  wrong: "#fde8e8",
  wrongStroke: "#c04040",
  fix: "#1f7a4f",
};

// The shapes of one page. Text is { k: "text", x, y (baseline), size, weight, fill, anchor };
// `values` (key → typed string), `marks` (key → "right"|"wrong"), `focus` (key) and
// `showAnswers` decide what the boxes show.
export function pagePrimitives(layout, pageIndex, { test, values = {}, marks = null, focus = null, showAnswers = false, answerTitle = false } = {}) {
  const { grid } = layout;
  const page = layout.pages[pageIndex];
  const { cell, ox, oy } = grid;
  const X = (c) => ox + c * cell;
  const Y = (r) => oy + r * cell;
  const out = [];
  const lw = Math.max(0.3, cell * 0.06);
  const digit = cell * 0.78;

  // the grid
  for (let c = 0; c <= grid.cols; c += 1) out.push({ k: "line", x1: X(c), y1: Y(0), x2: X(c), y2: Y(grid.rows), stroke: COLORS.grid, w: 0.18 });
  for (let r = 0; r <= grid.rows; r += 1) out.push({ k: "line", x1: X(0), y1: Y(r), x2: X(grid.cols), y2: Y(r), stroke: COLORS.grid, w: 0.18 });

  const text = (s, x, y, size, opts = {}) => out.push({ k: "text", text: String(s), x, y, size, weight: opts.weight ?? 700, fill: opts.fill ?? COLORS.ink, anchor: opts.anchor ?? "start" });
  const digitAt = (s, c, r, fill = COLORS.ink) => text(s, X(c + 0.5), Y(r + 0.5) + digit * 0.36, digit, { anchor: "middle", fill, weight: 800 });
  // + − = drawn as strokes so they look the same on screen and in the PDF
  const opAt = (op, cx, cy, size, stroke = COLORS.ink) => {
    const a = size * 0.3;
    out.push({ k: "line", x1: cx - a, y1: cy, x2: cx + a, y2: cy, stroke, w: lw * 1.4, cap: "round" });
    if (op === "add") out.push({ k: "line", x1: cx, y1: cy - a, x2: cx, y2: cy + a, stroke, w: lw * 1.4, cap: "round" });
  };
  const eqAt = (cx, cy, size, stroke = COLORS.ink) => {
    const a = size * 0.28;
    out.push({ k: "line", x1: cx - a, y1: cy - size * 0.12, x2: cx + a, y2: cy - size * 0.12, stroke, w: lw * 1.4, cap: "round" });
    out.push({ k: "line", x1: cx - a, y1: cy + size * 0.12, x2: cx + a, y2: cy + size * 0.12, stroke, w: lw * 1.4, cap: "round" });
  };
  // < > = of a comparison, strokes too
  const cmpAt = (sign, cx, cy, size, stroke = COLORS.ink) => {
    if (sign === "=") { eqAt(cx, cy, size, stroke); return; }
    const a = size * 0.24;
    const h = size * 0.28;
    const tip = sign === "<" ? cx - a : cx + a;
    const back = sign === "<" ? cx + a : cx - a;
    out.push({ k: "path", d: `M ${back} ${cy - h} L ${tip} ${cy} L ${back} ${cy + h}`, stroke, w: lw * 1.4, fill: "none" });
  };
  const isCmp = (v) => v === "<" || v === ">" || v === "=";

  // the header of the first page
  if (pageIndex === 0) {
    const title = (answerTitle ? "Ответы · " : "") + (test.title || "Контрольная работа");
    text(title, X(1), Y(2) - cell * 0.22, cell * 1.05, { weight: 900 });
    if (test.nameLine !== false && !answerTitle) {
      const y = Y(4) - cell * 0.22;
      text("Имя", X(1), y, cell * 0.7, { weight: 700, fill: COLORS.muted });
      out.push({ k: "line", x1: X(3.2), y1: Y(4) - cell * 0.12, x2: X(Math.floor(grid.cols * 0.62)), y2: Y(4) - cell * 0.12, stroke: COLORS.muted, w: 0.25 });
      const dc = Math.floor(grid.cols * 0.66);
      text("Дата", X(dc), y, cell * 0.7, { weight: 700, fill: COLORS.muted });
      out.push({ k: "line", x1: X(dc + 2.4), y1: Y(4) - cell * 0.12, x2: X(grid.cols - 1), y2: Y(4) - cell * 0.12, stroke: COLORS.muted, w: 0.25 });
    }
  }

  for (const b of page.blocks) {
    const { block, no, r0, h } = b;
    out.push({ k: "rect", x: X(1), y: Y(r0), w: X(grid.cols - 1) - X(1), h: h * cell, rx: cell * 0.3, stroke: COLORS.frame, w2: lw, fill: "none", blockId: block.id, role: "frame" });
    // number in a circle + the block's name and instruction
    out.push({ k: "circle", cx: X(2.5), cy: Y(r0 + 1.5), r: cell * 0.42, stroke: COLORS.ink, w2: lw, fill: "#fff" });
    text(no, X(2.5), Y(r0 + 1.5) + cell * 0.22, cell * 0.6, { anchor: "middle", weight: 900 });
    text(blockTitle(block), X(3.4), Y(r0 + 2) - cell * 0.25, cell * 0.72, { weight: 900 });
    text(blockInstruction(block), X(3.4) + blockTitle(block).length * cell * 0.47 + cell * 0.8, Y(r0 + 2) - cell * 0.25, cell * 0.62, { weight: 600, fill: COLORS.muted });

    for (const it of b.items) {
      for (const t of it.tokens) {
        const c = it.c0 + t.c;
        const r = it.r;
        if (t.t === "num") String(t.v).split("").forEach((d, k) => digitAt(d, c + k, r));
        else if (t.t === "op") opAt(t.op, X(c + 0.5), Y(r + 0.5), cell);
        else if (t.t === "eq") eqAt(X(c + 0.5), Y(r + 0.5), cell);
        else if (t.t === "arrow") {
          const y = Y(r + 0.5);
          out.push({ k: "line", x1: X(c) + cell * 0.2, y1: y, x2: X(c + 3) - cell * 0.25, y2: y, stroke: COLORS.ink, w: lw, cap: "round" });
          out.push({ k: "path", d: `M ${X(c + 3) - cell * 0.5} ${y - cell * 0.2} L ${X(c + 3) - cell * 0.22} ${y} L ${X(c + 3) - cell * 0.5} ${y + cell * 0.2}`, stroke: COLORS.ink, w: lw, fill: "none" });
          // the step above the arrow: sign in one cell, the number after it
          opAt(t.op, X(c + 0.5), Y(r - 0.5), cell * 0.9);
          String(t.d).split("").forEach((d, k) => digitAt(d, c + 1 + k, r - 1));
        } else if (t.t === "blank") {
          const key = `${block.id}:${it.index}:${t.i}`;
          const answer = it.answers[t.i];
          const mark = marks?.[key] ?? null;
          const isFocus = focus === key;
          const fill = isFocus ? COLORS.focus : mark === "right" ? COLORS.right : mark === "wrong" ? COLORS.wrong : "none";
          const stroke = isFocus ? COLORS.focusStroke : mark === "right" ? COLORS.rightStroke : mark === "wrong" ? COLORS.wrongStroke : COLORS.box;
          out.push({ k: "rect", x: X(c) + 0.25, y: Y(r) + 0.25, w: t.w * cell - 0.5, h: cell - 0.5, rx: cell * 0.12, stroke, w2: isFocus || mark ? lw * 1.5 : lw, fill, blankKey: key, role: "blank" });
          const shown = showAnswers ? (typeof answer === "number" ? String(answer) : answer) : values[key] ?? "";
          const ink = showAnswers ? COLORS.fix : COLORS.child;
          if (t.kind === "sign") {
            if (shown === "add" || shown === "subtract") opAt(shown, X(c + 0.5), Y(r + 0.5), cell, ink);
          } else if (t.kind === "cmp") {
            if (isCmp(shown)) cmpAt(shown, X(c + 0.5), Y(r + 0.5), cell, ink);
          } else {
            String(shown).split("").slice(0, t.w).forEach((d, k) => digitAt(d, c + k, r, ink));
          }
          if (mark === "wrong") {
            // the right answer, small, over the box's top-right corner
            const fixText = typeof answer === "number" ? String(answer) : "+";
            const bx = X(c + t.w) - cell * 0.05;
            const by = Y(r) - cell * 0.05;
            const bwid = cell * (0.38 + 0.36 * fixText.length);
            out.push({ k: "rect", x: bx - bwid * 0.5, y: by - cell * 0.32, w: bwid, h: cell * 0.62, rx: cell * 0.3, stroke: COLORS.fix, w2: lw * 0.8, fill: "#ffffff" });
            if (typeof answer === "number") text(fixText, bx, by + cell * 0.14, cell * 0.5, { anchor: "middle", weight: 900, fill: COLORS.fix });
            else if (isCmp(answer)) cmpAt(answer, bx, by - cell * 0.01, cell * 0.55, COLORS.fix);
            else opAt(answer, bx, by - cell * 0.01, cell * 0.55, COLORS.fix);
          }
        }
      }
    }
  }
  return out;
}
