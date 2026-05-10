import { useState } from "react";
import DrawingSignPad from "./DrawingSignPad";
import { getVerdict } from "./engine";

export default function CompareDrawSign({ task, mode, onCorrect, onIncorrect }) {
  const [answered,    setAnswered]    = useState(false);
  const [shakeCanvas, setShakeCanvas] = useState(false);
  const [verdict,     setVerdict2]    = useState(null);

  const correctSign = task.left > task.right ? ">" : task.left < task.right ? "<" : "=";

  function handleSignRecognized(sign, clearCanvas) {
    if (answered) return;
    if (sign !== correctSign) {
      setAnswered(true);
      setShakeCanvas(true);
      setTimeout(() => setShakeCanvas(false), 400);
      onIncorrect(task.conceptId, null);
      setTimeout(() => clearCanvas(), 800);
      return;
    }
    setAnswered(true);
    setVerdict2(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{task.instruction ?? mode.ui.instruction}</div>
      <div className="croc-put-sign-numbers croc-draw-sign-layout">
        <span className="croc-put-sign-num">{task.left}</span>
        <DrawingSignPad
          taskKey={`${task.type}-${task.left}-${task.right}`}
          onSignRecognized={handleSignRecognized}
          disabled={answered}
          shake={shakeCanvas}
        />
        <span className="croc-put-sign-num">{task.right}</span>
      </div>
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
