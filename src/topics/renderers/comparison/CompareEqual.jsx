import { useState } from "react";
import CrocSign from "./CrocSign";
import { getVerdict } from "./engine";
import { getTopicTitle } from "@/shared/utils/format";

export default function CompareEqual({ task, mode, onCorrect, onIncorrect }) {
  const [crocState, setCrocState] = useState("closed");
  const [signText,  setSignText]  = useState(null);
  const [answered,  setAnswered]  = useState(false);
  const [verdict,   setVerdict2]  = useState(null);

  const isEqual    = task.left === task.right;
  const leftBigger = task.left > task.right;

  function handleNumberTap(pickedLeft) {
    if (answered) return;
    if (task.question === "equal") {
      // should tap = button, not a number
      setAnswered(true);
      onIncorrect(task.conceptId, null);
      return;
    }
    const isLeftCorrect = task.question === "more" ? leftBigger : !leftBigger;
    if (pickedLeft !== isLeftCorrect) {
      setAnswered(true);
      onIncorrect(task.conceptId, null);
      return;
    }
    setAnswered(true);
    setCrocState(leftBigger ? "open-left" : "open-right");
    setTimeout(() => setSignText(leftBigger ? ">" : "<"), 400);
    setVerdict2(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  function handleEqualTap() {
    if (answered) return;
    setAnswered(true);
    if (!isEqual) {
      onIncorrect(task.conceptId, null);
      return;
    }
    setCrocState("equal");
    setSignText("=");
    setVerdict2(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{task.instruction ?? getTopicTitle(mode.ui.instruction)}</div>
      <div className="compare-sign-row">
        <button className="compare-side compare-side--number" disabled={answered} onClick={() => handleNumberTap(true)}>
          <div className="compare-big-number">{task.left}</div>
        </button>
        <div className="compare-croc-area">
          <CrocSign state={crocState} />
          {signText && <div className="compare-sign-text">{signText}</div>}
          <button className="compare-equal-btn" disabled={answered} onClick={handleEqualTap}>=</button>
        </div>
        <button className="compare-side compare-side--number" disabled={answered} onClick={() => handleNumberTap(false)}>
          <div className="compare-big-number">{task.right}</div>
        </button>
      </div>
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
