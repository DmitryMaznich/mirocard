import { useState } from "react";
import "./Opposites.css";

export default function SortTask({ task, onCorrect, onMistake }) {
  const { leftLabel, rightLabel, cards } = task;
  const [placements, setPlacements] = useState({});
  const [pending,    setPending]    = useState(null);
  const [done,       setDone]       = useState(false);

  function selectCard(item) {
    if (done || placements[item.card.id]) return;
    setPending((prev) => (prev?.card.id === item.card.id ? null : item));
  }

  function assignToZone(zone) {
    if (!pending || done) return;
    const item = pending;
    setPending(null);
    if (item.pole !== zone) {
      onMistake(zone, item.card.id);
      return;
    }
    setPlacements((prev) => {
      const next = { ...prev, [item.card.id]: zone };
      const allDone = cards.every((c) => next[c.card.id] === c.pole);
      if (allDone) { setDone(true); setTimeout(() => onCorrect(null, null), 400); }
      return next;
    });
  }

  const unplaced = cards.filter((item) => !placements[item.card.id]);
  const inLeft   = cards.filter((item) => placements[item.card.id] === "left");
  const inRight  = cards.filter((item) => placements[item.card.id] === "right");

  function PlacedCard({ card }) {
    const imgSrc = card.imageUrl ?? card.photo ?? null;
    return (
      <div className="opp-sort__placed">
        {imgSrc
          ? <img className="opp-card__img" src={imgSrc} alt={card.nominativeLabel} />
          : <span>{card.nominativeLabel}</span>
        }
      </div>
    );
  }

  return (
    <div className="opp-sort">
      <div className="opp-sort__zones">
        <div className={`opp-sort__zone${pending ? " opp-sort__zone--active" : ""}`} onClick={() => assignToZone("left")}>
          <div className="opp-sort__zone-label">{leftLabel}</div>
          {inLeft.map(({ card }) => <PlacedCard key={card.id} card={card} />)}
        </div>
        <div className={`opp-sort__zone${pending ? " opp-sort__zone--active" : ""}`} onClick={() => assignToZone("right")}>
          <div className="opp-sort__zone-label">{rightLabel}</div>
          {inRight.map(({ card }) => <PlacedCard key={card.id} card={card} />)}
        </div>
      </div>

      <div className="opp-sort__hand">
        {unplaced.map((item) => {
          const imgSrc    = item.card.imageUrl ?? item.card.photo ?? null;
          const isPending = pending?.card.id === item.card.id;
          return (
            <button
              key={item.card.id}
              className={`opp-sort__card${isPending ? " opp-sort__card--pending" : ""}`}
              onClick={() => selectCard(item)}
              disabled={done}
            >
              {imgSrc
                ? <img className="opp-card__img" src={imgSrc} alt={item.card.nominativeLabel} />
                : <div className="opp-card__placeholder">{item.card.nominativeLabel}</div>
              }
            </button>
          );
        })}
      </div>

      <div className="opp-sort__hint">
        {pending ? "Нажми на нужную группу" : unplaced.length > 0 ? "Выбери карточку" : ""}
      </div>
    </div>
  );
}
