import LetterBlock from "./LetterBlock";
import WordBlock, { PlateWords } from "./WordBlock";
import { isWordBlock, wordLetters } from "./words";
import LetterGlyph from "./LetterGlyph";
import { GAP, letterCells, blockCells, blockHeightCells, drawnSize, headerCells, paperGap, paperOf, sheetSizeMm } from "./model";
import { FINE_MM } from "./Ruling";
import { MIRONIUM_HEAD } from "./brand";

const mm = (cells) => `${cells * FINE_MM}mm`;
const HEAD_GLYPH_MM = 5.6;     // the header plates' white letters (the page's letters are 10mm)
const HEAD_PLATE_PAD_MM = 1.8; // a plate's margin either side of its letters
const HEAD_INK_MM = 0.8;       // a glyph's ink past its box: the stroke's own width

// One printable sheet at its real size: the paper format minus the printer
// margin (@page). The same component draws the page on the canvas, inside a
// thumbnail (scaled) and in the print run, so the three never disagree.
// `nameLine`: the «Имя ____ Дата ____» lines of the header (the notebook's toolbar option).
export default function Sheet({ page, format, byId, className = "", style, selectedBlockId = null, selectedRowId = null, onSelectBlock, onSelectRow, nameLine = true, pageNo = null, brand = false }) {
  const { w, h } = sheetSizeMm(format);
  // On paper, 1mm less than the exact printable height: an exact fit can
  // round over and push a blank sheet out after every page.
  const heightMm = className.includes("pl-sheet--print") ? h - 1 : h;
  // Every block is placed at its exact offset from the sheet's corner, counted in whole cells
  // (model.js) — not stacked one after another. Stacked, each block's height was rounded to the
  // screen's pixels on its own and the error added up: every next block's frame sat a little further
  // off the grid (owner, 2026-11-03: «каждый следующий блок съезжает относительно сетки»).
  const paper = paperOf(page);
  const gap = paperGap(paper);
  const heights = page.blocks.map((b) => blockHeightCells(b, paper) + gap);
  const place = heights.map((_, i) => GAP + headerCells(paper) + heights.slice(0, i).reduce((a, x) => a + x, 0));
  const at = (i) => ({ position: "absolute", top: mm(place[i]), left: mm(GAP) });
  return (
    <div
      className={`pl-sheet pl-sheet--${paperOf(page)} ${className}`}
      style={{ width: `${w}mm`, height: `${heightMm}mm`, ...style }}
    >
      <SheetGrid paper={paperOf(page)} w={w} h={heightMm} />
      {/* the PDF's page number (PdfPages.jsx): at the bottom, by the outer edge — right on odd pages,
          left on even ones, as in a notebook */}
      {pageNo != null && (
        <span className="pl-sheet-pageno" style={{ position: "absolute", bottom: "1.5mm", [pageNo % 2 ? "right" : "left"]: mm(GAP) }}>{pageNo}</span>
      )}
      {/* the quiet Mironium mark of the PDF (PdfPages.jsx; owner, 2026-11-05: «чтобы в PDF был брендированный
          лист»): bottom centre, in the blank GAP cell under the last row — the strip of the page number, where
          no block ever reaches — on a white backing over the grid, light grey, as propis2's mark on its pages */}
      {brand && (
        <span className="pl-sheet-brand" style={{ position: "absolute", bottom: "1.2mm", left: "50%", transform: "translateX(-50%)" }}>
          <svg viewBox="0 0 420 440" width="3mm" height="3.1mm" style={{ width: "3mm", height: "3.1mm" }} aria-hidden="true">
            <path d={MIRONIUM_HEAD} fill="#aab2ba" />
          </svg>
          <span className="pl-sheet-brand-url">mironium.com</span>
        </span>
      )}
      {page.blocks.length > 0 && (
        <div className="pl-sheet-head-at" style={{ position: "absolute", top: mm(GAP), left: mm(GAP), width: mm(blockCells(format)) }}>
          <SheetHeader page={page} byId={byId} nameLine={nameLine} format={format} />
        </div>
      )}
      {page.blocks.map((b, i) => {
        if (isWordBlock(b)) {
          return (
            <WordBlock
              key={b.id}
              style={at(i)}
              block={b}
              byId={byId}
              format={format}
              size={drawnSize(b, paperOf(page))}
              paper={paperOf(page)}
              selected={b.id === selectedBlockId}
              selectedRowId={b.id === selectedBlockId ? selectedRowId : null}
              onSelectBlock={() => onSelectBlock?.(b.id)}
              onSelectRow={(rowId) => onSelectRow?.(b.id, rowId)}
            />
          );
        }
        const letter = byId[b.letterId];
        if (!letter) return null;
        return (
          <LetterBlock
            key={b.id}
            style={at(i)}
            letter={letter}
            byId={byId}
            color={b.color}
            rows={b.rows}
            format={format}
            size={drawnSize(b, paperOf(page))}
            paper={paperOf(page)}
            selected={b.id === selectedBlockId}
            selectedRowId={b.id === selectedBlockId ? selectedRowId : null}
            onSelectBlock={() => onSelectBlock?.(b.id)}
            onSelectRow={(rowId) => onSelectRow?.(b.id, rowId)}
          />
        );
      })}
    </div>
  );
}

// The notebook grid, drawn as vector lines exactly every 5mm (крупная клетка: every 10mm, from
// 5mm in). It used to be a CSS background tile, but a browser snaps a tile to whole device pixels
// once the sheet is scaled down (`zoom` to fit a phone): the grid then crept a fraction of a pixel
// per cell away from the blocks, which sit at exact sizes — further down the page, the further off
// (owner, 2026-11-03: «каждый следующий блок съезжает относительно сетки»). Lines in an SVG in
// millimetres scale with the sheet exactly, on screen and on paper.
const GRID = {
  cell: { step: 5, offset: 0, color: "#bcd4e8" },
  bigcell: { step: 10, offset: 5, color: "#9fbfdc" },
};
function SheetGrid({ paper, w, h }) {
  const g = GRID[paper];
  if (!g) return null;
  const xs = [];
  for (let x = g.offset; x <= w + 0.01; x += g.step) xs.push(x);
  const ys = [];
  for (let y = g.offset; y <= h + 0.01; y += g.step) ys.push(y);
  const d = xs.map((x) => `M${x} 0V${h}`).join("") + ys.map((y) => `M0 ${y}H${w}`).join("");
  return (
    <svg className="pl-sheet-grid" viewBox={`0 0 ${w} ${h}`} width={`${w}mm`} height={`${h}mm`} style={{ width: `${w}mm`, height: `${h}mm` }} aria-hidden="true">
      <path d={d} fill="none" stroke={g.color} strokeWidth="1" vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
    </svg>
  );
}

// «Имя ____ Дата ____» (optional, the notebook's toolbar switch) — the child (or adult) writes them
// in: a name is itself a writing goal at this age, the date lets progress be compared across sheets.
// On the right: «Пишем» and the page's letters and words, drawn with the same strokes as in the
// blocks, not typed in a font.
// Syllables and words are listed after the letters, the heading becomes «Пишем».
function SheetHeader({ page, byId, nameLine, format }) {
  // «Пишем» as a table of contents of the sheet (owner, 2026-11-06: «непропорциональна маленькая…
  // запятая посредине строки выглядит плохо… сделай органичным и современным»): a small caps kicker,
  // then each letter / syllable / word of the page on a mini plate in its block's colour — the block
  // plate's own shape (leaf corners), 2 cells tall like the header, whole cells wide, flush right on
  // the grid, no commas. A letter in several blocks takes its first block's colour.
  // А5 (owner, 2026-11-06: «в А5 только буквы»): no syllable / word plates, only letters — a word block
  // gives its letters, each one plate, so a page of words still shows what it drills
  const lettersOnly = format === "a5";
  const seen = new Set();
  const items = [];
  for (const b of page.blocks) {
    const isWord = isWordBlock(b);
    const word = isWord && !lettersOnly;
    const keys = !isWord ? [b.letterId] : word ? (b.words ?? []) : wordLetters((b.words ?? []).join(""), byId).map((l) => l.id);
    for (const key of keys) {
      if (!key || seen.has(`${word}${key}`) || (!word && !byId[key])) continue;
      seen.add(`${word}${key}`);
      const letters = word ? wordLetters(key, byId) : [byId[key]];
      if (!letters.length) continue;
      // the drawn width: each letter its own cells at HEAD_GLYPH_MM (2 cells = the glyph's height), a
      // 0.4-height gap between a word's letters; the plate is that plus the margins, rounded up to cells
      const w = letters.reduce((a, l) => a + (letterCells(l) / 2) * HEAD_GLYPH_MM + HEAD_INK_MM, 0) + (letters.length - 1) * HEAD_GLYPH_MM * 0.4;
      items.push({ key: `${word ? "w" : "l"}${key}`, word, key, color: b.color ?? "#8b93a1", cells: Math.max(2, Math.ceil((w + 2 * HEAD_PLATE_PAD_MM) / FINE_MM)) });
    }
  }
  // never over «Имя / Дата»: the plates that do not fit fold into «+N»
  // the cells left by «Имя ___ Дата ___» at their narrowest (labels + 30mm + 18mm + gaps ≈ 80mm), «ПИШЕМ» and «+N»
  // (≈ 25mm) — measured on the PDF
  // А5: its name and date lines are shorter (CSS .pl-sheet-head--a5), so it leaves 7 cells of its 25
  const budget = blockCells(format) - (nameLine ? (lettersOnly ? 18 : 22) : 6);
  let used = 0;
  const shown = [];
  for (const it of items) {
    if (used + it.cells > budget && shown.length) break;
    used += it.cells;
    shown.push(it);
  }
  const more = items.length - shown.length;
  return (
    <div className={`pl-sheet-head${lettersOnly ? " pl-sheet-head--a5" : ""}`}>
      {nameLine && <>
        <span>Имя</span><span className="pl-sheet-head-line pl-sheet-head-line--name" />
        <span>Дата</span><span className="pl-sheet-head-line pl-sheet-head-line--date" />
      </>}
      <span className="pl-sheet-head-fill" />
      {items.length > 0 && (
        <span className="pl-sheet-head-title">
          <span className="pl-sheet-head-kicker">ПИШЕМ</span>
          {more > 0 && <span className="pl-sheet-head-more">+{more}</span>}
          <span className="pl-sheet-head-plates">
            {shown.map((it) => (
              <span key={it.key} className="pl-sheet-head-plate" style={{ width: mm(it.cells), background: it.color }} aria-label={it.key}>
                {it.word
                  ? <PlateWords words={[it.key]} byId={byId} heightMm={HEAD_GLYPH_MM} color="#ffffff" weight={14} />
                  : <LetterGlyph letter={byId[it.key]} heightMm={HEAD_GLYPH_MM} variant="plain" color="#ffffff" weight={14} />}
              </span>
            ))}
          </span>
        </span>
      )}
    </div>
  );
}

