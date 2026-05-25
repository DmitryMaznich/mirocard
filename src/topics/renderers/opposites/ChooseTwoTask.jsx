import { useState } from "react";
import "./Opposites.css";

export default function ChooseTwoTask({ task, onCorrect, onIncorrect }) {
  const { targetLabel, options } = task;
  const [answered, setAnswered] = useState(false);

  function handleSelect(opt) {
    if (answered) return;
    setAnswered(true);
    if (opt.isTarget) {
      onCorrect(task.targetPole, opt.card.id);
    } else {
      onIncorrect(task.targetPole, opt.card.id);
    }
  }

  return (
    <div className="opp-choose">
      <div className="opp-instruction">Покажи: {targetLabel}</div>
      <div className="opp-grid">
        {options.map((opt) => {
          const imgSrc = opt.card.imageUrl ?? opt.card.photo ?? null;
          return (
            <button
              key={opt.card.id}
              className="opp-grid-card"
              onClick={() => handleSelect(opt)}
              disabled={answered}
            >
              {imgSrc
                ? <img className="opp-card__img" src={imgSrc} alt={opt.card.nominativeLabel} />
                : <div className="opp-card__placeholder">{opt.card.nominativeLabel}<br />{opt.card.objectLabel}</div>
              }
              <div className="opp-grid-card__label">{opt.card.nominativeLabel}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
