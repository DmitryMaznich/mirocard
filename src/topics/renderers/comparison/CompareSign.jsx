import { useState } from "react";
import CrocSign from "./CrocSign";
import { getVerdict } from "./engine";

export default function CompareSign({ task, mode, onCorrect, onIncorrect }) {
  const [crocState, setCrocState] = useState("closed");
  const [answered,  setAnswered]  = useState(false);
  const [verdict,   setVerdict2]  = useState(null);

  const leftBigger = task.left > task.right;
  const isEqualTask = task.question === "equal";

  const instruction = task.instruction ?? mode.ui.instruction;

  function handleNumberTap(pickedLeft) {
    if (answered) return;
    if (isEqualTask) {
      // tapping a number when equal = wrong
      onIncorrect(task.conceptId, null);
      return;
    }
    const isLeftCorrect = task.question === "more" ? leftBigger : !leftBigger;
    if (isLeftCorrect !== pickedLeft) {
      onIncorrect(task.conceptId, null);
      return;
    }
    setAnswered(true);
    setCrocState(leftBigger ? "open-left" : "open-right");
    setVerdict2(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  function handleEqualTap() {
    if (answered || !isEqualTask) return;
    setAnswered(true);
    setCrocState("equal");
    setVerdict2(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  const crocEl = <CrocSign state={crocState} />;

  return (
    <div className="compare-body">
      <div className="compare-instruction">{instruction}</div>
      <div className="compare-sign-row">
        <button
          className="compare-side compare-side--number"
          disabled={answered}
          onClick={() => handleNumberTap(true)}
        >
          <div className="compare-big-number">{task.left}</div>
        </button>

        {isEqualTask && !answered
          ? (
            <button className="compare-croc-area croc-tap-btn" onClick={handleEqualTap}>
              {crocEl}
            </button>
          ) : (
            <div className="compare-croc-area">
              {crocEl}
            </div>
          )
        }

        <button
          className="compare-side compare-side--number"
          disabled={answered}
          onClick={() => handleNumberTap(false)}
        >
          <div className="compare-big-number">{task.right}</div>
        </button>
      </div>
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
