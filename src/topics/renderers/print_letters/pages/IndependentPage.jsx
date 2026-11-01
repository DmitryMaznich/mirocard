import LetterGlyph from "../LetterGlyph";
import RulingRow from "../Ruling";

const ROW_H = 96;
const ROWS  = 6;

// Этап 4 — «Самостоятельно по образцу»: образец только в начале строки,
// остальная строка пустая — ребёнок пишет по памяти/подглядывая на образец.
export default function IndependentPage({ letter }) {
  return (
    <div className="pl-page pl-page--independent">
      <div className="pl-page-title">Напиши букву «{letter.label}» сам — смотри на образец слева</div>
      {Array.from({ length: ROWS }).map((_, rowIdx) => (
        <RulingRow key={rowIdx} heightPx={ROW_H} justify="flex-start">
          <LetterGlyph
            letter={letter}
            heightPx={ROW_H * 0.86}
            variant="solid"
            showNumbers={rowIdx === 0}
            showArrows={rowIdx === 0}
          />
        </RulingRow>
      ))}
    </div>
  );
}
