import { useState, useRef } from "react";
import { useTopicFile } from "@/shared/hooks/useTopicFile";
import { ChevronRightIcon } from "@/shared/components/ArrowIcons";
import "./Opposites.css";

function CardImage({ topicId, card }) {
  const url = useTopicFile(topicId, card?.image);
  if (!url) return <div className="opp-fo__card--loading" />;
  return <img src={url} alt="" draggable={false} />;
}

export default function FindOppositeTask({ task, mode, topicId, onCorrect, onIncorrect }) {
  const { stimulusCard, options } = task;
  const [answered,  setAnswered]  = useState(false);
  const [slotState, setSlotState] = useState("idle");
  const [dragging,  setDragging]  = useState(null);
  const slotRef = useRef(null);

  function isOverSlot(x, y) {
    const el = slotRef.current;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function handlePointerDown(e, opt) {
    if (answered) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({
      opt,
      x:       rect.left,
      y:       rect.top,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      size:    rect.width,
    });
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    setDragging(prev => ({
      ...prev,
      x: e.clientX - prev.offsetX,
      y: e.clientY - prev.offsetY,
    }));
    setSlotState(isOverSlot(e.clientX, e.clientY) ? "active" : "idle");
  }

  function handlePointerUp(e) {
    if (!dragging) return;
    const over = isOverSlot(e.clientX, e.clientY);
    const opt  = dragging.opt;
    setDragging(null);
    if (!over) {
      setSlotState("idle");
      return;
    }
    setAnswered(true);
    if (opt.isTarget) {
      setSlotState("correct");
      setTimeout(() => onCorrect(stimulusCard.pole, opt.card.id), 900);
    } else {
      setSlotState("wrong");
      setTimeout(() => onIncorrect(stimulusCard.pole, opt.card.id), 900);
    }
  }

  const correctCard = options.find(o => o.isTarget)?.card;

  return (
    <div
      className="session-body opp-fo"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: "none" }}
    >
      <div className="opp-fo__instruction">
        {mode?.ui?.instruction ?? "Найди противоположность и перетащи её сюда"}
      </div>

      <div className="opp-fo__pair">
        <div className="opp-fo__stimulus">
          {task.stimulusType === "text"
            ? <div className="opp-fo__stimulus-text">{task.stimulusLabel}</div>
            : <div className="opp-fo__stimulus-card"><CardImage topicId={topicId} card={stimulusCard} /></div>
          }
        </div>

        <div className="opp-fo__arrow"><ChevronRightIcon size={20} /></div>

        <div
          ref={slotRef}
          className={`opp-fo__slot opp-fo__slot--${slotState}`}
        >
          {slotState === "correct"
            ? task.distractorType === "text"
              ? <span className="opp-fo__slot-text">{correctCard?.poleLabel}</span>
              : <CardImage topicId={topicId} card={correctCard} />
            : "+"}
        </div>
      </div>

      <div className="opp-fo__scatter">
        {options.map((opt, i) => {
          const rotation   = ((opt.card.id.charCodeAt(0) * 7 + i * 13) % 9) - 4;
          const isDragging = dragging?.opt.card.id === opt.card.id;
          const isFaded    = answered && !isDragging;
          const isText     = task.distractorType === "text";
          return (
            <div
              key={opt.card.id}
              className={[
                isText ? "opp-fo__card--text" : "opp-fo__card",
                isDragging ? "opp-fo__card--dragging" : "",
                isFaded    ? "opp-fo__card--faded"    : "",
              ].filter(Boolean).join(" ")}
              style={{ transform: `rotate(${rotation}deg)` }}
              onPointerDown={e => handlePointerDown(e, opt)}
            >
              {isText
                ? opt.card.poleLabel
                : <CardImage topicId={topicId} card={opt.card} />
              }
            </div>
          );
        })}
      </div>

      {dragging && (
        <div
          className="opp-fo__ghost"
          style={{
            left:   dragging.x,
            top:    dragging.y,
            width:  dragging.size,
            height: dragging.size,
          }}
        >
          <CardImage topicId={topicId} card={dragging.opt.card} />
        </div>
      )}
    </div>
  );
}
