import { useState } from "react";
import { buildStickSlots, getStickBeadColor } from "./stickModel";

export default function HelperPanel({ maxNumber = 10, onClose }) {
  const helperTask = { railSize: maxNumber, maxNumber, operation: "add", start: 0, delta: maxNumber, result: maxNumber };
  const [workCount, setWorkCount] = useState(0);
  const slots = buildStickSlots(helperTask, workCount);

  function handleBeadTap(slot) {
    if (slot.zone === "side") {
      setWorkCount(workCount + slot.zoneIndex + 1);
    } else if (slot.zone === "work") {
      setWorkCount(slot.zoneIndex);
    }
  }

  return (
    <div className="helper-panel" role="dialog" aria-label="Счётный помощник">
      <div className="helper-panel__inner">
        <div className="operation-stick">
          <div className="operation-stick__wrap">
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
                      onClick={() => handleBeadTap(slot)}
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
        <div className="helper-panel__count" aria-live="polite">{workCount}</div>
        <button
          type="button"
          className="helper-panel__close"
          onClick={onClose}
          aria-label="Закрыть помощник"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
