import { useEffect, useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { useAudio } from "@/shared/hooks/useAudio";

function ConceptImage({ topicId, path }) {
  const url = useTopicFile(topicId, path);
  return url
    ? <img className="wf-pair__img" src={url} alt="" draggable={false} />
    : <div className="wf-pair__img wf-pair__img--loading" />;
}

export default function PairIntroTask({ task, topicId, onAdvance }) {
  const { cards } = task;
  const [index, setIndex]          = useState(0);
  const [arrowVisible, setArrowVisible] = useState(false);
  const { playTopicFile } = useAudio();

  const card   = cards[index];
  const isLast = index === cards.length - 1;

  useEffect(() => {
    setArrowVisible(false);
    if (!card) return;
    playTopicFile(topicId, card.audioNounPhrase);
    const t = setTimeout(() => {
      setArrowVisible(true);
      playTopicFile(topicId, card.audioAdjPhrase);
    }, 1200);
    return () => clearTimeout(t);
  }, [index, card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNext() {
    if (!isLast) setIndex(i => i + 1);
    else onAdvance();
  }

  function handlePrev() {
    if (index > 0) setIndex(i => i - 1);
  }

  if (!card) return null;

  return (
    <div className="wf-pair">
      <div className="wf-pair__content">
        <div className="wf-pair__side">
          <ConceptImage topicId={topicId} path={card.image} />
          <div className="wf-pair__phrase wf-pair__phrase--noun">{card.nounPhrase}</div>
        </div>

        <div className={`wf-pair__arrow${arrowVisible ? " wf-pair__arrow--visible" : ""}`}>→</div>

        <div className={`wf-pair__side${arrowVisible ? "" : " wf-pair__side--hidden"}`}>
          <div className="wf-pair__adj-box">
            <span className="wf-pair__phrase wf-pair__phrase--adj">{card.adjPhrase}</span>
          </div>
        </div>
      </div>

      <div className="wf-pair__nav">
        <button className="wf-nav-btn" onClick={handlePrev} disabled={index === 0}>←</button>
        <span className="wf-pair__progress">{index + 1} / {cards.length}</span>
        <button className="wf-nav-btn wf-nav-btn--next" onClick={handleNext}>
          {isLast ? "Готово" : "→"}
        </button>
      </div>
    </div>
  );
}
