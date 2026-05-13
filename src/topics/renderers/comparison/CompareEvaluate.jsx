import { useState, useEffect, useRef } from "react";
import { getVerdict } from "./engine";

const SIGN_CHAR = { less: "<", equal: "=", more: ">" };

const SIGN_OPTIONS   = [{ value: "less" }, { value: "equal" }, { value: "more" }];
const VERBAL_OPTIONS = [
  { value: "less",  label: "Меньше" },
  { value: "equal", label: "Равно"  },
  { value: "more",  label: "Больше" },
];

function SignMode({ task, onCorrect, onIncorrect }) {
  const [answered,  setAnswered]  = useState(false);
  const [shakeSign, setShakeSign] = useState(null);
  const [verdict,   setVerdict]   = useState(null);

  const correct = task.left > task.right ? "more" : task.left < task.right ? "less" : "equal";

  function handleTap(value) {
    if (answered) return;
    if (value !== correct) {
      setShakeSign(value);
      setTimeout(() => setShakeSign(null), 400);
      setAnswered(true);
      onIncorrect(task.conceptId, null);
      return;
    }
    setAnswered(true);
    setVerdict(getVerdict(task));
    onCorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{task.instruction ?? "Поставь правильный знак между числами"}</div>
      <div className="croc-put-sign-numbers">
        <span className="croc-put-sign-num">{task.left}</span>
        <span className="croc-put-sign-blank">{answered ? SIGN_CHAR[correct] : "?"}</span>
        <span className="croc-put-sign-num">{task.right}</span>
      </div>
      <div className="croc-put-sign-btns">
        {SIGN_OPTIONS.map(({ value }) => (
          <button
            key={value}
            className={[
              "croc-put-sign-btn",
              shakeSign === value            && "croc-put-sign-btn--shake",
              answered && correct === value  && "croc-put-sign-btn--correct",
            ].filter(Boolean).join(" ")}
            disabled={answered}
            onClick={() => handleTap(value)}
          >
            {SIGN_CHAR[value]}
          </button>
        ))}
      </div>
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}

function VerbalSingle({ task, onCorrect, onIncorrect, onAdvance }) {
  const [answered, setAnswered] = useState(false);
  const showLabels = task.showLabels !== false;

  function handleAnswer(value) {
    if (answered) return;
    setAnswered(true);
    if (value === task.question) onCorrect(task.conceptId, null);
    else                         onIncorrect(task.conceptId, null);
  }

  const stage = (
    <div className="cfn-stage">
      <div className="cfn-card cfn-card--first">
        {showLabels && <div className="cfn-label">первое</div>}
        <div className="cfn-number">{task.left}</div>
      </div>
      <div className={`cfn-bridge${answered ? " cfn-bridge--shown" : ""}`}>
        {answered ? SIGN_CHAR[task.question] : "?"}
      </div>
      <div className="cfn-card cfn-card--second">
        {showLabels && <div className="cfn-label">второе</div>}
        <div className="cfn-number">{task.right}</div>
      </div>
    </div>
  );

  if (answered) {
    return (
      <button className="session-full-tap cfn-result-tap" onClick={(e) => { e.stopPropagation(); onAdvance(); }}>
        <div className="compare-instruction">Сравни первое число со вторым:</div>
        {stage}
        <div className="compare-verdict cfn-verdict-reveal">{getVerdict(task)}</div>
      </button>
    );
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">Сравни первое число со вторым:</div>
      {stage}
      <div className="cfn-multi-divider" />
      <div className="cfn-options">
        {VERBAL_OPTIONS.map((opt) => (
          <button key={opt.value} className="cfn-btn" onClick={() => handleAnswer(opt.value)}>
            <span className="cfn-btn-sign">{SIGN_CHAR[opt.value]}</span>
            <span className="cfn-btn-label">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function VerbalMulti({ task, onCorrect, onMistake, playFeedback }) {
  const items = task.items;
  const [answers,    setAnswers]    = useState(() => Array(items.length).fill(null));
  const [focusIndex, setFocusIndex] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(-1);
  const doneRef      = useRef(false);
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
      <div className="compare-instruction">Оцени первое число</div>
      <div className="cfn-multi">
        {items.map((item, i) => (
          <div key={i} className={`cfn-multi-row${focusIndex === i ? " cfn-multi-row--active" : ""}`}>
            <div className="cfn-multi-num">{item.left}</div>
            <div className={signClass(i)}>
              {answers[i] != null ? SIGN_CHAR[answers[i]] : focusIndex === i ? "?" : ""}
            </div>
            <div className="cfn-multi-num">{item.right}</div>
          </div>
        ))}
      </div>
      <div className="cfn-multi-divider" />
      <div className="cfn-options">
        {VERBAL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className="cfn-btn"
            disabled={focusIndex >= items.length}
            onClick={() => handleAnswer(opt.value)}
          >
            <span className="cfn-btn-sign">{SIGN_CHAR[opt.value]}</span>
            <span className="cfn-btn-label">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CompareEvaluate({ task, onCorrect, onIncorrect, onMistake, onAdvance, playFeedback }) {
  if (task.style === "verbal") {
    if (task.items) {
      return <VerbalMulti task={task} onCorrect={onCorrect} onMistake={onMistake} playFeedback={playFeedback} />;
    }
    return <VerbalSingle task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onAdvance={onAdvance} />;
  }
  return <SignMode task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
}
