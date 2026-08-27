import { useState } from "react";

// Tap one of a few concrete number tiles that fits the spoken constraint —
// a closed choice, not free number entry. See engine.js's
// generateApplyGenerateTask for why.
function GenerateStage({ task, answered, onAnswer }) {
  const [pickedIdx, setPickedIdx] = useState(-1);
  const [wrongIdx, setWrongIdx] = useState(-1);

  function tapOption(n, idx) {
    if (answered) return;
    setPickedIdx(idx);
    const isCorrect = task.op === "more" ? n > task.value : n < task.value;
    if (!isCorrect) {
      setWrongIdx(idx);
      window.setTimeout(() => setWrongIdx(-1), 350);
    }
    onAnswer(isCorrect);
  }

  return (
    <>
      <div className="apply-prompt">{task.promptText}</div>
      <div className="apply-order-row">
        {task.options.map((n, i) => (
          <button
            key={i}
            type="button"
            className={[
              "apply-order-btn",
              pickedIdx === i && wrongIdx !== i && "apply-order-btn--placed",
              wrongIdx === i && "apply-order-btn--wrong",
            ].filter(Boolean).join(" ")}
            disabled={answered}
            onClick={() => tapOption(n, i)}
          >
            {n}
          </button>
        ))}
      </div>
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
