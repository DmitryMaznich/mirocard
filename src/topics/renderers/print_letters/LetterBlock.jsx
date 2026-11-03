import LetterGlyph, { letterFrame } from "./LetterGlyph";
import { FINE_MM } from "./Ruling";
import { TILE, paperGap, blockCells, rowCells, rowBesidePlate, rowStartCells, copiesPerRow, copyPitch, copyPlan, letterH, letterW, isRuled } from "./model";

const mm = (cells) => `${cells * FINE_MM}mm`;

// A naborny print block for one letter. Every length is a whole number of
// notebook cells (model.js), so every edge — block outline, tile, each
// letter's box — lands on a printed grid line; the block spans the sheet's
// whole usable width, so the number of copies per row follows the format.
//
// Every row draws its elements inside the SAME frame — the whole letter's
// grid box — so an isolated element (Н's crossbar) sits exactly where it
// sits in the full letter, and the label tile shows that same stroke shape.
// What each copy draws comes from the row's three options (line, contours,
// dots) via copyPlan().
export default function LetterBlock({ letter, color, rows, format, size = 2, paper = "cell", selected, selectedRowId, onSelectBlock, onSelectRow }) {
  const frame = letterFrame(letter);
  const w = letterW(letter, size);
  const h = letterH(size);
  const g = paperGap(paper);
  return (
    <div
      className={`pl-block${selected ? " is-selected" : ""}`}
      style={{ outlineColor: color, width: mm(blockCells(format)), minHeight: mm(TILE), paddingBottom: mm(g) }}
      onClick={(e) => { e.stopPropagation(); onSelectBlock(); }}
    >
      <div
        className="pl-block-tile"
        style={{ height: mm(TILE), width: mm(TILE), "--pl-block-color": color }}
        aria-label={`Буква ${letter.label}`}
      >
        <LetterGlyph letter={letter} frame={frame} heightMm={TILE * FINE_MM * 0.55} variant="plain" color="#ffffff" weight={15} />
      </div>

      {rows.map((row, index) => {
        const beside = rowBesidePlate(index, size, paper);
        const copies = copiesPerRow(letter, format, beside, size, paper);
        const start = rowStartCells(beside, paper);
        const width = rowCells(format, beside, paper);
        const strokes = row.elements.map((i) => ({ ...letter.strokes[i], n: i + 1 })).filter((s) => s.d);
        const miniLetter = { ...letter, strokes };
        const plan = copyPlan(row, copies);
        return (
          <div
            key={row.id}
            className={`pl-row-wrap${row.id === selectedRowId ? " is-selected" : ""}`}
            style={{ paddingTop: mm(g), paddingLeft: mm(start) }}
            onClick={(e) => { e.stopPropagation(); onSelectRow(row.id); }}
          >
            {isRuled(paper) && (
              <div
                className="pl-ruling"
                aria-hidden="true"
                style={{ left: mm(start), top: mm(g), width: mm(width), height: mm(h) }}
              />
            )}
            <div className="pl-row" style={{ height: mm(h), width: mm(width) }}>
              {plan.map((p, i) => (
                <div key={i} className="pl-cell" style={{ width: mm(i === plan.length - 1 ? w : copyPitch(size)), height: mm(h) }}>
                  {p && (
                    <LetterGlyph
                      key={`${row.elements.join(",")}-${p.variant}-${p.dots ? 1 : 0}`}
                      letter={miniLetter}
                      frame={frame}
                      heightMm={h * FINE_MM}
                      widthMm={w * FINE_MM}
                      variant={p.variant}
                      opacity={p.opacity}
                      tappable={p.variant === "sample"}
                      dots={p.dots}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
