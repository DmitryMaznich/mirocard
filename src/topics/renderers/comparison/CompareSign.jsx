import { useState, useEffect } from "react";
import CrocSign from "./CrocSign";
import { getVerdict } from "./engine";

// The tip follows what is asked: the open mouth faces the bigger number, the
// sharp corner points at the smaller one — the same sign seen from each side.
function CrocTip({ ask }) {
  return (
    <div className="compare-croc-tip">
      <div className="compare-croc-tip__icon">
        <CrocSign state="closed" size={52} />
      </div>
      <p className="compare-croc-tip__text">
        {ask === "less"
          ? <>Острый уголок показывает на <strong>меньшее</strong></>
          : <>Крокодил открывает пасть к <strong>большему</strong></>}
      </p>
    </div>
  );
}

export default function CompareSign({ task, sessionStatus, onCorrect, onIncorrect }) {
  const [answered, setAnswered] = useState(false);
  const [crocState, setCrocState] = useState("closed");
  const [verdict,   setVerdict]  = useState(null);
  const [shake,     setShake]    = useState(null); // "left" | "right" | "equal" | null

  const isAnswered = answered || sessionStatus !== "task_active";

  useEffect(() => {
    if (sessionStatus === "task_active") {
      setAnswered(false);
      setCrocState("closed");
      setVerdict(null);
      setShake(null);
    }
  }, [sessionStatus]);

  const leftBigger  = task.left > task.right;
  const isEqualTask = task.left === task.right;
  // Older tasks (cached before 2.39.0) carry no `ask`; their equal pairs ask "больше".
  const ask = task.ask ?? (task.question === "less" ? "less" : "more");
  const instruction = ask === "less" ? "Нажми на меньшее число" : "Нажми на большее число";

  function wrong(target) {
    setAnswered(true);
    setShake(target);
    onIncorrect(task.conceptId, null);
  }

  function right(state) {
    setAnswered(true);
    setCrocState(state);
    setVerdict(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  function handleNumberTap(pickedLeft) {
    if (isAnswered) return;
    const isLeftCorrect = ask === "more" ? leftBigger : !leftBigger;
    if (isEqualTask || isLeftCorrect !== pickedLeft) return wrong(pickedLeft ? "left" : "right");
    right(leftBigger ? "open-left" : "open-right");
  }

  function handleEqualTap() {
    if (isAnswered) return;
    if (!isEqualTask) return wrong("equal");
    right("equal");
  }

  const numberClass = (side) => `compare-side compare-side--number${shake === side ? " compare-side--shake" : ""}`;

  return (
    <div className="compare-body">
      <CrocTip ask={ask} />
      <div className="compare-instruction">{instruction}</div>
      {task.showEqual && <div className="compare-instruction-hint">Если поровну — нажми на крокодила</div>}
      <div className="compare-sign-row">
        <button className={numberClass("left")} disabled={isAnswered} onClick={() => handleNumberTap(true)}>
          <div className="compare-big-number">{task.left}</div>
        </button>

        {/* With = on, «поровну» is a tap on the crocodile itself — on every
            pair, so a crocodile that only answers on the equal one can't give
            it away. */}
        {task.showEqual ? (
          <button
            className={`compare-croc-area croc-tap-btn${shake === "equal" ? " compare-side--shake" : ""}`}
            disabled={isAnswered}
            onClick={handleEqualTap}
            aria-label="Поровну"
          >
            <CrocSign state={crocState} />
          </button>
        ) : (
          <div className="compare-croc-area">
            <CrocSign state={crocState} />
          </div>
        )}

        <button className={numberClass("right")} disabled={isAnswered} onClick={() => handleNumberTap(false)}>
          <div className="compare-big-number">{task.right}</div>
        </button>
      </div>
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
