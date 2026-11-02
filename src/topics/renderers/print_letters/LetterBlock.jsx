import LetterGlyph, { letterCells, letterFrame } from "./LetterGlyph";
import { FINE_MM } from "./Ruling";

// Everything below is counted in whole notebook cells (FINE_MM = 5mm), so
// every edge — block outline, tile, each letter's box — lands on a printed
// grid line. A letter is 2 cells tall and letterCells() wide.
const LETTER_H = 2;   // cells
const TILE     = 2;   // label tile: 2×2 cells
const GAP      = 1;   // blank cell between letters, between rows, after the tile
const ROW_CELLS = 16; // writing width of a row, in cells

const mm = (cells) => `${cells * FINE_MM}mm`;

function strokesForContent(letter, content) {
  if (content === "full") return letter.strokes;
  if (content === "blank") return [];
  const idx = Number(content);
  return letter.strokes[idx] ? [letter.strokes[idx]] : letter.strokes;
}

// How many copies of a letter fit in a row: each copy is its own width plus
// one blank cell, the last one needs no trailing gap.
export function copiesPerRow(letter) {
  const w = letterCells(letter);
  return Math.max(1, Math.floor((ROW_CELLS + GAP) / (w + GAP)));
}

// A naborny (fully composable) print block for one letter: the teacher picks
// how many rows it has and what each row drills — the whole letter, one
// isolated stroke element, or a blank row for independent writing. The block
// itself is a clean preview only (propis2's model): a click selects a row (or
// the block, via its tile) and every action on that selection lives in the
// toolbar above the canvas, not inline here.
//
// Every row draws its strokes inside the SAME frame — the whole letter's grid
// box — so an isolated element (Н's crossbar) sits exactly where it sits in
// the full letter, at the letter's real proportions, and the label tile shows
// that same letter shape rather than a font glyph with other proportions.
export default function LetterBlock({ letter, color, rows, selected, selectedRowId, onSelectBlock, onSelectRow }) {
  const frame = letterFrame(letter);
  const w = letterCells(letter);
  const copies = copiesPerRow(letter);
  const blockCells = TILE + GAP + ROW_CELLS + GAP;
  return (
    <div
      className={`pl-block${selected ? " is-selected" : ""}`}
      style={{ outlineColor: color, width: mm(blockCells), minHeight: mm(GAP + LETTER_H + GAP), paddingBottom: mm(GAP) }}
      onClick={(e) => { e.stopPropagation(); onSelectBlock(); }}
    >
      <div
        className="pl-block-tile"
        style={{ top: mm(GAP), height: mm(TILE), width: mm(TILE), background: color }}
        aria-label={`Буква ${letter.label}`}
      >
        <LetterGlyph
          letter={letter}
          frame={frame}
          heightMm={TILE * FINE_MM * 0.6}
          color="#ffffff"
          showArrows={false}
          tappable={false}
        />
      </div>

      {rows.map((row) => {
        const subset = strokesForContent(letter, row.content);
        const miniLetter = { ...letter, strokes: subset };
        const isFull = row.content === "full";
        const isBlank = row.content === "blank";
        return (
          <div
            key={row.id}
            className={`pl-row-wrap${row.id === selectedRowId ? " is-selected" : ""}`}
            style={{ paddingTop: mm(GAP), paddingLeft: mm(TILE + GAP) }}
            onClick={(e) => { e.stopPropagation(); onSelectRow(row.id); }}
          >
            <div className="pl-row" style={{ height: mm(LETTER_H), width: mm(ROW_CELLS), gap: mm(GAP) }}>
              {Array.from({ length: copies }).map((_, i) => (
                <div key={i} className="pl-cell" style={{ width: mm(w), height: mm(LETTER_H) }}>
                  {!isBlank && (
                    <LetterGlyph
                      letter={miniLetter}
                      frame={frame}
                      heightMm={LETTER_H * FINE_MM}
                      widthMm={w * FINE_MM}
                      variant="dotted"
                      showArrows={i === 0}
                      showNumbers={isFull && i === 0}
                      tappable={i === 0}
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
