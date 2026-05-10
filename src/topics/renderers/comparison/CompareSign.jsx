import { useState, useEffect } from "react";
import CrocSign from "./CrocSign";
import { getVerdict } from "./engine";

function CrocTip() {
  return (
    <div className="compare-croc-tip">
      <div className="compare-croc-tip__icon">
        <CrocSign state="closed" size={52} />
      </div>
      <p className="compare-croc-tip__text">
        Крокодил всегда хочет съесть <strong>больше!</strong>
      </p>
    </div>
  );
}

export default function CompareSign({ task, mode, sessionStatus, onCorrect, onIncorrect }) {
  const [answered, setAnswered] = useState(false);
  const [crocState, setCrocState] = useState("closed");
  const [verdict,   setVerdict]  = useState(null);

  const isAnswered = answered || sessionStatus !== "task_active";

  useEffect(() => {
    if (sessionStatus === "task_active") {
      setAnswered(false);
      setCrocState("closed");
      setVerdict(null);
    }
  }, [sessionStatus]);

  const leftBigger  = task.left > task.right;
  const isEqualTask = task.question === "equal";

  // Derive instruction from task data — never rely on engine-cached string
  const baseQ = isEqualTask ? "more" : (task.question ?? "more");
  const verb  = baseQ === "less" ? "меньшее" : "большее";
  const instruction = isEqualTask
    ? "Одинаковые — нажми посередине"
    : `Нажми на ${verb} число`;

  function handleNumberTap(pickedLeft) {
    if (isAnswered) return;
    if (isEqualTask) {
      setAnswered(true);
      onIncorrect(task.conceptId, null);
      return;
    }
    const isLeftCorrect = task.question === "more" ? leftBigger : !leftBigger;
    if (isLeftCorrect !== pickedLeft) {
      setAnswered(true);
      onIncorrect(task.conceptId, null);
      return;
    }
    setAnswered(true);
    setCrocState(leftBigger ? "open-left" : "open-right");
    setVerdict(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  function handleEqualTap() {
    if (isAnswered || !isEqualTask) return;
    setAnswered(true);
    setCrocState("equal");
    setVerdict(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  const crocEl = <CrocSign state={crocState} />;

  return (
    <div className="compare-body">
      <CrocTip />
      <div className="compare-instruction">{instruction}</div>
      <div className="compare-sign-row">
        <button
          className="compare-side compare-side--number"
          disabled={isAnswered}
          onClick={() => handleNumberTap(true)}
        >
          <div className="compare-big-number">{task.left}</div>
        </button>

        {isEqualTask && !isAnswered
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
          disabled={isAnswered}
          onClick={() => handleNumberTap(false)}
        >
          <div className="compare-big-number">{task.right}</div>
        </button>
      </div>
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
