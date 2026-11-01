import LetterGlyph from "./LetterGlyph";
import RulingRow from "./Ruling";

const ROW_H   = 46;   // compact, print-scale row — not a screen-filling glyph
const TILE_W  = 52;
const REPEATS = 10;

// Build-up rows: drill the first stroke alone, then (for letters with more
// than two strokes) the first two together, then the whole letter — the
// same progression as the reference copybook (isolated element → combined
// letter), capped at 3 rows so complex letters don't blow up the block.
function buildRowsSpec(strokes) {
  if (strokes.length <= 2) return [strokes.slice(0, 1), strokes];
  return [strokes.slice(0, 1), strokes.slice(0, 2), strokes];
}

// One letter's printable practice block: a small colored tile with the
// letter, plus 2–3 short ruled rows that build up from an isolated stroke to
// the whole letter. Several of these stack onto one A4 sheet — this is the
// actual print unit, not a full page per letter.
export default function LetterBlock({ letter, color, independent = false }) {
  const rowsSpec = buildRowsSpec(letter.strokes);

  return (
    <div className="pl-block" style={{ borderColor: color }}>
      <div className="pl-block-tile" style={{ height: ROW_H, width: TILE_W, background: color }}>
        {letter.label}
      </div>
      {rowsSpec.map((strokeSubset, rowIdx) => {
        const isFinal = rowIdx === rowsSpec.length - 1;
        const miniLetter = { ...letter, strokes: strokeSubset };
        const blankFrom = independent && isFinal ? Math.ceil(REPEATS * 0.4) : null;
        return (
          <RulingRow key={rowIdx} heightPx={ROW_H} padLeft={TILE_W + 8} showMargin={false} justify="space-between">
            {Array.from({ length: REPEATS }).map((_, i) =>
              blankFrom && i >= blankFrom ? (
                <span key={i} className="pl-block-blank-slot" />
              ) : (
                <LetterGlyph
                  key={i}
                  letter={miniLetter}
                  heightPx={ROW_H * 0.72}
                  variant="dotted"
                  showArrows={isFinal && i === 0}
                  showNumbers={isFinal && i === 0}
                  tappable={isFinal && i === 0}
                />
              )
            )}
          </RulingRow>
        );
      })}
    </div>
  );
}
