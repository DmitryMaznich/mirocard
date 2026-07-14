import { useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Button from "@/shared/components/Button";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { UnitCube, TenCard } from "./PlaceValueBlocks.jsx";
import { pluralTens, pluralOnes } from "./placeValueLabels.js";
import "./place_value.css";

function TrayItem({ id, kind, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, data: { kind } });
  return (
    <div
      ref={setNodeRef}
      className="pv-tray-item"
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 10 : "auto" }}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

// Must be a child of <DndContext>, not a sibling call in the component that renders
// <DndContext> itself — useDroppable() only registers with the nearest DndContext
// ancestor found via React context, which doesn't exist yet while the parent's own
// render body is still executing.
function Workspace({ placed, errorZones, solved, onRemoveTen, onRemoveOne }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pv-workspace" });
  return (
    <div className="pv-zones" ref={setNodeRef}>
      <div className={`pv-zone${errorZones.tens ? " pv-zone--error" : ""}${solved ? " pv-zone--correct" : ""}${isOver ? " pv-zone--drag-over" : ""}`}>
        <div className="pv-zone-label">ДЕСЯТКИ</div>
        <div className="pv-zone-body">
          {Array.from({ length: placed.tens }, (_, i) => (
            <div key={i} onClick={onRemoveTen}>
              <TenCard />
            </div>
          ))}
        </div>
      </div>
      <div className={`pv-zone${errorZones.ones ? " pv-zone--error" : ""}${solved ? " pv-zone--correct" : ""}${isOver ? " pv-zone--drag-over" : ""}`}>
        <div className="pv-zone-label">ЕДИНИЦЫ</div>
        <div className="pv-zone-body">
          {Array.from({ length: placed.ones }, (_, i) => (
            <div key={i} onClick={onRemoveOne}>
              <UnitCube />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function BuildNumberTask({ task, onCorrect, onMistake }) {
  const [placed, setPlaced] = useState({ tens: 0, ones: 0 });
  const [errorZones, setErrorZones] = useState({ tens: false, ones: false });
  const [solved, setSolved] = useState(false);
  const { speak } = useSpeech();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  function handleDragEnd({ active, over }) {
    if (!over) return;
    const kind = active.data.current?.kind;
    setErrorZones({ tens: false, ones: false });
    if (kind === "ten") {
      setPlaced((p) => ({ ...p, tens: p.tens + 1 }));
    } else if (kind === "unit") {
      setPlaced((p) => ({ ...p, ones: p.ones + 1 }));
    }
  }

  function removeTen() {
    setPlaced((p) => ({ ...p, tens: Math.max(0, p.tens - 1) }));
  }

  function removeOne() {
    setPlaced((p) => ({ ...p, ones: Math.max(0, p.ones - 1) }));
  }

  function handleDone() {
    const okTens = placed.tens === task.target.tens;
    const okOnes = placed.ones === task.target.ones;
    if (okTens && okOnes) {
      speak("Верно!");
      setSolved(true);
    } else {
      setErrorZones({ tens: !okTens, ones: !okOnes });
      onMistake?.(task.conceptId, task.cardId);
    }
  }

  function handleContinue() {
    onCorrect(task.conceptId, task.cardId);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen">
        <div className="pv-instruction">Собери число</div>
        <div className="pv-number">{task.number}</div>

        <Workspace placed={placed} errorZones={errorZones} solved={solved} onRemoveTen={removeTen} onRemoveOne={removeOne} />

        <div className="pv-zones" style={{ flex: 0 }}>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {placed.tens} {pluralTens(placed.tens)}
          </div>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {placed.ones} {pluralOnes(placed.ones)}
          </div>
        </div>

        <div className="pv-spacer" />

        <div className="pv-tray">
          <TrayItem id="tray-ten" kind="ten">
            <TenCard />
          </TrayItem>
          <TrayItem id="tray-unit" kind="unit">
            <UnitCube />
          </TrayItem>
        </div>

        <div className="pv-footer">
          {solved ? (
            <Button variant="secondary" onClick={handleContinue}>Далее →</Button>
          ) : (
            <Button variant="primary" onClick={handleDone}>ГОТОВО</Button>
          )}
        </div>
      </div>
    </DndContext>
  );
}
