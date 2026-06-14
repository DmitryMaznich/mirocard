import { useState, useRef } from "react";
import "./phrase_match.css";

function GhostText({ text, x, y, width, height }) {
  return (
    <div className="pm-ghost" style={{ left: x, top: y, width, height }}>
      {text}
    </div>
  );
}

export default function MatchTask({ task, onCorrect, onIncorrect }) {
  const { items, answers } = task;

  const [placements, setPlacements] = useState({});
  const [dragging, setDragging]     = useState(null);
  const [hoverSlot, setHoverSlot]   = useState(null);
  const [errorSlot, setErrorSlot]   = useState(null);

  const slotRefs       = useRef({});
  const hadMistake     = useRef(false);
  const onCorrectRef   = useRef(onCorrect);
  const onIncorrectRef = useRef(onIncorrect);
  onCorrectRef.current  = onCorrect;
  onIncorrectRef.current = onIncorrect;

  const placedIds = new Set(Object.values(placements));

  function getSlotAt(x, y) {
    for (const item of items) {
      const el = slotRefs.current[item.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return item.id;
    }
    return null;
  }

  function handlePointerDown(e, answer) {
    if (placedIds.has(answer.id)) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({
      answerId: answer.id,
      text:     answer.text,
      x:        rect.left,
      y:        rect.top,
      offsetX:  e.clientX - rect.left,
      offsetY:  e.clientY - rect.top,
      width:    rect.width,
      height:   rect.height,
    });
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    setDragging(prev => ({
      ...prev,
      x: e.clientX - prev.offsetX,
      y: e.clientY - prev.offsetY,
    }));
    setHoverSlot(getSlotAt(e.clientX, e.clientY));
  }

  function handlePointerUp(e) {
    if (!dragging) return;
    const slotId = getSlotAt(e.clientX, e.clientY);
    const { answerId } = dragging;
    setDragging(null);
    setHoverSlot(null);

    if (!slotId || placements[slotId]) return;

    if (answerId !== slotId) {
      hadMistake.current = true;
      setErrorSlot(slotId);
      setTimeout(() => setErrorSlot(null), 500);
      return;
    }

    const next = { ...placements, [slotId]: answerId };
    setPlacements(next);

    if (Object.keys(next).length === items.length) {
      setTimeout(() => {
        if (hadMistake.current) {
          onIncorrectRef.current(null, null);
        } else {
          onCorrectRef.current(null, null);
        }
      }, 600);
    }
  }

  function slotClass(itemId) {
    let cls = "pm-slot";
    if (placements[itemId])        cls += " pm-slot--matched";
    else if (errorSlot === itemId) cls += " pm-slot--error";
    else if (hoverSlot === itemId) cls += " pm-slot--hover";
    return cls;
  }

  function matchedText(itemId) {
    const answerId = placements[itemId];
    return answerId ? (answers.find(a => a.id === answerId)?.text ?? null) : null;
  }

  return (
    <div
      className="session-body pm-root"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: "none" }}
    >
      <div className="pm-phrases">
        {items.map((item, idx) => (
          <div
            key={item.id}
            ref={el => { slotRefs.current[item.id] = el; }}
            className={slotClass(item.id)}
          >
            <span className="pm-slot__num">{idx + 1}</span>
            {placements[item.id]
              ? <span className="pm-slot__answer">{matchedText(item.id)}</span>
              : item.phrase
            }
          </div>
        ))}
      </div>

      <div className="pm-pool">
        {answers.map(answer => (
          <div
            key={answer.id}
            className={[
              "pm-answer-card",
              dragging?.answerId === answer.id ? "pm-answer-card--dragging" : "",
              placedIds.has(answer.id)          ? "pm-answer-card--placed"   : "",
            ].filter(Boolean).join(" ")}
            onPointerDown={e => handlePointerDown(e, answer)}
          >
            {answer.text}
          </div>
        ))}
      </div>

      {dragging && (
        <GhostText
          text={dragging.text}
          x={dragging.x}
          y={dragging.y}
          width={dragging.width}
          height={dragging.height}
        />
      )}
    </div>
  );
}
