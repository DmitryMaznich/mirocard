import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { BackArrowIcon, ForwardArrowIcon } from "@/shared/components/ArrowIcons";
import "./Opposites.css";

function PairCard({ topicId, card, showLabels }) {
  const url = useTopicFile(topicId, card?.image);
  return (
    <div className="opp-pair__side">
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

  const pair    = pairs[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast  = currentIndex === pairs.length - 1;

  function handlePrev() {
    if (isFirst) return;
    setCurrentIndex(i => i - 1);
  }

  function handleNext() {
    if (!isLast) {
      setCurrentIndex(i => i + 1);
    } else {
      onAdvance();
    }
  }

  return (
    <div className="session-body opp-pair-v2">
      <div className="opp-pair-v2__content">
        <PairCard topicId={topicId} card={pair.leftCard}  showLabels={showLabels} />
        <PairCard topicId={topicId} card={pair.rightCard} showLabels={showLabels} />
      </div>

      <div className="opp-pair-v2__nav">
        <button
          className="opp-pair-v2__nav-btn"
          onClick={handlePrev}
          disabled={isFirst}
        >
          <BackArrowIcon size={22} />
        </button>
        <span className="opp-pair-v2__progress">
          {currentIndex + 1} / {pairs.length}
        </span>
        <button
          className="opp-pair-v2__nav-btn opp-pair-v2__nav-btn--next"
          onClick={handleNext}
        >
          {isLast ? "Готово" : <ForwardArrowIcon size={22} />}
        </button>
      </div>
    </div>
  );
}
