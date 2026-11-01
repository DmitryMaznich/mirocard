import LetterGlyph from "../LetterGlyph";

// Этап 1 — «Знакомство»: одна крупная буква без линовки, для обводки
// пальцем. Проигрывает порядок штрихов сама при открытии страницы, повтор —
// по тапу.
export default function IntroPage({ letter }) {
  return (
    <div className="pl-page pl-page--intro">
      <div className="pl-intro-glyph">
        <LetterGlyph
          letter={letter}
          heightPx={320}
          variant="solid"
          showNumbers
          showArrows
          autoPlay
        />
      </div>
      <div className="pl-intro-caption">Это буква «{letter.label}». Нажми ещё раз, чтобы посмотреть.</div>
    </div>
  );
}
