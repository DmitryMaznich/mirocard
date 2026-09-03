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

// A wrong tap uses the same onIncorrect path CompareVisual/CompareSign use
// for their single-task wrong answer: it shakes, locks the buttons, and
// plays the shared "incorrect" sound + sad-face event, then the session
// harness itself resets status back to task_active after
// INCORRECT_FEEDBACK_MS (1.5s — see useSessionEngine.js) and remounts this
// component fresh via its taskRetry-keyed remount, showing the same scene
// again ready to retry. Nothing here needs to clear the shake or unlock the
// buttons manually — the remount already does that. Only a correct tap
// locks the task and reveals the full spoken verdict, which itself then
// needs its own explicit tap (onAdvance) before the session moves on —
// matching the deliberate, unhurried pace the rest of the ladder's
// speech-reveal modes use.
export default function CompareRealLife({ task, onCorrect, onIncorrect, onAdvance }) {
  const [answered,  setAnswered]  = useState(false);
  const [locked,    setLocked]    = useState(false); // set on a wrong tap, until the remount resets it
  const [wrongPick, setWrongPick] = useState(null);  // "a" | "equal" | "b" | null

  const correctAnswer = correctAnswerFor(task);

  function handleAnswer(value) {
    if (answered || locked) return;
    if (value === correctAnswer) {
      setAnswered(true);
      onCorrect(task.conceptId, null);
      return;
    }
    setLocked(true);
    setWrongPick(value);
    onIncorrect(task.conceptId, null);
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
        {/* Plain text, deliberately no letter/sign badge: this mode's whole
            point is moving the child from symbols to ordinary speech ("У
            кого больше?"), and a bare initial letter risks reading as a
            literacy-task cue (this app also teaches the alphabet
            elsewhere) rather than a name marker. Tried a badge here once;
            reverted after review — see git history. */}
        <button type="button" disabled={locked} className={`cfn-btn${wrongPick === "a" ? " cfn-btn--wrong" : ""}`} onClick={() => handleAnswer("a")}>У {task.nameA}</button>
        <button type="button" disabled={locked} className={`cfn-btn${wrongPick === "equal" ? " cfn-btn--wrong" : ""}`} onClick={() => handleAnswer("equal")}>Поровну</button>
        <button type="button" disabled={locked} className={`cfn-btn${wrongPick === "b" ? " cfn-btn--wrong" : ""}`} onClick={() => handleAnswer("b")}>У {task.nameB}</button>
      </div>
    </div>
  );
}
