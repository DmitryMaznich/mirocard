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
// isolated stroke element, or a blank cell row for independent writing. This
// is the one page/content type the constructor builds from; there is no
// separate "page type" to pick any more.
export default function LetterBlock({ letter, color, rows, onAddRow, onRemoveRow, onChangeRowContent, onRemoveBlock }) {
  return (
    <div className="pl-block" style={{ borderColor: color }}>
      <div className="pl-block-tile" style={{ height: CELL, width: TILE_W, background: color }}>
        {letter.label}
      </div>
      <button type="button" className="pl-block-remove no-print" onClick={onRemoveBlock} aria-label={`Удалить блок буквы ${letter.label}`}>
        ✕
      </button>

      {rows.map((row) => {
        const subset = strokesForContent(letter, row.content);
        const miniLetter = { ...letter, strokes: subset };
        const isFull = row.content === "full";
        const isBlank = row.content === "blank";
        return (
          <div key={row.id} className="pl-row-wrap">
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
            <div className="pl-row-controls no-print" style={{ marginLeft: TILE_W + 6 }}>
              <select
                className="pl-row-select"
                value={row.content}
                onChange={(e) => {
                  const v = e.target.value;
                  onChangeRowContent(row.id, v === "full" || v === "blank" ? v : Number(v));
                }}
              >
                <option value="full">Целиком</option>
                {letter.strokes.map((_, i) => (
                  <option key={i} value={i}>Элемент {i + 1}</option>
                ))}
                <option value="blank">Пусто</option>
              </select>
              <button type="button" onClick={() => onRemoveRow(row.id)} aria-label="Удалить строку">✕</button>
            </div>
          </div>
        );
      })}

      <button type="button" className="pl-block-add-row no-print" onClick={onAddRow}>+ Строка</button>
    </div>
  );
}
