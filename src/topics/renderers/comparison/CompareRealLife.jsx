import { useState } from "react";

export default function CompareRealLife({ task, onCorrect, onIncorrect, onAdvance }) {
  const [answered, setAnswered]   = useState(false);
  const [wrongSide, setWrongSide] = useState(null); // "a" | "b" | "equal" | null

  function flashWrong(side) {
    setWrongSide(side);
    window.setTimeout(() => setWrongSide(null), 350);
  }

  function handlePick(pickedA) {
    if (answered || task.question === "equal") return;
    setAnswered(true);
    const isCorrect = pickedA ? task.question === "more" : task.question === "less";
    if (isCorrect) onCorrect(task.conceptId, null);
    else {
      flashWrong(pickedA ? "a" : "b");
      onIncorrect(task.conceptId, null);
    }
  }

  function handleEqual() {
    if (answered) return;
    setAnswered(true);
    if (task.question === "equal") onCorrect(task.conceptId, null);
    else {
      flashWrong("equal");
      onIncorrect(task.conceptId, null);
    }
  }

  const cards = (
    <div className="reallife-cards">
      <div className={`reallife-card${wrongSide === "a" ? " reallife-card--wrong" : ""}`}>
        <div className="reallife-name">{task.nameA}</div>
        <div className="reallife-count">{task.left}</div>
      </div>
      <div className={`reallife-card${wrongSide === "b" ? " reallife-card--wrong" : ""}`}>
        <div className="reallife-name">{task.nameB}</div>
        <div className="reallife-count">{task.right}</div>
      </div>
    </div>
  );

  if (answered) {
    return (
      <button className="session-full-tap cfn-result-tap" onClick={(e) => { e.stopPropagation(); onAdvance(); }}>
        <div className="compare-instruction">{task.instruction}</div>
        {cards}
        <div className="compare-verdict cfn-verdict-reveal">{task.verdictText}</div>
      </button>
    );
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{task.instruction}</div>
      <div className="reallife-cards">
        <button type="button" className={`reallife-card${wrongSide === "a" ? " reallife-card--wrong" : ""}`} onClick={() => handlePick(true)}>
          <div className="reallife-name">{task.nameA}</div>
          <div className="reallife-count">{task.left}</div>
        </button>
        <button type="button" className={`reallife-card${wrongSide === "b" ? " reallife-card--wrong" : ""}`} onClick={() => handlePick(false)}>
          <div className="reallife-name">{task.nameB}</div>
          <div className="reallife-count">{task.right}</div>
        </button>
      </div>
      <button type="button" className={`reallife-equal-btn${wrongSide === "equal" ? " reallife-equal-btn--wrong" : ""}`} onClick={handleEqual}>
        Поровну
      </button>
    </div>
  );
}
