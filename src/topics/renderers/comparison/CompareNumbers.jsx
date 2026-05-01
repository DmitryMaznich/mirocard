import { useState } from "react";
import DotGroup from "./DotGroup";

export default function CompareNumbers({ task, mode, onCorrect, onIncorrect }) {
  const [showHints, setShowHints] = useState(false);
  const leftBigger = task.left > task.right;

  function handleAnswer(pickedLeft) {
    if (leftBigger === pickedLeft) {
      onCorrect(task.conceptId, null);
    } else {
      setShowHints(true);
      setTimeout(() => setShowHints(false), 1500);
      onIncorrect(task.conceptId, null);
    }
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{mode.ui.instruction}</div>
      <div className="compare-sides">
        <button className="compare-side compare-side--number" onClick={() => handleAnswer(true)}>
          <div className="compare-big-number">{task.left}</div>
          {showHints && <DotGroup count={task.left} color="#4299e1" />}
        </button>
        <button className="compare-side compare-side--number" onClick={() => handleAnswer(false)}>
          <div className="compare-big-number">{task.right}</div>
          {showHints && <DotGroup count={task.right} color="#fc8181" />}
        </button>
      </div>
    </div>
  );
}
