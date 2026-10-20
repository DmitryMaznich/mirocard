import { useRef, useState } from "react";
import CrocSign from "./CrocSign.jsx";

export default function CompareSign({ task, sessionStatus, onCorrect, onIncorrect }) {
  // The host remounts on a new task or retry, preserving state on UI switches.
  const [answered, setAnswered] = useState(false);
  const submitted = useRef(false);
  const locked = answered || sessionStatus !== "task_active";
  const equal = task.left === task.right;
  const correct = sessionStatus === "answer_correct";
  const crocState = !correct ? "closed" : equal ? "equal" : task.left > task.right ? "open-left" : "open-right";

  function answer(side) {
    if (locked || submitted.current) return;
    submitted.current = true;
    setAnswered(true);
    const correctSide = equal ? "equal" : (task.question === "more" ? task.left > task.right : task.left < task.right) ? "left" : "right";
    (side === correctSide ? onCorrect : onIncorrect)(task.conceptId, null);
  }

  return (
    <div className="pilot-compare-body" lang={task.languageContext.contentLanguage}>
      <div className="pilot-compare-croc-tip">
        <div className="pilot-compare-croc-tip__icon"><CrocSign size={52} /></div>
        <p className="pilot-compare-croc-tip__text">{task.crocTip}</p>
      </div>
      <div className="pilot-compare-instruction">{task.instruction}</div>
      <div className="pilot-compare-sign-row">
        <button className="pilot-compare-side pilot-compare-side--number" disabled={locked} onClick={() => answer("left")}>
          <span className="pilot-compare-big-number">{task.left}</span>
        </button>
        {equal ? (
          <button className="pilot-compare-croc-area pilot-croc-tap-btn" disabled={locked} aria-label={task.equalLabel} onClick={() => answer("equal")}>
            <CrocSign state={crocState} />
          </button>
        ) : <div className="pilot-compare-croc-area"><CrocSign state={crocState} /></div>}
        <button className="pilot-compare-side pilot-compare-side--number" disabled={locked} onClick={() => answer("right")}>
          <span className="pilot-compare-big-number">{task.right}</span>
        </button>
      </div>
      {correct && <div className="pilot-compare-verdict">{task.verdictText}</div>}
    </div>
  );
}
