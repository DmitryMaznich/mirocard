import LetterGlyph from "../LetterGlyph";
import RulingRow from "../Ruling";

const ROW_H = 100;
const PER_ROW = 5;
// Most-to-least prompting: опора убывает по строкам, а не на одном листе —
// каждая строка остаётся однородной, чтобы не путать ребёнка внутри строки.
const ROW_OPACITIES = [1, 0.65, 0.4, 0.22, 0.1];

// Этап 3 — «Угасающая опора»: первая строка — сплошной образец, дальше
// образец бледнеет от строки к строке.
export default function FadingPage({ letter }) {
  return (
    <div className="pl-page pl-page--fading">
      <div className="pl-page-title">Напиши букву «{letter.label}», образец бледнеет</div>
      {ROW_OPACITIES.map((opacity, rowIdx) => (
        <RulingRow key={rowIdx} heightPx={ROW_H} justify="space-between">
          {Array.from({ length: PER_ROW }).map((_, i) => (
            <LetterGlyph
              key={i}
              letter={letter}
              heightPx={ROW_H * 0.86}
              variant="solid"
              opacity={opacity}
              showNumbers={rowIdx === 0 && i === 0}
              showArrows={rowIdx === 0 && i === 0}
            />
          ))}
        </RulingRow>
      ))}
    </div>
  );
}
