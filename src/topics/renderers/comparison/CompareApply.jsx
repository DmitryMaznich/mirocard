import { useState } from "react";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

function GenerateStage({ task, answered, onAnswer }) {
  const [digits, setDigits] = useState([]);
  const value = digits.length ? Number(digits.join("")) : null;

  function tapDigit(d) {
    if (answered || digits.length >= 2) return;
    setDigits((prev) => [...prev, d]);
  }

  function backspace() {
    if (answered) return;
    setDigits((prev) => prev.slice(0, -1));
  }

  function submit() {
    if (answered || value == null) return;
    const inRange = value >= task.min && value <= task.max;
    const satisfies = task.op === "more" ? value > task.value : value < task.value;
    onAnswer(inRange && satisfies);
  }

  return (
    <>
      <div className="apply-prompt">{task.promptText}</div>
      <div className="apply-answer-slot">{value ?? "?"}</div>
      <div className="apply-numpad">
        {DIGITS.map((d) => (
          <button key={d} type="button" className="apply-numkey" disabled={answered} onClick={() => tapDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="apply-numkey apply-numkey--back" disabled={answered} onClick={backspace}>
          ⌫
        </button>
      </div>
      <button type="button" className="apply-submit-btn" disabled={answered || value == null} onClick={submit}>
        Проверить
      </button>
    </>
  );
}

function OrderStage({ task, answered, onAnswer }) {
  const [placed, setPlaced] = useState([]);
  const [wrongIdx, setWrongIdx] = useState(null);

  function tapNumber(idx) {
    if (answered || placed.includes(idx)) return;
    const expected = task.sorted[placed.length];
    if (task.numbers[idx] === expected) {
      const next = [...placed, idx];
      setPlaced(next);
      if (next.length === task.numbers.length) onAnswer(true);
    } else {
      setWrongIdx(idx);
      window.setTimeout(() => setWrongIdx(-1), 350);
      onAnswer(false);
    }
  }

  return (
    <div className="apply-order-row">
      {task.numbers.map((n, i) => {
        const order = placed.indexOf(i);
        return (
          <button
            key={i}
            type="button"
            className={[
              "apply-order-btn",
              order >= 0 && "apply-order-btn--placed",
              wrongIdx === i && "apply-order-btn--wrong",
            ].filter(Boolean).join(" ")}
            disabled={answered || order >= 0}
            onClick={() => tapNumber(i)}
          >
            {n}
            {order >= 0 && <span className="apply-order-badge">{order + 1}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function CompareApply({ task, onCorrect, onIncorrect }) {
  const [answered, setAnswered] = useState(false);

  function handleAnswer(isCorrect) {
    if (answered) return;
    setAnswered(true);
    if (isCorrect) onCorrect(task.conceptId, null);
    else onIncorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{task.instruction}</div>
      {task.taskType === "order" ? (
        <OrderStage task={task} answered={answered} onAnswer={handleAnswer} />
      ) : (
        <GenerateStage task={task} answered={answered} onAnswer={handleAnswer} />
      )}
    </div>
  );
}
