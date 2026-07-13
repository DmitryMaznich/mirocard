import { useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import Button from "@/shared/components/Button";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { UnitCube, TenCard } from "./PlaceValueBlocks.jsx";
import { pluralTens, pluralOnes } from "./placeValueLabels.js";
import "./place_value.css";

function TrayItem({ id, kind, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { kind } });
  return (
    <div
      ref={setNodeRef}
      className="pv-tray-item"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

export default function BuildNumberTask({ task, onCorrect, onMistake }) {
  const [placed, setPlaced] = useState({ tens: 0, ones: 0 });
  const [errorZones, setErrorZones] = useState({ tens: false, ones: false });
  const { speak } = useSpeech();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const { setNodeRef: setWorkspaceRef, isOver } = useDroppable({ id: "pv-workspace" });

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
      onCorrect(task.conceptId, task.cardId);
    } else {
      setErrorZones({ tens: !okTens, ones: !okOnes });
      onMistake?.(task.conceptId, task.cardId);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen">
        <div className="pv-instruction">Собери число</div>
        <div className="pv-number">{task.number}</div>

        <div className="pv-zones" ref={setWorkspaceRef}>
          <div className={`pv-zone${errorZones.tens ? " pv-zone--error" : ""}${isOver ? " pv-zone--drag-over" : ""}`}>
            <div className="pv-zone-label">ДЕСЯТКИ</div>
            <div className="pv-zone-body">
              {Array.from({ length: placed.tens }, (_, i) => (
                <div key={i} onClick={removeTen}>
                  <TenCard />
                </div>
              ))}
            </div>
          </div>
          <div className={`pv-zone${errorZones.ones ? " pv-zone--error" : ""}${isOver ? " pv-zone--drag-over" : ""}`}>
            <div className="pv-zone-label">ЕДИНИЦЫ</div>
            <div className="pv-zone-body">
              {Array.from({ length: placed.ones }, (_, i) => (
                <div key={i} onClick={removeOne}>
                  <UnitCube />
                </div>
              ))}
            </div>
          </div>
        </div>

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
          <Button variant="primary" onClick={handleDone}>ГОТОВО</Button>
        </div>
      </div>
    </DndContext>
  );
}
