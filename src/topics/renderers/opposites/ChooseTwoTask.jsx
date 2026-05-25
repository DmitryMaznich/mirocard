import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function GridCard({ topicId, opt, onClick, disabled, modifier }) {
  const url = useTopicFile(topicId, opt.card?.image);
  return (
    <button
      className={`opp-grid-card${modifier ? " " + modifier : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {url
        ? <img className="opp-img" src={url} alt="" draggable={false} style={{ height: "auto", aspectRatio: "1" }} />
        : <div className="opp-img opp-img--loading" style={{ height: "auto", aspectRatio: "1" }} />
      }
      <div className="opp-grid-card__label">{opt.card.nominativeLabel}</div>
    </button>
  );
}

export default function ChooseTwoTask({ task, topicId, onCorrect, onIncorrect }) {
  const { targetLabel, options } = task;
  const [answered, setAnswered] = useState(false);

  function handleSelect(opt) {
    if (answered) return;
    setAnswered(true);
    if (opt.isTarget) onCorrect(task.targetPole, opt.card.id);
    else              onIncorrect(task.targetPole, opt.card.id);
  }

  return (
    <div className="opp-choose session-body">
      <div className="opp-instruction">Покажи: {targetLabel}</div>
      <div className="opp-grid">
        {options.map((opt) => (
          <GridCard
            key={opt.card.id}
            topicId={topicId}
            opt={opt}
            onClick={() => handleSelect(opt)}
            disabled={answered}
            modifier={null}
          />
        ))}
      </div>
    </div>
  );
}
