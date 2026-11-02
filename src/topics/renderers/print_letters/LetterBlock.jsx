import LetterGlyph from "./LetterGlyph";
import GridRow, { CELL } from "./Ruling";

const TILE_W = CELL + 14;
const CELLS  = 8; // letters per row — fixed, real grid paper isn't stretched to fill the page width either

function strokesForContent(letter, content) {
  if (content === "full") return letter.strokes;
  if (content === "blank") return [];
  const idx = Number(content);
  return letter.strokes[idx] ? [letter.strokes[idx]] : letter.strokes;
}

// A naborny (fully composable) print block for one letter: the teacher picks
// how many rows it has and what each row drills — the whole letter, one
// isolated stroke element, or a blank cell row for independent writing. The
// block itself is a clean preview only (propis2's model): a click selects a
// row (or the block, via its tile) and every action on that selection lives
// in the toolbar above the canvas, not inline here.
export default function LetterBlock({ letter, color, rows, selected, selectedRowId, onSelectBlock, onSelectRow }) {
  return (
    <div
      className={`pl-block${selected ? " is-selected" : ""}`}
      style={{ borderColor: color }}
      onClick={(e) => { e.stopPropagation(); onSelectBlock(); }}
    >
      <div
        className="pl-block-tile"
        style={{ height: CELL, width: TILE_W, background: color }}
      >
        {letter.label}
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
            onClick={(e) => { e.stopPropagation(); onSelectRow(row.id); }}
          >
            <GridRow cells={CELLS} padLeft={TILE_W + 6}>
              {Array.from({ length: CELLS }).map((_, i) => (
                <div key={i} className="pl-cell">
                  {!isBlank && (
                    <LetterGlyph
                      letter={miniLetter}
                      heightPx={CELL * 0.84}
                      variant="dotted"
                      showArrows={i === 0}
                      showNumbers={isFull && i === 0}
                      tappable={i === 0}
                    />
                  )}
                </div>
              ))}
            </GridRow>
          </div>
        );
      })}
    </div>
  );
}
