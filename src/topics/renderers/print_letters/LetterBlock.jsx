import LetterGlyph, { letterFrame } from "./LetterGlyph";
import { FINE_MM } from "./Ruling";
import { LETTER_H, TILE, GAP, blockCells, rowCells, copiesPerRow, copyPlan, letterCells } from "./model";

const mm = (cells) => `${cells * FINE_MM}mm`;

// A naborny print block for one letter. Every length is a whole number of
// notebook cells (model.js), so every edge — block outline, tile, each
// letter's box — lands on a printed grid line; the block spans the sheet's
// whole usable width, so the number of copies per row follows the format.
//
// Every row draws its elements inside the SAME frame — the whole letter's
// grid box — so an isolated element (Н's crossbar) sits exactly where it
// sits in the full letter, and the label tile shows that same stroke shape.
// What each copy draws (dotted / start dots / fading / one sample) comes
// from the row's support level via copyPlan().
export default function LetterBlock({ letter, color, rows, format, selected, selectedRowId, onSelectBlock, onSelectRow }) {
  const frame = letterFrame(letter);
  const w = letterCells(letter);
  const copies = copiesPerRow(letter, format);
  return (
    <div
      className={`pl-block${selected ? " is-selected" : ""}`}
      style={{ outlineColor: color, width: mm(blockCells(format)), minHeight: mm(TILE), paddingBottom: mm(GAP) }}
      onClick={(e) => { e.stopPropagation(); onSelectBlock(); }}
    >
      <div
        className="pl-block-tile"
        style={{ height: mm(TILE), width: mm(TILE), "--pl-block-color": color }}
        aria-label={`Буква ${letter.label}`}
      >
        <LetterGlyph letter={letter} frame={frame} heightMm={TILE * FINE_MM * 0.55} variant="plain" color="#ffffff" />
      </div>

      {rows.map((row) => {
        const strokes = row.elements.map((i) => ({ ...letter.strokes[i], n: i + 1 })).filter((s) => s.d);
        const miniLetter = { ...letter, strokes };
        const plan = copyPlan(row, copies);
        return (
          <div
            key={row.id}
            className={`pl-row-wrap${row.id === selectedRowId ? " is-selected" : ""}`}
            style={{ paddingTop: mm(GAP), paddingLeft: mm(TILE + GAP) }}
            onClick={(e) => { e.stopPropagation(); onSelectRow(row.id); }}
          >
            <div className="pl-row" style={{ height: mm(LETTER_H), width: mm(rowCells(format)), gap: mm(GAP) }}>
              {plan.map((p, i) => (
                <div key={i} className="pl-cell" style={{ width: mm(w), height: mm(LETTER_H) }}>
                  {p && (
                    <LetterGlyph
                      key={`${row.elements.join(",")}-${p.variant}`}
                      letter={miniLetter}
                      frame={frame}
                      heightMm={LETTER_H * FINE_MM}
                      widthMm={w * FINE_MM}
                      variant={p.variant}
                      opacity={p.opacity}
                      tappable={p.variant === "sample"}
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
