import LetterGlyph from "../LetterGlyph";
import RulingRow from "../Ruling";

const ROW_H = 100;
const ROWS  = 5;
const PER_ROW = 5;

// Этап 2 — «Обводка по точкам»: несколько строк на линейке (без наклонных),
// буква — пунктирный контур. Стрелка направления — на каждой копии (это и
// есть опора при письме), а номер штриха только у первой копии первой
// строки — он скорее справочный, чем нужный на каждом повторе.
export default function DottedPage({ letter }) {
  return (
    <div className="pl-page pl-page--dotted">
      <div className="pl-page-title">Обведи букву «{letter.label}» по точкам</div>
      {Array.from({ length: ROWS }).map((_, rowIdx) => (
        <RulingRow key={rowIdx} heightPx={ROW_H} justify="space-between">
          {Array.from({ length: PER_ROW }).map((_, i) => (
            <LetterGlyph
              key={i}
              letter={letter}
              heightPx={ROW_H * 0.86}
              variant="dotted"
              showNumbers={rowIdx === 0 && i === 0}
              showArrows
            />
          ))}
        </RulingRow>
      ))}
    </div>
  );
}
