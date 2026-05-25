import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function GridCard({ topicId, card, isSelected, submitted, isCorrect, onClick }) {
  const url = useTopicFile(topicId, card?.image);
  let mod = "";
  if (submitted && isCorrect)       mod = "opp-grid-card--correct";
  else if (submitted && isSelected) mod = "opp-grid-card--wrong";
  else if (isSelected)              mod = "opp-grid-card--selected";

  return (
    <button className={`opp-grid-card${mod ? " " + mod : ""}`} onClick={onClick} disabled={submitted}>
      {url
        ? <img className="opp-grid-card__img" src={url} alt="" draggable={false} />
        : <div className="opp-grid-card__img opp-grid-card__img--loading" />
      }
      <div className="opp-grid-card__label">{card.nominativeLabel}</div>
    </button>
  );
}

export default function FindAllTask({ task, topicId, onCorrect, onIncorrect }) {
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
    <div className="session-body">
      <div className="session-instruction">Найди все: {targetLabel}</div>
      <div className="opp-grid">
        {allCards.map((card) => (
          <GridCard
            key={card.id}
            topicId={topicId}
            card={card}
            isSelected={selected.has(card.id)}
            submitted={submitted}
            isCorrect={correctSet.has(card.id)}
            onClick={() => toggle(card.id)}
          />
        ))}
      </div>
      <button className="opp-submit-btn" onClick={handleSubmit} disabled={selected.size === 0 || submitted}>
        Готово
      </button>
    </div>
  );
}
