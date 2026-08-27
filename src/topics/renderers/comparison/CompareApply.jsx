import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

// Tap one of a few concrete number tiles that fits the spoken constraint —
// a closed choice, not free number entry. See engine.js's
// generateApplyGenerateTask for why.
function GenerateStage({ task, answered, onAnswer }) {
  const [pickedIdx, setPickedIdx] = useState(-1);
  const [wrongIdx, setWrongIdx] = useState(-1);

  function tapOption(n, idx) {
    if (answered) return;
    setPickedIdx(idx);
    const isCorrect = task.op === "more" ? n > task.value : n < task.value;
    if (!isCorrect) {
      setWrongIdx(idx);
      window.setTimeout(() => setWrongIdx(-1), 350);
    }
    onAnswer(isCorrect);
  }

  return (
    <>
      <div className="apply-prompt-card" aria-label={task.promptText}>
        <div className="apply-prompt-icon" aria-hidden="true">{task.op === "more" ? ">" : "<"}</div>
        <div className="apply-prompt-value" aria-hidden="true">{task.value}</div>
      </div>
      <div className="apply-order-row">
        {task.options.map((n, i) => (
          <button
            key={i}
            type="button"
            className={[
              "apply-order-btn",
              pickedIdx === i && wrongIdx !== i && "apply-order-btn--placed",
              wrongIdx === i && "apply-order-btn--wrong",
            ].filter(Boolean).join(" ")}
            disabled={answered}
            onClick={() => tapOption(n, i)}
          >
            {n}
          </button>
        ))}
      </div>
    </>
  );
}

// One slot the child can drop a tile into. `value` is the number already
// placed here (from `placement`), or null while empty.
function OrderSlot({ slotIdx, label, value, wrong }) {
  const { isOver, setNodeRef } = useDroppable({ id: `apply-slot-${slotIdx}`, data: { slotIdx } });
  const cls = [
    "apply-order-slot-drop",
    value != null && "apply-order-slot-drop--correct",
    isOver && value == null && !wrong && "apply-order-slot-drop--over",
    wrong && "apply-order-slot-drop--wrong",
  ].filter(Boolean).join(" ");
  return (
    <div className="apply-order-slot">
      <div className="apply-order-slot-label">{label}</div>
      <div ref={setNodeRef} className={cls}>{value ?? "?"}</div>
    </div>
  );
}

// One draggable number tile sitting in the tray, before it's been placed.
function OrderTile({ idx, value, disabled }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `apply-tile-${idx}`,
    data: { idx },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      className="apply-order-tile"
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
        transition: isDragging ? "none" : "transform 0.15s ease",
        cursor: disabled ? "default" : "grab",
      }}
      {...listeners}
      {...attributes}
    >
      {value}
    </div>
  );
}

// Drag a tile from the tray into one of the labeled slots — a physical
// sort, not a tap-in-order sequence. Any slot can be filled first; each
// drop is checked against its own position in `task.sorted`, so the child
// decides where a number goes rather than always picking "the next one".
function OrderStage({ task, answered, onAnswer }) {
  // placement[tileIdx] = slotIdx once placed, else null.
  const [placement, setPlacement] = useState(() => Array(task.numbers.length).fill(null));
  const [wrongSlotIdx, setWrongSlotIdx] = useState(-1);
  const [activeIdx, setActiveIdx] = useState(-1);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragStart({ active }) {
    setActiveIdx(active.data.current.idx);
  }

  function handleDragEnd({ active, over }) {
    setActiveIdx(-1);
    if (!over || answered) return;
    const tileIdx = active.data.current.idx;
    const slotIdx = over.data.current.slotIdx;
    if (placement.includes(slotIdx)) return; // slot already filled — no-op, tile snaps back

    if (task.sorted[slotIdx] !== task.numbers[tileIdx]) {
      setWrongSlotIdx(slotIdx);
      window.setTimeout(() => setWrongSlotIdx(-1), 350);
      onAnswer(false);
      return;
    }

    const next = [...placement];
    next[tileIdx] = slotIdx;
    setPlacement(next);
    if (next.every((v) => v !== null)) onAnswer(true);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveIdx(-1)}>
      <div className="apply-order-slots">
        {task.sorted.map((_, slotIdx) => {
          const tileIdx = placement.indexOf(slotIdx);
          return (
            <OrderSlot
              key={slotIdx}
              slotIdx={slotIdx}
              label={`${slotIdx + 1}-е`}
              value={tileIdx >= 0 ? task.numbers[tileIdx] : null}
              wrong={wrongSlotIdx === slotIdx}
            />
          );
        })}
      </div>
      <div className="apply-order-tray">
        {task.numbers.map((n, idx) => placement[idx] === null && (
          <OrderTile key={idx} idx={idx} value={n} disabled={answered} />
        ))}
      </div>
      <div className="apply-order-tray-caption">перетащи число в нужное место</div>
      <DragOverlay dropAnimation={null}>
        {activeIdx >= 0 ? <div className="apply-order-tile apply-order-tile--overlay">{task.numbers[activeIdx]}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}

export default function CompareApply({ task, onCorrect, onIncorrect }) {
  const [answered, setAnswered] = useState(false);

  function handleAnswer(isCorrect) {
    if (answered) return;
    setAnswered(true);
    if (isCorrect) onCorrect(task.conceptId, null);
    else onIncorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body compare-body--apply">
      <div className="apply-kicker">{task.instruction}</div>
      {task.taskType === "order" ? (
        <OrderStage task={task} answered={answered} onAnswer={handleAnswer} />
      ) : (
        <GenerateStage task={task} answered={answered} onAnswer={handleAnswer} />
      )}
    </div>
  );
}
