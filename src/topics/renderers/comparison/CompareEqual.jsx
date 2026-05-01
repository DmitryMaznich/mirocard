import { useState } from "react";
import CrocSign from "./CrocSign";

export default function CompareEqual({ task, mode, onCorrect, onIncorrect }) {
  const [crocState, setCrocState] = useState("closed");
  const [signText, setSignText]   = useState(null);
  const isEqual    = task.left === task.right;
  const leftBigger = task.left > task.right;

  function handleNumberTap(pickedLeft) {
    if (isEqual || leftBigger !== pickedLeft) {
      onIncorrect(task.conceptId, null);
      return;
    }
    setCrocState(pickedLeft ? "open-right" : "open-left");
    setTimeout(() => setSignText(pickedLeft ? ">" : "<"), 400);
    onCorrect(task.conceptId, null);
  }

  function handleEqualTap() {
    if (!isEqual) { onIncorrect(task.conceptId, null); return; }
    setCrocState("equal");
    setSignText("=");
    onCorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{mode.ui.instruction}</div>
      <div className="compare-sign-row">
        <button className="compare-side compare-side--number" onClick={() => handleNumberTap(true)}>
          <div className="compare-big-number">{task.left}</div>
        </button>
        <div className="compare-croc-area">
          <CrocSign state={crocState} />
          {signText && <div className="compare-sign-text">{signText}</div>}
          <button className="compare-equal-btn" onClick={handleEqualTap}>=</button>
        </div>
        <button className="compare-side compare-side--number" onClick={() => handleNumberTap(false)}>
          <div className="compare-big-number">{task.right}</div>
        </button>
      </div>
    </div>
  );
}
