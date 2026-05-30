import { useState, useRef } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import "./Opposites.css";

function SortImage({ topicId, card }) {
  const url = useTopicFile(topicId, card?.image);
  if (!url) return <div style={{ width: "100%", height: "100%", background: "#e0e0e0" }} />;
  return <img src={url} alt="" draggable={false} />;
}

export default function SortTask({ task, topicId, onCorrect, onMistake }) {
  const { zones, cards } = task;
  const [placements, setPlacements] = useState({});
  const [dragging, setDragging]     = useState(null);
  const [hoverZone, setHoverZone]   = useState(null);
  const [done, setDone]             = useState(false);
  const zoneRefs     = useRef({});
  const onCorrectRef = useRef(onCorrect);
  onCorrectRef.current = onCorrect;

  function getZoneAt(x, y) {
    for (const zone of zones) {
      const el = zoneRefs.current[zone.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return zone.id;
    }
    return null;
  }

  function handlePointerDown(e, item) {
    if (done || placements[item.card.id]) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({
      item,
      x: rect.left, y: rect.top,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      size: rect.width,
    });
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    setDragging(prev => ({ ...prev, x: e.clientX - prev.offsetX, y: e.clientY - prev.offsetY }));
    setHoverZone(getZoneAt(e.clientX, e.clientY));
  }

  function handlePointerUp(e) {
    if (!dragging) return;
    const zoneId = getZoneAt(e.clientX, e.clientY);
    const item   = dragging.item;
    setDragging(null);
    setHoverZone(null);
    if (!zoneId) return;
    if (item.targetZoneId !== zoneId) {
      onMistake(zoneId, item.card.id);
      return;
    }
    const newPlacements = { ...placements, [item.card.id]: zoneId };
    setPlacements(newPlacements);
    const allDone = cards.every(c => newPlacements[c.card.id] === c.targetZoneId);
    if (allDone) {
      setDone(true);
      setTimeout(() => onCorrectRef.current(null, null), 400);
    }
  }

  const unplaced  = cards.filter(item => !placements[item.card.id]);
  const gridClass = zones.length === 4
    ? "opp-sort__zones opp-sort__zones--four"
    : "opp-sort__zones";

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

      <div className={gridClass}>
        {zones.map(zone => {
          const inZone = cards.filter(item => placements[item.card.id] === zone.id);
          return (
            <div
              key={zone.id}
              ref={el => { zoneRefs.current[zone.id] = el; }}
              className={`opp-sort__zone${hoverZone === zone.id ? " opp-sort__zone--active" : ""}`}
            >
              <div className="opp-sort__zone-label">{zone.label}</div>
              <div className="opp-sort__placed-grid">
                {inZone.map(({ card }) => (
                  <div key={card.id} className="opp-sort__placed">
                    <SortImage topicId={topicId} card={card} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
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
