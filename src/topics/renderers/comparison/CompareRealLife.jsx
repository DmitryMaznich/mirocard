import { useState } from "react";

// Which of the three answers ("a" | "equal" | "b") is actually correct for
// this task — the same three values the answer buttons use, so a button's
// or a scene half's state is a single equality check against this.
function correctAnswerFor(task) {
  return task.question === "more" ? "a" : task.question === "less" ? "b" : "equal";
}

function Scene({ task, answered, correctAnswer, picked }) {
  return (
    <div className="reallife-scene" style={{ backgroundImage: `url(${task.image})` }}>
      <div className={[
        "reallife-side",
        answered && correctAnswer === "a" && "reallife-side--correct",
        answered && picked === "a" && correctAnswer !== "a" && "reallife-side--wrong",
      ].filter(Boolean).join(" ")} />
      <div className={[
        "reallife-side",
        answered && correctAnswer === "b" && "reallife-side--correct",
        answered && picked === "b" && correctAnswer !== "b" && "reallife-side--wrong",
      ].filter(Boolean).join(" ")} />
    </div>
  );
}

export default function CompareRealLife({ task, onCorrect, onIncorrect, onAdvance }) {
  const [answered, setAnswered] = useState(false);
  const [picked,   setPicked]   = useState(null); // "a" | "equal" | "b" | null

  const correctAnswer = correctAnswerFor(task);

  function handleAnswer(value) {
    if (answered) return;
    setAnswered(true);
    setPicked(value);
    if (value === correctAnswer) onCorrect(task.conceptId, null);
    else onIncorrect(task.conceptId, null);
  }

  if (answered) {
    return (
      <button className="session-full-tap cfn-result-tap" onClick={(e) => { e.stopPropagation(); onAdvance(); }}>
        <div className="compare-instruction">{task.instruction}</div>
        <Scene task={task} answered={answered} correctAnswer={correctAnswer} picked={picked} />
        <div className="compare-verdict cfn-verdict-reveal">{task.verdictText}</div>
      </button>
    );
  }

  return (
    <div className="compare-body compare-body--reallife">
      <div className="compare-instruction">{task.instruction}</div>
      <Scene task={task} answered={false} correctAnswer={correctAnswer} picked={null} />
      <div className="cfn-options">
        <button type="button" className="cfn-btn" onClick={() => handleAnswer("a")}>У {task.nameA}</button>
        <button type="button" className="cfn-btn" onClick={() => handleAnswer("equal")}>Поровну</button>
        <button type="button" className="cfn-btn" onClick={() => handleAnswer("b")}>У {task.nameB}</button>
      </div>
    </div>
  );
}
