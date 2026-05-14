import { useState } from "react";

export default function HelperPanel({ maxNumber = 10, onClose }) {
  const [count, setCount] = useState(0);

  function decrement() {
    setCount((prev) => Math.max(0, prev - 1));
  }

  function increment() {
    setCount((prev) => Math.min(maxNumber, prev + 1));
  }

  return (
    <div className="helper-panel" role="dialog" aria-label="Счётный помощник">
      <div className="helper-panel__inner">
        <div className="helper-panel__counter">
          <button
            type="button"
            className="helper-panel__btn helper-panel__btn--minus"
            onClick={decrement}
            disabled={count === 0}
            aria-label="Убрать один"
          >
            −
          </button>
          <span className="helper-panel__count" aria-live="polite">{count}</span>
          <button
            type="button"
            className="helper-panel__btn helper-panel__btn--plus"
            onClick={increment}
            disabled={count === maxNumber}
            aria-label="Добавить один"
          >
            +
          </button>
        </div>
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
