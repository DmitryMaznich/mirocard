import LetterBlock from "./LetterBlock";
import WordBlock, { PlateWords } from "./WordBlock";
import { isWordBlock } from "./words";
import LetterGlyph from "./LetterGlyph";
import { GAP, blockCells, blockHeightCells, drawnSize, headerCells, paperGap, paperOf, sheetSizeMm } from "./model";
import { FINE_MM } from "./Ruling";
import { MIRONIUM_HEAD } from "./brand";

const mm = (cells) => `${cells * FINE_MM}mm`;

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
          <SheetHeader page={page} byId={byId} nameLine={nameLine} />
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
function SheetHeader({ page, byId, nameLine }) {
  const ids = [...new Set(page.blocks.filter((b) => !isWordBlock(b)).map((b) => b.letterId))].filter((id) => byId[id]);
  const words = [...new Set(page.blocks.filter(isWordBlock).flatMap((b) => b.words ?? []))];
  // «Пишем А, Б, В, МАМА» (owner, 2026-11-03): the letters, then the syllables and words, comma-separated
  const items = [
    ...ids.map((id) => <LetterGlyph key={`l${id}`} letter={byId[id]} heightMm={5} variant="plain" label={byId[id].label} />),
    ...words.map((w) => <PlateWords key={`w${w}`} words={[w]} byId={byId} heightMm={5} color="#1f3a8a" weight={9} />),
  ];
  return (
    <div className="pl-sheet-head">
      {nameLine && <>
        <span>Имя</span><span className="pl-sheet-head-line pl-sheet-head-line--name" />
        <span>Дата</span><span className="pl-sheet-head-line pl-sheet-head-line--date" />
      </>}
      <span className="pl-sheet-head-fill" />
      <span className="pl-sheet-head-title">
        Пишем
        <span className="pl-sheet-head-letters">
          {items.map((item, k) => (
            <span key={k} className="pl-sheet-head-item">{item}{k < items.length - 1 && <span className="pl-sheet-head-comma">,</span>}</span>
          ))}
        </span>
      </span>
    </div>
  );
}
