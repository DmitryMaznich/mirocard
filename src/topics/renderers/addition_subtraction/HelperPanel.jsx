import { useRef, useState } from "react";
import { buildStickSlots, getStickBeadColor, getStickBeadCount, STICK_DRAG_THRESHOLD, STICK_GAP_SLOTS } from "./stickModel";

export default function HelperPanel({ maxNumber = 10, onClose }) {
  const helperTask = { railSize: maxNumber, maxNumber, operation: "add", start: 0, delta: maxNumber, result: maxNumber };
  const [workCount, setWorkCount] = useState(0);
  const [lastHint, setLastHint] = useState(null); // { sign, count, boundary, key }
  const [showHint, setShowHint] = useState(true);
  const wrapRef = useRef(null);
  const dragRef = useRef(null);
  const slots = buildStickSlots(helperTask, workCount);

  const beadCount = getStickBeadCount(helperTask);
  const totalSlots = beadCount + STICK_GAP_SLOTS;
  const hintLeftPercent = lastHint
    ? ((lastHint.boundary + STICK_GAP_SLOTS / 2) / totalSlots) * 100
    : null;

  function startDrag(e, slot) {
    e.preventDefault();
    wrapRef.current?.setPointerCapture?.(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, slot };
  }

  function endDrag(e) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    wrapRef.current?.releasePointerCapture?.(e.pointerId);

    const deltaX = e.clientX - d.startX;
    if (Math.abs(deltaX) < STICK_DRAG_THRESHOLD) return;

    const { slot } = d;
    if (deltaX < 0 && slot.zone === "side") {
      const count = slot.zoneIndex + 1;
      const newWork = workCount + count;
      setWorkCount(newWork);
      setLastHint({ sign: "+", count, boundary: newWork, key: Date.now() });
    } else if (deltaX > 0 && slot.zone === "work") {
      const newWork = slot.zoneIndex;
      const count = workCount - newWork;
      setWorkCount(newWork);
      setLastHint({ sign: "-", count, boundary: newWork, key: Date.now() });
    }
  }

  function cancelDrag(e) {
    if (dragRef.current?.pointerId === e.pointerId) {
      wrapRef.current?.releasePointerCapture?.(e.pointerId);
    }
    dragRef.current = null;
  }

  return (
    <div className="helper-panel" role="dialog" aria-label="Счётный помощник">
      <div className="helper-panel__sheet">
        <div className="operation-stick">
          <div
            ref={wrapRef}
            className="operation-stick__wrap"
            onPointerMove={() => {}}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
          >
            <div className="operation-stick__rod" />
            <div
              className="operation-stick__track"
              style={{ "--stick-columns": slots.length }}
              aria-label={`Счётная палка: ${workCount}`}
            >
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className={[
                    "operation-stick__slot",
                    `operation-stick__slot--${slot.zone}`,
                    slot.occupied ? "operation-stick__slot--occupied" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {slot.occupied && (
                    <button
                      type="button"
                      className={`operation-stick__bead operation-stick__bead--${getStickBeadColor(helperTask, slot.beadIndex)}`}
                      onPointerDown={(e) => startDrag(e, slot)}
                      aria-label={slot.zone === "work"
                        ? `убрать бусины до ${slot.zoneIndex}`
                        : `добавить ${slot.zoneIndex + 1} бусин`}
                    />
                  )}
                </div>
              ))}
            </div>
            {showHint && lastHint && (
              <div
                key={lastHint.key}
                className={`helper-panel__hint helper-panel__hint--${lastHint.sign === "+" ? "add" : "sub"}`}
                style={{ left: `${hintLeftPercent}%` }}
              >
                {lastHint.sign}{lastHint.count}
              </div>
            )}
          </div>
        </div>
        <div className="helper-panel__controls">
          <div className="helper-panel__btn-row">
            <button
              type="button"
              className={`helper-panel__hint-toggle${showHint ? " helper-panel__hint-toggle--on" : ""}`}
              onClick={() => setShowHint(s => !s)}
              aria-label={showHint ? "Скрыть подсказку" : "Показать подсказку"}
            >
              ±
            </button>
            <button
              type="button"
              className="helper-panel__close"
              onClick={onClose}
              aria-label="Закрыть помощник"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
