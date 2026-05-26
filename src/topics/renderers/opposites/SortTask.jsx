import { useState, useRef } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function SortImage({ topicId, card }) {
  const url = useTopicFile(topicId, card?.image);
  if (!url) return <div style={{ width: "100%", height: "100%", background: "#e0e0e0" }} />;
  return <img src={url} alt="" draggable={false} />;
}

export default function SortTask({ task, topicId, onCorrect, onMistake }) {
  const { leftLabel, rightLabel, cards } = task;
  const [placements, setPlacements] = useState({});
  const [dragging, setDragging]     = useState(null);
  const [hoverZone, setHoverZone]   = useState(null);
  const [done, setDone]             = useState(false);
  const leftZoneRef   = useRef(null);
  const rightZoneRef  = useRef(null);
  const onCorrectRef  = useRef(onCorrect);
  onCorrectRef.current = onCorrect;

  function getZoneAt(x, y) {
    const l = leftZoneRef.current?.getBoundingClientRect();
    const r = rightZoneRef.current?.getBoundingClientRect();
    if (l && x >= l.left && x <= l.right && y >= l.top && y <= l.bottom) return "left";
    if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return "right";
    return null;
  }

  function handlePointerDown(e, item) {
    if (done || placements[item.card.id]) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({
      item,
      x: rect.left,
      y: rect.top,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      size: rect.width,
    });
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    setDragging(prev => ({
      ...prev,
      x: e.clientX - prev.offsetX,
      y: e.clientY - prev.offsetY,
    }));
    setHoverZone(getZoneAt(e.clientX, e.clientY));
  }

  function handlePointerUp(e) {
    if (!dragging) return;
    const zone = getZoneAt(e.clientX, e.clientY);
    const item = dragging.item;
    setDragging(null);
    setHoverZone(null);
    if (!zone) return;
    if (item.pole !== zone) {
      onMistake(zone, item.card.id);
      return;
    }
    const newPlacements = { ...placements, [item.card.id]: zone };
    setPlacements(newPlacements);
    const allDone = cards.every(c => newPlacements[c.card.id] === c.pole);
    if (allDone) {
      setDone(true);
      setTimeout(() => onCorrectRef.current(null, null), 400);
    }
  }

  const unplaced = cards.filter(item => !placements[item.card.id]);
  const inLeft   = cards.filter(item => placements[item.card.id] === "left");
  const inRight  = cards.filter(item => placements[item.card.id] === "right");

  return (
    <div
      className="session-body opp-sort"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: "none" }}
    >
      <div className="opp-sort__hand">
        {unplaced.map(item => (
          <div
            key={item.card.id}
            className={`opp-sort__card${dragging?.item.card.id === item.card.id ? " opp-sort__card--dragging" : ""}`}
            onPointerDown={e => handlePointerDown(e, item)}
          >
            <SortImage topicId={topicId} card={item.card} />
          </div>
        ))}
      </div>

      <div className="opp-sort__zones">
        <div
          ref={leftZoneRef}
          className={`opp-sort__zone opp-sort__zone--left${hoverZone === "left" ? " opp-sort__zone--active" : ""}`}
        >
          <div className="opp-sort__zone-label">{leftLabel}</div>
          {inLeft.map(({ card }) => (
            <div key={card.id} className="opp-sort__placed">
              <SortImage topicId={topicId} card={card} />
            </div>
          ))}
        </div>
        <div
          ref={rightZoneRef}
          className={`opp-sort__zone opp-sort__zone--right${hoverZone === "right" ? " opp-sort__zone--active" : ""}`}
        >
          <div className="opp-sort__zone-label">{rightLabel}</div>
          {inRight.map(({ card }) => (
            <div key={card.id} className="opp-sort__placed">
              <SortImage topicId={topicId} card={card} />
            </div>
          ))}
        </div>
      </div>

      <div className="opp-sort__hint">
        {dragging ? "Перетащи в нужную группу" : unplaced.length > 0 ? "Перетащи карточку" : ""}
      </div>

      {dragging && (
        <div
          className="opp-sort__ghost"
          style={{ left: dragging.x, top: dragging.y, width: dragging.size, height: dragging.size }}
        >
          <SortImage topicId={topicId} card={dragging.item.card} />
        </div>
      )}
    </div>
  );
}
