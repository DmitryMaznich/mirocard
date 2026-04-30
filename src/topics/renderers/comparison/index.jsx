import { useState } from "react";

function CrocSign({ state = "closed" }) {
  const isEqual    = state === "equal";
  const openRight  = state === "open-right";
  const topAngle   = openRight ? -28 : (state === "open-left" ? 28 : 0);
  const botAngle   = openRight ?  28 : (state === "open-left" ? -28 : 0);
  const topShift   = isEqual ? -5 : 0;
  const botShift   = isEqual ?  5 : 0;
  const flipX      = state === "open-left" ? "scaleX(-1)" : "";

  return (
    <svg
      viewBox="0 0 80 80"
      width={64}
      height={64}
      style={{ transform: flipX, transition: "transform 0.1s" }}
    >
      <g style={{ transform: `rotate(${topAngle}deg) translateY(${topShift}px)`, transformOrigin: "20px 40px", transition: "transform 0.5s cubic-bezier(0.34,1.3,0.64,1)" }}>
        <rect x="10" y="28" width="60" height="14" rx="3" fill="#66bb6a" />
        {[20, 32, 44, 56].map((x) => (
          <polygon key={x} points={`${x},42 ${x+5},42 ${x+2.5},48`} fill="#fff" />
        ))}
        <circle cx="24" cy="26" r="4" fill="#fff" />
        <circle cx="24" cy="26" r="2" fill="#333" />
        <circle cx="34" cy="26" r="4" fill="#fff" />
        <circle cx="34" cy="26" r="2" fill="#333" />
      </g>
      <g style={{ transform: `rotate(${botAngle}deg) translateY(${botShift}px)`, transformOrigin: "20px 40px", transition: "transform 0.5s cubic-bezier(0.34,1.3,0.64,1)" }}>
        <rect x="10" y="40" width="60" height="14" rx="3" fill="#43a047" />
        {[20, 32, 44, 56].map((x) => (
          <polygon key={x} points={`${x},40 ${x+5},40 ${x+2.5},34`} fill="#fff" />
        ))}
      </g>
    </svg>
  );
}

function DotGroup({ count, color }) {
  return (
    <div className="dot-group">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="dot" style={{ background: color }} />
      ))}
    </div>
  );
}

function CompareVisual({ task, onCorrect, onIncorrect }) {
  const leftBigger = task.left > task.right;
  return (
    <div className="compare-body">
      <div className="compare-instruction">Где больше?</div>
      <div className="compare-sides">
        <button className="compare-side" onClick={() => leftBigger ? onCorrect(task.conceptId, null) : onIncorrect(task.conceptId, null)}>
          <DotGroup count={task.left} color="#4299e1" />
        </button>
        <button className="compare-side" onClick={() => !leftBigger ? onCorrect(task.conceptId, null) : onIncorrect(task.conceptId, null)}>
          <DotGroup count={task.right} color="#fc8181" />
        </button>
      </div>
    </div>
  );
}

function CompareWithNumber({ task, onCorrect, onIncorrect }) {
  const leftBigger = task.left > task.right;
  return (
    <div className="compare-body">
      <div className="compare-instruction">Где больше? Нажми на число</div>
      <div className="compare-sides">
        <button className="compare-side" onClick={() => leftBigger ? onCorrect(task.conceptId, null) : onIncorrect(task.conceptId, null)}>
          <DotGroup count={task.left} color="#4299e1" />
          <div className="compare-number">{task.left}</div>
        </button>
        <button className="compare-side" onClick={() => !leftBigger ? onCorrect(task.conceptId, null) : onIncorrect(task.conceptId, null)}>
          <DotGroup count={task.right} color="#fc8181" />
          <div className="compare-number">{task.right}</div>
        </button>
      </div>
    </div>
  );
}

function CompareNumbers({ task, onCorrect, onIncorrect }) {
  const [showHints, setShowHints] = useState(false);
  const leftBigger = task.left > task.right;

  function handleAnswer(pickedLeft) {
    const correct = leftBigger === pickedLeft;
    if (!correct) {
      setShowHints(true);
      setTimeout(() => setShowHints(false), 1500);
      onIncorrect(task.conceptId, null);
    } else {
      onCorrect(task.conceptId, null);
    }
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">Какое число больше?</div>
      <div className="compare-sides">
        <button className="compare-side compare-side--number" onClick={() => handleAnswer(true)}>
          <div className="compare-big-number">{task.left}</div>
          {showHints && <DotGroup count={task.left} color="#4299e1" />}
        </button>
        <button className="compare-side compare-side--number" onClick={() => handleAnswer(false)}>
          <div className="compare-big-number">{task.right}</div>
          {showHints && <DotGroup count={task.right} color="#fc8181" />}
        </button>
      </div>
    </div>
  );
}

function CompareSign({ task, onCorrect, onIncorrect }) {
  const [crocState, setCrocState] = useState("closed");
  const [signText, setSignText]   = useState(null);
  const leftBigger = task.left > task.right;

  function handleAnswer(pickedLeft) {
    const correct = leftBigger === pickedLeft;
    if (!correct) { onIncorrect(task.conceptId, null); return; }
    const newState = pickedLeft ? "open-right" : "open-left";
    setCrocState(newState);
    setTimeout(() => setSignText(pickedLeft ? ">" : "<"), 400);
    onCorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">Какое число больше?</div>
      <div className="compare-sign-row">
        <button className="compare-side compare-side--number" onClick={() => handleAnswer(true)}>
          <div className="compare-big-number">{task.left}</div>
        </button>
        <div className="compare-croc-area">
          <CrocSign state={crocState} />
          {signText && <div className="compare-sign-text">{signText}</div>}
        </div>
        <button className="compare-side compare-side--number" onClick={() => handleAnswer(false)}>
          <div className="compare-big-number">{task.right}</div>
        </button>
      </div>
    </div>
  );
}

function CompareEqual({ task, onCorrect, onIncorrect }) {
  const [crocState, setCrocState] = useState("closed");
  const [signText, setSignText]   = useState(null);
  const isEqual    = task.left === task.right;
  const leftBigger = task.left > task.right;

  function handleNumberTap(pickedLeft) {
    if (isEqual) { onIncorrect(task.conceptId, null); return; }
    const correct = leftBigger === pickedLeft;
    if (!correct) { onIncorrect(task.conceptId, null); return; }
    const newState = pickedLeft ? "open-right" : "open-left";
    setCrocState(newState);
    setTimeout(() => setSignText(pickedLeft ? ">" : "<"), 400);
    onCorrect(task.conceptId, null);
  }

  function handleEqualTap() {
    if (!isEqual) { onIncorrect(task.conceptId, null); return; }
    setCrocState("equal");
    setSignText("=");
    onCorrect(task.conceptId, null);
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">Какое больше? Или одинаковые?</div>
      <div className="compare-sign-row">
        <button className="compare-side compare-side--number" onClick={() => handleNumberTap(true)}>
          <div className="compare-big-number">{task.left}</div>
        </button>
        <div className="compare-croc-area">
          <CrocSign state={crocState} />
          {signText && <div className="compare-sign-text">{signText}</div>}
          <button className="compare-equal-btn" onClick={handleEqualTap}>=</button>
        </div>
        <button className="compare-side compare-side--number" onClick={() => handleNumberTap(false)}>
          <div className="compare-big-number">{task.right}</div>
        </button>
      </div>
    </div>
  );
}

const TYPE_MAP = {
  compare_visual:      CompareVisual,
  compare_with_number: CompareWithNumber,
  compare_numbers:     CompareNumbers,
  compare_sign:        CompareSign,
  compare_equal:       CompareEqual,
};

export default function ComparisonRenderer({ task, topicId, onCorrect, onIncorrect, onAdvance }) {
  const Comp = TYPE_MAP[task?.type];
  if (!Comp) return <div className="session-body">Неизвестный режим: {task?.type}</div>;
  return <Comp task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onAdvance={onAdvance} />;
}
