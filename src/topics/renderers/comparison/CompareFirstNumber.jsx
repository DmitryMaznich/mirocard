import { useState, useEffect, useRef } from "react";
import { getVerdict } from "./engine";
import { CrocTip } from "./CompareSign";

const SIGN    = { less: "<", equal: "=", more: ">" };
const OPTIONS = [
  { value: "less",  label: "Меньше", sign: "<" },
  { value: "equal", label: "Равно",  sign: "=" },
  { value: "more",  label: "Больше", sign: ">" },
];

function MultiMode({ task, onCorrect, onMistake, playFeedback }) {
  const items = task.items;
  const [answers,    setAnswers]    = useState(() => Array(items.length).fill(null));
  const [focusIndex, setFocusIndex] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(-1);
  const allDone = focusIndex >= items.length;
  const doneRef = useRef(false);

  const onCorrectRef = useRef(onCorrect);
  useEffect(() => { onCorrectRef.current = onCorrect; });

  function handleAnswer(value) {
    if (doneRef.current) return;
    const item = items[focusIndex];
    if (value !== item.question) {
      setWrongFlash(focusIndex);
      onMistake?.(task.conceptId, null);
      window.setTimeout(() => setWrongFlash(-1), 420);
      return;
    }
    playFeedback?.("correct");
    const next = [...answers];
    next[focusIndex] = value;
    setAnswers(next);
    const nextFocus = focusIndex + 1;
    setFocusIndex(nextFocus);
    if (nextFocus >= items.length) {
      doneRef.current = true;
      window.setTimeout(() => onCorrectRef.current(task.conceptId, null), 650);
    }
  }

  function signClass(i) {
    const b = "cfn-multi-sign";
    if (wrongFlash === i)   return `${b} ${b}--wrong`;
    if (answers[i] != null) return `${b} ${b}--done`;
    if (focusIndex === i)   return `${b} ${b}--active`;
    return b;
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">Сравни первое число</div>
      <div className="cfn-multi">
        {items.map((item, i) => (
          <div key={i} className={`cfn-multi-row${focusIndex === i ? " cfn-multi-row--active" : ""}`}>
            <div className="cfn-multi-num">{item.left}</div>
            <div className={signClass(i)}>
              {answers[i] != null ? SIGN[answers[i]] : focusIndex === i ? "?" : ""}
            </div>
            <div className="cfn-multi-num">{item.right}</div>
          </div>
        ))}
      </div>
      <div className="cfn-multi-divider" />
      <div className="cfn-options">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className="cfn-btn"
            disabled={allDone}
            onClick={() => handleAnswer(opt.value)}
          >
            <span className="cfn-btn-sign">{opt.sign}</span>
            <span className="cfn-btn-label">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SingleMode({ task, taskRetry, onCorrect, onIncorrect, onAdvance }) {
  // Only a right answer reveals the sign and the phrase: after a wrong one the
  // same pair comes back for another try and must not come back solved.
  const [result, setResult] = useState(null); // null | "right" | "wrong"
  const [picked, setPicked] = useState(null);
  const correct     = task.question;
  const showLabels  = task.showLabels !== false;
  const solved      = result === "right";

  function handleAnswer(value) {
    if (result) return;
    setPicked(value);
    if (value === correct) {
      setResult("right");
      onCorrect(task.conceptId, null);
    } else {
      setResult("wrong");
      onIncorrect(task.conceptId, null);
    }
  }

  const stage = (
    <div className="cfn-stage">
      <div className="cfn-card cfn-card--first">
        {showLabels && <div className="cfn-label">первое</div>}
        <div className="cfn-number">{task.left}</div>
      </div>
      <div className={`cfn-bridge${solved ? " cfn-bridge--shown" : ""}`}>
        {solved ? SIGN[correct] : "?"}
      </div>
      <div className="cfn-card cfn-card--second">
        {showLabels && <div className="cfn-label">второе</div>}
        <div className="cfn-number">{task.right}</div>
      </div>
    </div>
  );

  if (solved) {
    return (
      <button className="session-full-tap cfn-result-tap" onClick={(e) => { e.stopPropagation(); onAdvance(); }}>
        <div className="compare-instruction">Сравни первое число со вторым:</div>
        {stage}
        <div className="compare-verdict cfn-verdict-reveal">
          {getVerdict({ ...task, wordsVerdict: true })}
        </div>
      </button>
    );
  }

  return (
    <div className="compare-body">
      {taskRetry > 0 && !result && <CrocTip ask="more" />}
      <div className="compare-instruction">Сравни первое число со вторым:</div>
      {stage}
      <div className="cfn-multi-divider" />
      <div className="cfn-options">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`cfn-btn${result === "wrong" && picked === opt.value ? " cfn-btn--wrong" : ""}`}
            disabled={Boolean(result)}
            onClick={() => handleAnswer(opt.value)}
          >
            <span className="cfn-btn-sign">{opt.sign}</span>
            <span className="cfn-btn-label">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CompareFirstNumber({ task, taskRetry = 0, onCorrect, onIncorrect, onMistake, onAdvance, playFeedback }) {
  if (task.items) {
    return <MultiMode task={task} onCorrect={onCorrect} onMistake={onMistake} playFeedback={playFeedback} />;
  }
  return <SingleMode task={task} taskRetry={taskRetry} onCorrect={onCorrect} onIncorrect={onIncorrect} onAdvance={onAdvance} />;
}
