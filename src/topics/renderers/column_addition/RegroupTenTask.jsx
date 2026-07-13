import { useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import Button from "@/shared/components/Button";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { UnitCube, TenCard } from "./PlaceValueBlocks.jsx";
import { pluralTens, pluralOnes } from "./placeValueLabels.js";
import "./place_value.css";

function DraggableTenCard({ id }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { kind: "ten" } });
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1, cursor: "grab" }} {...listeners} {...attributes}>
      <TenCard />
    </div>
  );
}

export default function RegroupTenTask({ task, onCorrect, onMistake }) {
  const [tens, setTens] = useState(task.initial.tens);
  const [ones, setOnes] = useState(task.initial.ones);
  const [exchanged, setExchanged] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const { speak } = useSpeech();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const { setNodeRef: setOnesDropRef, isOver } = useDroppable({ id: "pv-ones-zone" });

  function handleDragEnd({ over }) {
    if (!over || over.id !== "pv-ones-zone" || tens < 1 || exchanged) return;
    setTens((t) => t - 1);
    setOnes((o) => o + 10);
    setExchanged(true);
    speak("Один десяток разменяли на десять единиц");
  }

  function handleAnswer(saysChanged) {
    if (saysChanged) {
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 500);
      onMistake?.(task.conceptId, task.cardId);
      return;
    }
    setAnswered(true);
    speak("Верно! Число не изменилось");
    onCorrect(task.conceptId, task.cardId);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="pv-screen">
        <div className="pv-instruction">Размени один десяток на единицы</div>
        <div className="pv-number">{task.number}</div>

        <div className="pv-zones">
          <div className="pv-zone">
            <div className="pv-zone-label">ДЕСЯТКИ</div>
            <div className="pv-zone-body">
              {Array.from({ length: tens }, (_, i) =>
                !exchanged && i === tens - 1 ? (
                  <DraggableTenCard key={i} id={`ten-${i}`} />
                ) : (
                  <TenCard key={i} />
                )
              )}
            </div>
          </div>
          <div className={`pv-zone${isOver ? " pv-zone--drag-over" : ""}`} ref={setOnesDropRef}>
            <div className="pv-zone-label">ЕДИНИЦЫ</div>
            <div className="pv-zone-body">
              {Array.from({ length: ones }, (_, i) => {
                const isNew = exchanged && i >= task.initial.ones;
                return (
                  <div
                    key={i}
                    className={isNew ? "pv-cube-pop" : undefined}
                    style={isNew ? { animationDelay: `${(i - task.initial.ones) * 45}ms` } : undefined}
                  >
                    <UnitCube />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pv-zones" style={{ flex: 0 }}>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {tens} {pluralTens(tens)}
          </div>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {ones} {pluralOnes(ones)}
          </div>
        </div>

        {!exchanged && <div className="pv-caption">перетащи десяток в ЕДИНИЦЫ, чтобы разменять</div>}

        <div className="pv-spacer" />

        {exchanged && !answered && (
          <div className="pv-footer" style={{ flexDirection: "column", gap: 8 }}>
            <div className="pv-question">Число изменилось?</div>
            <div className="pv-yesno-row">
              <Button variant={wrongFlash ? "primary" : "secondary"} onClick={() => handleAnswer(true)}>ДА</Button>
              <Button variant="secondary" onClick={() => handleAnswer(false)}>НЕТ</Button>
            </div>
          </div>
        )}

        {answered && (
          <div className="pv-result-panel">
            <div className="pv-result-line">
              {task.initial.tens * 10} + {task.initial.ones} = {task.number}
            </div>
            <div className="pv-result-line pv-result-line--sum">
              {task.after.tens * 10} + {task.after.ones} = {task.number}
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
