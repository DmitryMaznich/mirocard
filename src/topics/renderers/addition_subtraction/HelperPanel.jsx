import { useState } from "react";

export default function HelperPanel({ maxNumber = 10, onClose }) {
  const slots = Math.min(maxNumber, 20);
  const [count, setCount] = useState(0);

  function toggle(index) {
    if (index < count) {
      setCount(index);
    } else {
      setCount(index + 1);
    }
  }

  return (
    <div className="helper-panel" role="dialog" aria-label="Счётный помощник">
      <div className="helper-panel__inner">
        <div className="helper-abacus" style={{ "--helper-slots": slots }}>
          <div className="helper-abacus__rod" />
          <div className="helper-abacus__track">
            {Array.from({ length: slots }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`helper-abacus__bead${i < count ? " helper-abacus__bead--active" : ""}`}
                onClick={() => toggle(i)}
                aria-label={i < count ? `убрать бусину ${i + 1}` : `добавить бусину ${i + 1}`}
              />
            ))}
          </div>
        </div>
        <div className="helper-panel__count" aria-live="polite">{count}</div>
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
