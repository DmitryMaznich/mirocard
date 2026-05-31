import { useRef, useState } from "react";
import { buildStickSlots, getStickBeadColor, STICK_DRAG_THRESHOLD } from "./stickModel";

export default function HelperPanel({ maxNumber = 10, showMoveHint = false, onClose }) {
  const helperTask = { railSize: maxNumber, maxNumber, operation: "add", start: 0, delta: maxNumber, result: maxNumber };
  const [workCount, setWorkCount] = useState(0);
  const [lastHint, setLastHint] = useState(null); // { sign, count, key }
  const wrapRef = useRef(null);
  const dragRef = useRef(null);
  const slots = buildStickSlots(helperTask, workCount);

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
      setWorkCount(workCount + count);
      setLastHint({ sign: "+", count, key: Date.now() });
    } else if (deltaX > 0 && slot.zone === "work") {
      const count = workCount - slot.zoneIndex;
      setWorkCount(slot.zoneIndex);
      setLastHint({ sign: "-", count, key: Date.now() });
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
        <button
          type="button"
          className="helper-panel__close"
          onClick={onClose}
          aria-label="Закрыть помощник"
        >
          ✕
        </button>
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
          </div>
        </div>
        <div className="helper-panel__hint-area">
          {showMoveHint && lastHint && (
            <span
              key={lastHint.key}
              className={`helper-panel__hint helper-panel__hint--${lastHint.sign === "+" ? "add" : "sub"}`}
            >
              {lastHint.sign}{lastHint.count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
