import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function GridCard({ topicId, card, state, onClick, disabled }) {
  const url = useTopicFile(topicId, card?.image);
  const mod =
    state === "correct" ? " opp-grid-card--correct" :
    state === "wrong"   ? " opp-grid-card--wrong"   : "";
  return (
    <button
      className={`opp-grid-card${mod}`}
      onClick={onClick}
      disabled={disabled}
    >
      {url
        ? <img className="opp-grid-card__img" src={url} alt="" draggable={false} />
        : <div className="opp-grid-card__img opp-grid-card__img--loading" />
      }
    </button>
  );
}

export default function ChooseTwoTask({ task, topicId, onCorrect, onIncorrect }) {
  const [answered, setAnswered] = useState(false);
  const [pickedId, setPickedId] = useState(null);

  function handleSelect(opt) {
    if (answered) return;
    setAnswered(true);
    setPickedId(opt.card.id);
    const cb = opt.isTarget ? onCorrect : onIncorrect;
    setTimeout(() => cb(task.targetPole, opt.card.id), 600);
  }

  function cardState(opt) {
    if (!answered || pickedId !== opt.card.id) return "idle";
    return opt.isTarget ? "correct" : "wrong";
  }

  return (
    <div className="session-body">
      <div className="session-instruction">Покажи: {task.targetLabel}</div>
      <div className="opp-grid">
        {task.options.map((opt) => (
          <GridCard
            key={opt.card.id}
            topicId={topicId}
            card={opt.card}
            state={cardState(opt)}
            onClick={() => handleSelect(opt)}
            disabled={answered}
          />
        ))}
      </div>
    </div>
  );
}
