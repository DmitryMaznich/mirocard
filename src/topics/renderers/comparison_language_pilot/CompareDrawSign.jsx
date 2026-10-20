import { useRef, useState } from "react";
import DrawingSignPad from "./DrawingSignPad.jsx";

export default function CompareDrawSign({ task, sessionStatus, onCorrect, onIncorrect }) {
  const submitted = useRef(false);
  const [answered, setAnswered] = useState(false);
  const locked = answered || sessionStatus !== "task_active";
  const correctSign = task.left > task.right ? ">" : task.left < task.right ? "<" : "=";

  function handleSignRecognized(sign) {
    if (locked || submitted.current) return;
    submitted.current = true;
    setAnswered(true);
    (sign === correctSign ? onCorrect : onIncorrect)(task.conceptId, null);
  }

  return <div className="pilot-compare-body" lang={task.languageContext.contentLanguage}>
    <div className="pilot-compare-instruction">{task.instruction}</div>
    <div className="pilot-draw-sign-layout">
      <span className="pilot-draw-sign-number">{task.left}</span>
      <DrawingSignPad taskKey={`${task.type}-${task.left}-${task.right}`} onSignRecognized={handleSignRecognized} disabled={locked} label={task.canvasLabel} />
      <span className="pilot-draw-sign-number">{task.right}</span>
    </div>
    {sessionStatus === "answer_correct" && <div className="pilot-compare-verdict">{task.verdictText}</div>}
  </div>;
}
