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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="pv-check-icon" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Single-row checklist: this mode has exactly one action (drag the ten into
// ЕДИНИЦЫ), so there's no active/wrong state to track — only pending until
// the drag succeeds, then done. The row's own text replaces what used to be
// a separate .pv-caption line below the zones.
function ChecklistItem({ text, done, textRef, fontSize }) {
  return (
    <div className={`pv-checklist-item${done ? " is-done" : " is-pending"}`}>
      <span className="pv-checklist-box">{done && <CheckIcon />}</span>
      <span ref={textRef} className="pv-checklist-text" style={fontSize ? { fontSize } : undefined}>
        {text}
      </span>
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

  const { ref: checklistRef, fontSize: checklistFontSize } = useFitOneLine("Разменяй десяток в единицы", { max: 45, min: 13 });

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen cb-screen">
        <div className="pv-checklist">
          <ChecklistItem text="Разменяй десяток в единицы" done={exchanged} textRef={checklistRef} fontSize={checklistFontSize} />
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
