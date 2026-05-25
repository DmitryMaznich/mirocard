import { useState } from "react";
import "./Opposites.css";

export default function FindAllTask({ task, onCorrect, onIncorrect }) {
  const { targetLabel, allCards, correctCardIds } = task;
  const correctSet = new Set(correctCardIds);
  const [selected, setSelected]   = useState(new Set());
  const [submitted, setSubmitted] = useState(false);

  function toggle(id) {
    if (submitted) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (submitted) return;
    setSubmitted(true);
    const allCorrect =
      correctCardIds.every((id) => selected.has(id)) &&
      [...selected].every((id) => correctSet.has(id));
    if (allCorrect) onCorrect(task.targetPole, null);
    else            onIncorrect(task.targetPole, null);
  }

  return (
    <div className="opp-findall">
      <div className="opp-instruction">Найди все: {targetLabel}</div>
      <div className="opp-grid">
        {allCards.map((card) => {
          const imgSrc     = card.imageUrl ?? card.photo ?? null;
          const isSelected = selected.has(card.id);
          let cls = "opp-grid-card";
          if (submitted && correctSet.has(card.id))  cls += " opp-grid-card--correct";
          else if (submitted && isSelected)           cls += " opp-grid-card--wrong";
          else if (isSelected)                        cls += " opp-grid-card--selected";

          return (
            <button key={card.id} className={cls} onClick={() => toggle(card.id)} disabled={submitted}>
              {imgSrc
                ? <img className="opp-card__img" src={imgSrc} alt={card.nominativeLabel} />
                : <div className="opp-card__placeholder">{card.nominativeLabel}<br />{card.objectLabel}</div>
              }
              <div className="opp-grid-card__label">{card.nominativeLabel}</div>
            </button>
          );
        })}
      </div>
      <button
        className="opp-submit-btn"
        onClick={handleSubmit}
        disabled={selected.size === 0 || submitted}
      >
        Готово
      </button>
    </div>
  );
}
