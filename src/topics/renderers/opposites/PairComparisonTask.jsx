import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function PairCard({ topicId, card, showLabels, visible }) {
  const url = useTopicFile(topicId, card?.image);
  return (
    <div className={`opp-pair__side${visible ? "" : " opp-pair__side--hidden"}`}>
      <div className="opp-pair__card">
        {url
          ? <img src={url} alt="" draggable={false} />
          : <div className="opp-pair__card-placeholder" />
        }
      </div>
      {showLabels && <div className="opp-pair__label">{card.nominativeLabel}</div>}
      {showLabels && <div className="opp-pair__hint">{card.objectLabel}</div>}
    </div>
  );
}

export default function PairComparisonTask({ task, topicId, onAdvance }) {
  const { pairs, showLabels } = task;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep]                 = useState(1);

  const pair    = pairs[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast  = currentIndex === pairs.length - 1;

  function handleContentTap() {
    if (step === 1) setStep(2);
  }

  function handlePrev() {
    if (isFirst) return;
    setCurrentIndex(i => i - 1);
    setStep(1);
  }

  function handleNext() {
    if (!isLast) {
      setCurrentIndex(i => i + 1);
      setStep(1);
    } else {
      onAdvance();
    }
  }

  return (
    <div className="session-body opp-pair-v2">
      <div className="opp-pair-v2__content" onClick={handleContentTap}>
        <PairCard topicId={topicId} card={pair.leftCard}  showLabels={showLabels} visible />
        {step === 2 && <PairCard topicId={topicId} card={pair.rightCard} showLabels={showLabels} visible />}
      </div>

      {step === 1 && (
        <div className="opp-pair-v2__tap-hint">Нажмите, чтобы открыть пару</div>
      )}

      <div className="opp-pair-v2__nav">
        <button
          className="opp-pair-v2__nav-btn"
          onClick={handlePrev}
          disabled={isFirst}
        >
          ←
        </button>
        <span className="opp-pair-v2__progress">
          {currentIndex + 1} / {pairs.length}
        </span>
        <button
          className="opp-pair-v2__nav-btn opp-pair-v2__nav-btn--next"
          onClick={handleNext}
        >
          {isLast ? "Готово" : "→"}
        </button>
      </div>
    </div>
  );
}
