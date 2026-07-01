import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { useAudio } from "@/shared/hooks/useAudio";

const QUESTION_DELAY_MS = 1800;
const AUTO_REVEAL_DELAY_MS = 4500;

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
  const { playTopicFile } = useAudio();
  const timersRef   = useRef([]);
  const revealedRef = useRef(false);
  const visualsRef  = useRef();
  const promptRef1  = useRef();
  const promptRef2  = useRef();

  const card   = cards[index];
  const isLast = index === cards.length - 1;

  useLayoutEffect(() => {
    const visuals = visualsRef.current;
    if (!visuals) return;
    const targetW = visuals.offsetWidth;
    [promptRef1, promptRef2].forEach(ref => {
      const el = ref.current;
      if (!el) return;
      el.style.fontSize = "";
      const textW = el.scrollWidth;
      if (textW > 0) {
        el.style.fontSize =
          (parseFloat(getComputedStyle(el).fontSize) * targetW / textW) + "px";
      }
    });
  }, [index, card?.id]);

  function clearTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  useEffect(() => {
    setRevealed(false);
    revealedRef.current = false;
    clearTimers();
    if (!card) return;

    playTopicFile(topicId, card.audioPrepPhrase);

    timersRef.current.push(
      setTimeout(() => playTopicFile(topicId, card.audioQuestion ?? "audio/question.mp3"), QUESTION_DELAY_MS)
    );
    timersRef.current.push(
      setTimeout(reveal, AUTO_REVEAL_DELAY_MS)
    );

    return clearTimers;
  }, [index, card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function reveal() {
    if (revealedRef.current) return;
    revealedRef.current = true;
    clearTimers();
    playTopicFile(topicId, card.audioAdjPhrase);
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
          <VisualImage topicId={topicId} path={card.ingredientImage} className="wf-pair__visual-img" />
          <div className="wf-pair__plus">+</div>
          <VisualImage topicId={topicId} path={card.vesselImage ?? "media/pot.webp"} className="wf-pair__visual-img" />
        </div>

        <div className="wf-pair__prompt">
          <div className="wf-pair__prompt-line" ref={promptRef1}>
            Готовим {card.nounPhrase}
          </div>
          <div className="wf-pair__prompt-line wf-pair__prompt-line--question" ref={promptRef2}>
            {card.questionText ?? "Какой суп получится?"}
          </div>
        </div>

        {revealed && (
          <div className="wf-pair__answer">
            <div className="wf-pair__answer-text">{card.adjPhrase}</div>
            <div className="wf-pair__answer-result">
              <VisualImage topicId={topicId} path={card.image} className="wf-pair__answer-result-img" />
            </div>
          </div>
        )}
      </div>

      <div className="wf-pair__nav" onClick={e => e.stopPropagation()}>
        <button className="wf-nav-btn" onClick={handlePrev} disabled={index === 0}>←</button>
        <div className="wf-pair__dots">
          {cards.map((c, i) => (
            <span key={c.id} className={`wf-pair__dot${i === index ? " wf-pair__dot--active" : ""}`} />
          ))}
        </div>
        <button className="wf-nav-btn wf-nav-btn--next" onClick={handleNext}>
          {isLast ? "Готово" : "→"}
        </button>
      </div>
    </div>
  );
}
