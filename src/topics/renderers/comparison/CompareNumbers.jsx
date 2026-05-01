import { useState } from "react";
import DotGroup from "./DotGroup";
import { getVerdict } from "./engine";

export default function CompareNumbers({ task, mode, onCorrect, onIncorrect }) {
  const [answered,   setAnswered]   = useState(false);
  const [verdict,    setVerdict2]   = useState(null);
  const [showHints,  setShowHints]  = useState(false);

  const isLeftCorrect = task.question === "more" ? task.left > task.right : task.left < task.right;

  function handleSide(pickedLeft) {
    if (answered || task.question === "equal") return;
    setAnswered(true);
    if (isLeftCorrect === pickedLeft) {
      setVerdict2(getVerdict(task));
      onCorrect(task.conceptId, null);
    } else {
      setShowHints(true);
      setTimeout(() => setShowHints(false), 1500);
      onIncorrect(task.conceptId, null);
    }
  }

  function handleEqual() {
    if (answered) return;
    setAnswered(true);
    if (task.left === task.right) {
      setVerdict2(getVerdict(task));
      onCorrect(task.conceptId, null);
    } else {
      onIncorrect(task.conceptId, null);
    }
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{mode.ui.instruction}</div>
      <div className="compare-sides">
        <button className="compare-side compare-side--number" disabled={answered} onClick={() => handleSide(true)}>
          <div className="compare-big-number">{task.left}</div>
          {showHints && <DotGroup count={task.left} color="#4299e1" />}
        </button>
        <button
          className="compare-equal-btn compare-equal-btn--empty"
          style={{ alignSelf: "center" }}
          disabled={answered}
          onClick={handleEqual}
          aria-label="Одинаково"
        />
        <button className="compare-side compare-side--number" disabled={answered} onClick={() => handleSide(false)}>
          <div className="compare-big-number">{task.right}</div>
          {showHints && <DotGroup count={task.right} color="#fc8181" />}
        </button>
      </div>
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
