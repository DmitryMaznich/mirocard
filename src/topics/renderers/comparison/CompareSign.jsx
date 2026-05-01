import { useState } from "react";
import CrocSign from "./CrocSign";

export default function CompareSign({ task, mode, onCorrect, onIncorrect }) {
  const [crocState, setCrocState] = useState("closed");
  const [signText, setSignText]   = useState(null);
  const leftBigger = task.left > task.right;

  function handleAnswer(pickedLeft) {
    if (leftBigger !== pickedLeft) {
      onIncorrect(task.conceptId, null);
      return;
    }
    setCrocState(pickedLeft ? "open-right" : "open-left");
    setTimeout(() => setSignText(pickedLeft ? ">" : "<"), 400);
    onCorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{mode.ui.instruction}</div>
      <div className="compare-sign-row">
        <button className="compare-side compare-side--number" onClick={() => handleAnswer(true)}>
          <div className="compare-big-number">{task.left}</div>
        </button>
        <div className="compare-croc-area">
          <CrocSign state={crocState} />
          {signText && <div className="compare-sign-text">{signText}</div>}
        </div>
        <button className="compare-side compare-side--number" onClick={() => handleAnswer(false)}>
          <div className="compare-big-number">{task.right}</div>
        </button>
      </div>
    </div>
  );
}
