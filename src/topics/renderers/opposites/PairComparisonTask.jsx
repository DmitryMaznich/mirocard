import "./Opposites.css";

function CardSide({ card }) {
  const imgSrc = card.imageUrl ?? card.photo ?? null;
  return (
    <div className="opp-pair__side">
      <div className="opp-card opp-pair__card">
        {imgSrc
          ? <img className="opp-card__img" src={imgSrc} alt={card.nominativeLabel} />
          : <div className="opp-card__placeholder">{card.nominativeLabel}<br />{card.objectLabel}</div>
        }
      </div>
      <div className="opp-label">{card.nominativeLabel}</div>
      <div className="opp-label opp-label--secondary">{card.objectLabel}</div>
    </div>
  );
}

export default function PairComparisonTask({ task, onAdvance }) {
  return (
    <div className="opp-pair" onClick={onAdvance}>
      <CardSide card={task.leftCard} />
      <CardSide card={task.rightCard} />
    </div>
  );
}
