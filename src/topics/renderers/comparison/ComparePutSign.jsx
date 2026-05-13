import { useState } from "react";
import { getVerdict } from "./engine";
import { getTopicTitle } from "@/shared/utils/format";

export default function ComparePutSign({ task, mode, onCorrect, onIncorrect }) {
  const [answered,  setAnswered]  = useState(false);
  const [shakeSign, setShakeSign] = useState(null);
  const [verdict,   setVerdict2]  = useState(null);

  const correctSign = task.left > task.right ? ">" : task.left < task.right ? "<" : "=";

  function handleTap(sign) {
    if (answered) return;
    if (sign !== correctSign) {
      setAnswered(true);
      setShakeSign(sign);
      setTimeout(() => setShakeSign(null), 400);
      onIncorrect(task.conceptId, null);
      return;
    }
    setAnswered(true);
    setVerdict2(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{task.instruction ?? getTopicTitle(mode.ui.instruction)}</div>
      <div className="croc-put-sign-numbers">
        <span className="croc-put-sign-num">{task.left}</span>
        <span className="croc-put-sign-blank">{answered ? correctSign : "?"}</span>
        <span className="croc-put-sign-num">{task.right}</span>
      </div>
      <div className="croc-put-sign-btns">
        {["<", ">", "="].map((sign) => (
          <button
            key={sign}
            className={[
              "croc-put-sign-btn",
              shakeSign === sign               && "croc-put-sign-btn--shake",
              answered && correctSign === sign  && "croc-put-sign-btn--correct",
            ].filter(Boolean).join(" ")}
            disabled={answered}
            onClick={() => handleTap(sign)}
          >
            {sign}
          </button>
        ))}
      </div>
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
