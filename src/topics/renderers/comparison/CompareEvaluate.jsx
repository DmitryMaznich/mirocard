import { useState, useEffect, useRef } from "react";
import { getVerdict } from "./engine";

const SIGN_CHAR = { less: "<", equal: "=", more: ">" };
const OPTIONS = [
  { value: "less",  label: "Меньше" },
  { value: "equal", label: "Равно"  },
  { value: "more",  label: "Больше" },
];

function Buttons({ style, correct, answered, onAnswer }) {
  const [shake, setShake] = useState(null);

  function handle(value) {
    if (answered) return;
    if (value !== correct) {
      setShake(value);
      setTimeout(() => setShake(null), 400);
    }
    onAnswer(value);
  }

  if (style === "verbal") {
    return (
      <div className="cfn-options">
        {OPTIONS.map((opt) => (
          <button key={opt.value} className="cfn-btn" disabled={answered} onClick={() => handle(opt.value)}>
            <span className="cfn-btn-sign">{SIGN_CHAR[opt.value]}</span>
            <span className="cfn-btn-label">{opt.label}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="croc-put-sign-btns">
      {OPTIONS.map(({ value }) => (
        <button
          key={value}
          className={[
            "croc-put-sign-btn",
            shake === value && "croc-put-sign-btn--shake",
            answered && correct === value && "croc-put-sign-btn--correct",
          ].filter(Boolean).join(" ")}
          disabled={answered}
          onClick={() => handle(value)}
        >
          {SIGN_CHAR[value]}
        </button>
      ))}
    </div>
  );
}

function MultiButtons({ style, disabled, onAnswer }) {
  if (style === "verbal") {
    return (
      <div className="cfn-options">
        {OPTIONS.map((opt) => (
          <button key={opt.value} className="cfn-btn" disabled={disabled} onClick={() => onAnswer(opt.value)}>
            <span className="cfn-btn-sign">{SIGN_CHAR[opt.value]}</span>
            <span className="cfn-btn-label">{opt.label}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="croc-put-sign-btns">
      {OPTIONS.map(({ value }) => (
        <button key={value} className="croc-put-sign-btn" disabled={disabled} onClick={() => onAnswer(value)}>
          {SIGN_CHAR[value]}
        </button>
      ))}
    </div>
  );
}

function SingleMode({ task, onCorrect, onIncorrect, onAdvance }) {
  const [answered, setAnswered] = useState(false);
  const [verdict,  setVerdict]  = useState(null);

  const correct    = task.left > task.right ? "more" : task.left < task.right ? "less" : "equal";
  const showLabels = task.showLabels;
  const style      = task.style ?? "sign";
  const instruction = task.instruction ?? (
    showLabels ? "Сравни первое число со вторым:" : "Поставь правильный знак между числами"
  );

  function handleAnswer(value) {
    if (answered) return;
    setAnswered(true);
    if (value === correct) {
      setVerdict(getVerdict(task));
      onCorrect(task.conceptId, null);
    } else {
      onIncorrect(task.conceptId, null);
    }
  }

  const stage = showLabels ? (
    <div className="cfn-stage">
      <div className="cfn-card cfn-card--first">
        <div className="cfn-label">первое</div>
        <div className="cfn-number">{task.left}</div>
      </div>
      <div className={`cfn-bridge${answered ? " cfn-bridge--shown" : ""}`}>
        {answered ? SIGN_CHAR[correct] : "?"}
      </div>
      <div className="cfn-card cfn-card--second">
        <div className="cfn-label">второе</div>
        <div className="cfn-number">{task.right}</div>
      </div>
    </div>
  ) : (
    <div className="croc-put-sign-numbers">
      <span className="croc-put-sign-num">{task.left}</span>
      <span className="croc-put-sign-blank">{answered ? SIGN_CHAR[correct] : "?"}</span>
      <span className="croc-put-sign-num">{task.right}</span>
    </div>
  );

  if (answered && showLabels) {
    return (
      <button className="session-full-tap cfn-result-tap" onClick={(e) => { e.stopPropagation(); onAdvance(); }}>
        <div className="compare-instruction">{instruction}</div>
        {stage}
        <div className="compare-verdict cfn-verdict-reveal">{verdict}</div>
      </button>
    );
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{instruction}</div>
      {stage}
      <div className="cfn-multi-divider" />
      <Buttons style={style} correct={correct} answered={answered} onAnswer={handleAnswer} />
      {verdict && !showLabels && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}

function MultiMode({ task, onCorrect, onMistake, playFeedback }) {
  const items = task.items;
  const [answers,    setAnswers]    = useState(() => Array(items.length).fill(null));
  const [focusIndex, setFocusIndex] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(-1);
  const doneRef      = useRef(false);
  const onCorrectRef = useRef(onCorrect);
  useEffect(() => { onCorrectRef.current = onCorrect; });

  const style = task.style ?? "sign";

  function handleAnswer(value) {
    if (doneRef.current) return;
    const item = items[focusIndex];
    const correct = item.left > item.right ? "more" : item.left < item.right ? "less" : "equal";
    if (value !== correct) {
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
      <div className="compare-instruction">{task.instruction ?? "Поставь правильный знак между числами"}</div>
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
      <MultiButtons style={style} disabled={focusIndex >= items.length} onAnswer={handleAnswer} />
    </div>
  );
}

export default function CompareEvaluate({ task, onCorrect, onIncorrect, onMistake, onAdvance, playFeedback }) {
  if (task.items) {
    return <MultiMode task={task} onCorrect={onCorrect} onMistake={onMistake} playFeedback={playFeedback} />;
  }
  return <SingleMode task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onAdvance={onAdvance} />;
}
