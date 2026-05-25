import { useState } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function SortCardImage({ topicId, card, className }) {
  const url = useTopicFile(topicId, card?.image);
  if (!url) return <div className={`opp-img opp-img--loading ${className ?? ""}`} />;
  return <img className={`opp-img ${className ?? ""}`} src={url} alt="" draggable={false} />;
}

export default function SortTask({ task, topicId, onCorrect, onMistake }) {
  const { leftLabel, rightLabel, cards } = task;
  const [placements, setPlacements] = useState({});
  const [pending, setPending]       = useState(null);
  const [done, setDone]             = useState(false);

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

  return (
    <div className="opp-sort session-body">
      <div className="opp-sort__zones">
        <div className={`opp-sort__zone${pending ? " opp-sort__zone--active" : ""}`} onClick={() => assignToZone("left")}>
          <div className="opp-sort__zone-label">{leftLabel}</div>
          {inLeft.map(({ card }) => (
            <div key={card.id} className="opp-sort__placed">
              <SortCardImage topicId={topicId} card={card} className="opp-img" />
            </div>
          ))}
        </div>
        <div className={`opp-sort__zone${pending ? " opp-sort__zone--active" : ""}`} onClick={() => assignToZone("right")}>
          <div className="opp-sort__zone-label">{rightLabel}</div>
          {inRight.map(({ card }) => (
            <div key={card.id} className="opp-sort__placed">
              <SortCardImage topicId={topicId} card={card} className="opp-img" />
            </div>
          ))}
        </div>
      </div>

      <div className="opp-sort__hand">
        {unplaced.map((item) => {
          const isPending = pending?.card.id === item.card.id;
          return (
            <button
              key={item.card.id}
              className={`opp-sort__card${isPending ? " opp-sort__card--pending" : ""}`}
              onClick={() => selectCard(item)}
              disabled={done}
            >
              <SortCardImage topicId={topicId} card={item.card} />
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
