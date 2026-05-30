import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function CardImage({ topicId, card, state, onClick, disabled }) {
  const url = useTopicFile(topicId, card?.image);
  const mod =
    state === "correct" ? " opp-grid-card--correct" :
    state === "wrong"   ? " opp-grid-card--wrong"   : "";
  return (
    <button
      className={`opp-choose__card${mod}`}
      onClick={onClick}
      disabled={disabled}
    >
      {url
        ? <img className="opp-choose__card-img" src={url} alt="" draggable={false} />
        : <div className="opp-choose__card-img opp-choose__card-img--loading" />
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
    setTimeout(() => cb(task.targetPole, opt.card.id), 900);
  }

  function cardState(opt) {
    if (!answered || pickedId !== opt.card.id) return "idle";
    return opt.isTarget ? "correct" : "wrong";
  }

  return (
    <div className="session-body opp-choose">
      <div className="opp-choose__instruction">
        Покажи, что {task.poleLabelNeutral}?
      </div>
      <div className="opp-choose__cards">
        {task.options.map((opt) => (
          <div key={opt.card.id} className="opp-choose__slot">
            <CardImage
              topicId={topicId}
              card={opt.card}
              state={cardState(opt)}
              onClick={() => handleSelect(opt)}
              disabled={answered}
            />
            <div className="opp-choose__label">
              {answered && pickedId === opt.card.id
                ? `Это ${opt.card.nominativeLabel} ${opt.card.objectLabel}`
                : null
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
