import "./Opposites.css";

export default function IntroTask({ task, onAdvance }) {
  const { card } = task;
  const imgSrc = card.imageUrl ?? card.photo ?? null;

  return (
    <div className="opp-intro" onClick={onAdvance}>
      <div className="opp-card opp-intro__card">
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
