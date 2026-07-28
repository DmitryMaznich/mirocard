import { useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Button from "@/shared/components/Button";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { useFitOneLine } from "./textFit.js";
import "./place_value.css";
import "./coins.css";

function DraggableTenStack({ id }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data: { kind: "ten" } });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : "auto", cursor: "grab", touchAction: "none" }}
      {...listeners}
      {...attributes}
    >
      <TenStack />
    </div>
  );
}

// Must be a child of <DndContext>, not a sibling call in the component that renders
// <DndContext> itself — useDroppable() only registers with the nearest DndContext
// ancestor found via React context, which doesn't exist yet while the parent's own
// render body is still executing.
function Zones({ tens, ones, exchanged, initialOnes }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pv-ones-zone" });
  return (
    <div className="pv-zones">
      <div className="pv-zone">
        <div className="pv-zone-label">ДЕСЯТКИ</div>
        <div className="pv-zone-body">
          {Array.from({ length: tens }, (_, i) =>
            !exchanged && i === tens - 1 ? (
              <DraggableTenStack key={i} id={`ten-${i}`} />
            ) : (
              <TenStack key={i} />
            )
          )}
        </div>
      </div>
      <div className={`pv-zone${isOver ? " pv-zone--drag-over" : ""}`} ref={setNodeRef}>
        <div className="pv-zone-label">ЕДИНИЦЫ</div>
        <div className="pv-zone-body">
          {Array.from({ length: ones }, (_, i) => {
            const isNew = exchanged && i >= initialOnes;
            return (
              <div
                key={i}
                className={isNew ? "pv-cube-pop" : undefined}
                style={isNew ? { animationDelay: `${(i - initialOnes) * 45}ms` } : undefined}
              >
                <Coin />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function RegroupTenTask({ task, onCorrect }) {
  const [tens, setTens] = useState(task.initial.tens);
  const [ones, setOnes] = useState(task.initial.ones);
  const [exchanged, setExchanged] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragEnd({ over }) {
    if (!over || over.id !== "pv-ones-zone" || tens < 1 || exchanged) return;
    setTens((t) => t - 1);
    setOnes((o) => o + 10);
    setExchanged(true);
  }

  function handleContinue() {
    onCorrect(task.conceptId, task.cardId);
  }

  const { ref: questionRef, fontSize: questionFontSize } = useFitOneLine("Разменяй десяток в единицы", { max: 45, min: 13 });

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen cb-screen">
        <div className="pv-question">
          <span ref={questionRef} style={{ fontSize: questionFontSize }}>Разменяй десяток в единицы</span>
        </div>

        <Zones tens={tens} ones={ones} exchanged={exchanged} initialOnes={task.initial.ones} />

        <div className="pv-spacer" />

        {/* Kept as a deliberate exception to "auto-advance like
            build_number": the point of this mode is for the child to see
            and read the before/after equation, not to be swept past it. */}
        {exchanged && (
          <div className="pv-result-panel">
            <div className="pv-result-line">
              {task.initial.tens * 10} + {task.initial.ones} = {task.number}
            </div>
            <div className="pv-result-line pv-result-line--sum">
              {task.after.tens * 10} + {task.after.ones} = {task.number}
            </div>
            <Button variant="secondary" onClick={handleContinue}>Далее →</Button>
          </div>
        )}
      </div>
    </DndContext>
  );
}
