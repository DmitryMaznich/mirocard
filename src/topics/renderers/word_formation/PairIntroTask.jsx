import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { BackArrowIcon, ForwardArrowIcon } from "@/shared/components/ArrowIcons";

const AUTO_REVEAL_DELAY_MS = 4500;

const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

// "рыбный суп" → "рыбный"
function stripNoun(phrase) {
  const words = phrase.trim().split(" ");
  return words.length > 1 ? words.slice(0, -1).join(" ") : phrase;
}

function VisualImage({ topicId, path, className }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className={className} src={url} alt="" draggable={false} />
    : <div className={`${className} wf-pair__visual-img--loading`} />;
}

export default function PairIntroTask({ task, topicId, onAdvance }) {
  const { cards } = task;
  const [index, setIndex]       = useState(0);
  const [revealed, setRevealed] = useState(false);
  const timerRef    = useRef(null);
  const revealedRef = useRef(false);
  const visualsRef  = useRef();
  const promptRef1  = useRef();

  const card   = cards[index];
  const isLast = index === cards.length - 1;

  useLayoutEffect(() => {
    const visuals = visualsRef.current;
    if (!visuals) return;
    const targetW = visuals.offsetWidth;
    const el = promptRef1.current;
    if (!el) return;
    el.style.fontSize = "";
    const textW = el.scrollWidth;
    if (textW > 0) {
      el.style.fontSize =
        (parseFloat(getComputedStyle(el).fontSize) * targetW / textW) + "px";
    }
  }, [index, card?.id]);

  useEffect(() => {
    setRevealed(false);
    revealedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!card) return;
    timerRef.current = setTimeout(reveal, AUTO_REVEAL_DELAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [index, card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function reveal() {
    if (revealedRef.current) return;
    revealedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setRevealed(true);
  }

  function handleNext() {
    if (!isLast) setIndex(i => i + 1);
    else onAdvance();
  }

  function handlePrev() {
    if (index > 0) setIndex(i => i - 1);
  }

  if (!card) return null;

  return (
    <div
      className={`wf-pair${revealed ? " wf-pair--revealed" : ""}`}
      onClick={!revealed ? reveal : undefined}
    >
      <div className="wf-pair__content">
        <div className="wf-pair__visuals" ref={visualsRef}>
          {card.vesselImage ? (
            <>
              <VisualImage topicId={topicId} path={card.ingredientImage} className="wf-pair__visual-img" />
              <div className="wf-pair__plus">+</div>
              <VisualImage topicId={topicId} path={card.vesselImage} className="wf-pair__visual-img" />
            </>
          ) : (
            <VisualImage topicId={topicId} path={card.ingredientImage} className="wf-pair__visual-img wf-pair__visual-img--solo" />
          )}
        </div>

        <div className="wf-pair__prompt">
          <div className="wf-pair__prompt-line wf-pair__prompt-line--question" ref={promptRef1}>
            {cap(card.nounPhrase)} ({card.questionText ?? "какой?"})
          </div>
        </div>

        {revealed && (
          <div className="wf-pair__answer">
            <div className="wf-pair__answer-text">{stripNoun(card.adjPhrase)}</div>
          </div>
        )}
      </div>

      <div className="wf-pair__nav" onClick={e => e.stopPropagation()}>
        <button className="wf-nav-btn" onClick={handlePrev} disabled={index === 0}><BackArrowIcon size={22} /></button>
        <div className="wf-pair__dots">
          {cards.map((c, i) => (
            <span key={c.id} className={`wf-pair__dot${i === index ? " wf-pair__dot--active" : ""}`} />
          ))}
        </div>
        <button className="wf-nav-btn wf-nav-btn--next" onClick={handleNext}>
          {isLast ? "Готово" : <ForwardArrowIcon size={22} />}
        </button>
      </div>
    </div>
  );
}
