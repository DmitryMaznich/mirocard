import { useState, useEffect } from "react";
import DotGroup from "./DotGroup";
import { getVerdict } from "./engine";

function SideContent({ value, color, visualMode, showHint }) {
  if (visualMode === "numbers") {
    return (
      <>
        <div className="compare-big-number">{value}</div>
        {showHint && <DotGroup count={value} color={color} />}
      </>
    );
  }
  const showNumber = visualMode === "dots_numbers";
  return (
    <>
      <DotGroup count={value} color={color} />
      {showNumber && <div className="compare-number">{value}</div>}
    </>
  );
}

export default function CompareVisual({ task, mode, sessionStatus, onCorrect, onIncorrect }) {
  const [answered,  setAnswered]  = useState(false);
  const [showHints, setShowHints] = useState(false);

  const visualMode    = task.visualMode ?? (task.showNumbers ? "dots_numbers" : "dots");
  const isNumbers     = visualMode === "numbers";
  const isLeftCorrect = task.question === "more" ? task.left > task.right : task.left < task.right;

  // Derive locked state from authoritative session status so retries always unblock
  const isAnswered = answered || sessionStatus !== "task_active";
  const verdict    = sessionStatus === "answer_correct" ? getVerdict(task) : null;

  useEffect(() => {
    if (sessionStatus === "task_active") {
      setAnswered(false);
      setShowHints(false);
    }
  }, [sessionStatus]);

  function handleSide(pickedLeft) {
    if (isAnswered || task.question === "equal") return;
    setAnswered(true);
    if (isLeftCorrect === pickedLeft) {
      onCorrect(task.conceptId, null);
    } else {
      if (isNumbers) {
        setShowHints(true);
        setTimeout(() => setShowHints(false), 1500);
      }
      onIncorrect(task.conceptId, null);
    }
  }

  function handleEqual() {
    if (isAnswered) return;
    setAnswered(true);
    if (task.left === task.right) {
      onCorrect(task.conceptId, null);
    } else {
      onIncorrect(task.conceptId, null);
    }
  }

  const sideClass = `compare-side${isNumbers ? " compare-side--number" : " compare-side--dots"}`;

  return (
    <div className="compare-body">
      <div className="compare-instruction">{task.instruction ?? mode.ui.instruction}</div>
      {task.equalHint && <div className="compare-instruction-hint">{task.equalHint}</div>}
      <div className="compare-sides">
        <button className={sideClass} disabled={isAnswered} onClick={() => handleSide(true)}>
          <SideContent value={task.left} color="#4299e1" visualMode={visualMode} showHint={showHints} />
        </button>
        {task.showEqual && (
          <button
            className="compare-equal-btn compare-equal-btn--empty compare-equal-btn--hint"
            style={{ alignSelf: "center" }}
            disabled={isAnswered}
            onClick={handleEqual}
            aria-label="Одинаково"
          />
        )}
        <button className={sideClass} disabled={isAnswered} onClick={() => handleSide(false)}>
          <SideContent value={task.right} color="#fc8181" visualMode={visualMode} showHint={showHints} />
        </button>
      </div>
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
