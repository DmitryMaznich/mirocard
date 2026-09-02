import { useState } from "react";

// Which of the three answers ("a" | "equal" | "b") is actually correct for
// this task — the same three values the answer buttons use, so a button's
// or a scene half's state is a single equality check against this.
function correctAnswerFor(task) {
  return task.question === "more" ? "a" : task.question === "less" ? "b" : "equal";
}

function Scene({ task, answered, correctAnswer, wrongPick }) {
  return (
    <div className="reallife-scene">
      <img className="reallife-scene-img" src={task.image} alt="" draggable={false} />
      <div className="reallife-overlay">
        <div className={[
          "reallife-side",
          answered && correctAnswer === "a" && "reallife-side--correct",
          wrongPick === "a" && "reallife-side--wrong",
        ].filter(Boolean).join(" ")}>
          <span className="reallife-tag">{task.nameANom}</span>
        </div>
        <div className={[
          "reallife-side",
          answered && correctAnswer === "b" && "reallife-side--correct",
          wrongPick === "b" && "reallife-side--wrong",
        ].filter(Boolean).join(" ")}>
          <span className="reallife-tag">{task.nameBNom}</span>
        </div>
      </div>
    </div>
  );
}

// A wrong tap shakes and un-picks itself (via onMistake, the same
// try-again-on-this-task callback CompareFirstNumber's MultiMode uses) —
// it doesn't end the task or advance the session. Only a correct tap
// locks the task and reveals the full spoken verdict, which itself then
// needs its own explicit tap (onAdvance) before the session moves on —
// matching the deliberate, unhurried pace the rest of the ladder's
// speech-reveal modes use.
export default function CompareRealLife({ task, onCorrect, onMistake, onAdvance }) {
  const [answered,  setAnswered]  = useState(false);
  const [wrongPick, setWrongPick] = useState(null); // "a" | "equal" | "b" | null, transient shake

  const correctAnswer = correctAnswerFor(task);

  function handleAnswer(value) {
    if (answered) return;
    if (value === correctAnswer) {
      setAnswered(true);
      onCorrect(task.conceptId, null);
      return;
    }
    setWrongPick(value);
    onMistake?.(task.conceptId, null);
    window.setTimeout(() => setWrongPick(null), 350);
  }

  if (answered) {
    return (
      <button className="session-full-tap cfn-result-tap" onClick={(e) => { e.stopPropagation(); onAdvance(); }}>
        <div className="compare-instruction">{task.instruction}</div>
        <Scene task={task} answered={answered} correctAnswer={correctAnswer} wrongPick={null} />
        <div className="compare-verdict cfn-verdict-reveal">{task.verdictText}</div>
      </button>
    );
  }

  return (
    <div className="compare-body compare-body--reallife">
      <div className="compare-instruction">{task.instruction}</div>
      <Scene task={task} answered={false} correctAnswer={correctAnswer} wrongPick={wrongPick} />
      <div className="cfn-options">
        <button type="button" className={`cfn-btn${wrongPick === "a" ? " cfn-btn--wrong" : ""}`} onClick={() => handleAnswer("a")}>У {task.nameA}</button>
        <button type="button" className={`cfn-btn${wrongPick === "equal" ? " cfn-btn--wrong" : ""}`} onClick={() => handleAnswer("equal")}>Поровну</button>
        <button type="button" className={`cfn-btn${wrongPick === "b" ? " cfn-btn--wrong" : ""}`} onClick={() => handleAnswer("b")}>У {task.nameB}</button>
      </div>
    </div>
  );
}
