import { useState } from "react";
import CrocSign from "./CrocSign";
import { getVerdict } from "./engine";

export default function CompareSign({ task, mode, onCorrect, onIncorrect }) {
  const [crocState, setCrocState] = useState("closed");
  const [signText,  setSignText]  = useState(null);
  const [answered,  setAnswered]  = useState(false);
  const [verdict,   setVerdict2]  = useState(null);

  const leftBigger = task.left > task.right;

  function handleNumberTap(pickedLeft) {
    if (answered) return;
    if (task.question === "equal") {
      // equal task handled by = button in croc area
      onIncorrect(task.conceptId, null);
      return;
    }
    const isLeftCorrect = task.question === "more" ? leftBigger : !leftBigger;
    setAnswered(true);
    if (isLeftCorrect !== pickedLeft) {
      onIncorrect(task.conceptId, null);
      return;
    }
    // Croc always shows mathematical truth
    setCrocState(leftBigger ? "open-right" : "open-left");
    setTimeout(() => setSignText(leftBigger ? ">" : "<"), 400);
    setVerdict2(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  function handleEqualTap() {
    if (answered || task.question !== "equal") return;
    setAnswered(true);
    setCrocState("equal");
    setTimeout(() => setSignText("="), 400);
    setVerdict2(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{mode.ui.instruction}</div>
      <div className="compare-sign-row">
        <button className="compare-side compare-side--number" disabled={answered} onClick={() => handleNumberTap(true)}>
          <div className="compare-big-number">{task.left}</div>
        </button>
        <div className="compare-croc-area">
          <CrocSign state={crocState} />
          {signText && <div className="compare-sign-text">{signText}</div>}
          {task.question === "equal" && !answered && (
            <button className="compare-equal-btn" onClick={handleEqualTap}>=</button>
          )}
        </div>
        <button className="compare-side compare-side--number" disabled={answered} onClick={() => handleNumberTap(false)}>
          <div className="compare-big-number">{task.right}</div>
        </button>
      </div>
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
