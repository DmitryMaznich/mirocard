import { useState } from "react";
import DrawingSignPad from "./DrawingSignPad";
import { getVerdict } from "./engine";
import { CrocTip } from "./CompareSign";
import { getTopicTitle } from "@/shared/utils/format";

export default function CompareDrawSign({ task, mode, taskRetry = 0, onCorrect, onIncorrect }) {
  const [answered,    setAnswered]    = useState(false);
  const [shakeCanvas, setShakeCanvas] = useState(false);
  const [verdict,     setVerdict2]    = useState(null);
  const [unreadable,  setUnreadable]  = useState(false);

  const correctSign = task.left > task.right ? ">" : task.left < task.right ? "<" : "=";

  function handleSignRecognized(sign, clearCanvas) {
    if (answered) return;
    // A drawing the pad can't read is a hand problem, not a comparison
    // mistake: ask to draw again, with no penalty and no lost stars.
    if (sign === "?") {
      setUnreadable(true);
      setTimeout(() => clearCanvas(), 800);
      return;
    }
    setUnreadable(false);
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
      {/* After a wrong sign: the crocodile from step 2 as a reminder of the direction. */}
      {taskRetry > 0 && !answered && <CrocTip ask="more" />}
      <div className="compare-instruction">{task.instruction ?? getTopicTitle(mode.ui.instruction)}</div>
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
      {unreadable && <div className="compare-instruction-hint" aria-live="polite">Не получилось разобрать — нарисуй ещё раз</div>}
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
