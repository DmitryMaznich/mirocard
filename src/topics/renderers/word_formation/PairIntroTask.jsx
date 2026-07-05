import { useLayoutEffect, useRef, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { BackArrowIcon, ForwardArrowIcon } from "@/shared/components/ArrowIcons";

const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

function VisualImage({ topicId, path, className }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className={className} src={url} alt="" draggable={false} />
    : <div className={`${className} wf-pair__visual-img--loading`} />;
}

export default function PairIntroTask({ task, topicId, onAdvance }) {
  const { cards } = task;
  const [index, setIndex] = useState(0);
  const visualsRef = useRef();
  const promptRef  = useRef();

  const card   = cards[index];
  const isLast = index === cards.length - 1;

  useLayoutEffect(() => {
    const visuals = visualsRef.current;
    if (!visuals) return;
    const targetW = visuals.offsetWidth;
    const el = promptRef.current;
    if (!el) return;
    el.style.fontSize = "";
    const textW = el.scrollWidth;
    if (textW > 0) {
      el.style.fontSize =
        (parseFloat(getComputedStyle(el).fontSize) * targetW / textW) + "px";
    }
  }, [index, card?.id]);

  function handleNext() {
    if (!isLast) setIndex(i => i + 1);
    else onAdvance();
  }

  function handlePrev() {
    if (index > 0) setIndex(i => i - 1);
  }

  if (!card) return null;

  return (
    <div className="wf-pair wf-pair--revealed" onClick={handleNext}>
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
          <div className="wf-pair__prompt-line wf-pair__prompt-line--question" ref={promptRef}>
            {cap(card.nounPhrase)} ({card.questionText ?? "какой?"}) — {card.adjPhrase}
          </div>
        </div>
      </div>

      <div className="wf-pair__nav" onClick={e => e.stopPropagation()}>
        <button className="wf-nav-btn" onClick={handlePrev} disabled={index === 0}>
          <BackArrowIcon size={22} />
        </button>
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
