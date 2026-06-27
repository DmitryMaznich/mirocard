import React, { useState, useEffect, useCallback } from "react";
import HandImg from "./HandImg.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import "./fingers.css";

// ── Addition ──────────────────────────────────────────────────────────────────

function AdditionTask({ task, onCorrect }) {
  const [phase, setPhase]           = useState("left");
  const [leftSolid, setLeftSolid]   = useState(0);
  const [rightSolid, setRightSolid] = useState(0);
  const [input, setInput]           = useState([]);
  const [shake, setShake]           = useState(false);

  const { a, b, result } = task;
  const resultStr = String(result);

  useEffect(() => {
    setPhase("left");
    setLeftSolid(0);
    setRightSolid(0);
    setInput([]);
    setShake(false);
  }, [task.cardId]);

  // Auto-animate left hand — one finger every 450 ms; advance when done
  useEffect(() => {
    if (phase !== "left") return;
    if (leftSolid >= a) {
      const t = setTimeout(() => setPhase("right"), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLeftSolid(n => n + 1), 450);
    return () => clearTimeout(t);
  }, [phase, leftSolid, a]);

  // Auto-animate right hand
  useEffect(() => {
    if (phase !== "right") return;
    if (rightSolid >= b) {
      const t = setTimeout(() => setPhase("answer"), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRightSolid(n => n + 1), 450);
    return () => clearTimeout(t);
  }, [phase, rightSolid, b]);

  function handleDigit(d) {
    if (phase !== "answer" || shake) return;
    const next = [...input, String(d)];
    if (next.length < resultStr.length) {
      setInput(next);
      return;
    }
    if (Number(next.join("")) === result) {
      setPhase("done");
      setTimeout(() => onCorrect(), 700);
    } else {
      setShake(true);
      setTimeout(() => { setShake(false); setInput([]); }, 500);
    }
  }

  function handleDelete() {
    if (shake) return;
    setInput(p => p.slice(0, -1));
  }

  const showLeft  = (phase === "answer" || phase === "done") ? a : leftSolid;
  const showRight = (phase === "answer" || phase === "done") ? b : rightSolid;

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  return (
    <div className="fng-count-screen">
      <div className="fng-count-expr">
        {a} + {b} = {answerPart}
      </div>

      <div className="fng-count-hands">
        <HandImg count={showLeft}  side="right" style={{ flex: 1, minWidth: 0, height: "100%" }} />
        <HandImg count={showRight} side="left"  style={{ flex: 1, minWidth: 0, height: "100%" }} />
      </div>

      <div className="col-copy-keyboard"
           style={{ visibility: phase === "answer" ? "visible" : "hidden",
                    pointerEvents: phase === "answer" ? "auto" : "none" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
          <button key={d} className="col-copy-kb-btn" onClick={() => handleDigit(d)}>
            <span className="col-slant">{d}</span>
          </button>
        ))}
        <button className="col-copy-kb-btn col-copy-kb-del" onClick={handleDelete}>⌫</button>
        <button className="col-copy-kb-btn" onClick={() => handleDigit(0)}>
          <span className="col-slant">0</span>
        </button>
        <div />
      </div>
    </div>
  );
}

// ── Subtraction ───────────────────────────────────────────────────────────────

function SubtractionTask({ task, onCorrect }) {
  const [phase, setPhase]       = useState("show");
  const [foldsDone, setFolds]   = useState(0);
  const [countIdx, setCountIdx] = useState(-1);
  const [handRemoved, setHandRemoved] = useState(false);

  const { a, b, result, removeMode, removeHand } = task;
  const startConfig  = getFingerConfig(a);
  const resultConfig = getFingerConfig(result);

  useEffect(() => {
    setPhase("show");
    setFolds(0);
    setCountIdx(-1);
    setHandRemoved(false);
  }, [task.cardId]);

  function startCounting() {
    setPhase("counting");
    setCountIdx(0);
  }

  const handleReady = () => setPhase("remove");

  const handleRemoveHand = useCallback(() => {
    setHandRemoved(true);
    setTimeout(startCounting, 600);
  }, []);

  const handleFold = useCallback(() => {
    const next = foldsDone + 1;
    setFolds(next);
    if (next >= b) setTimeout(startCounting, 300);
  }, [foldsDone, b]);

  useEffect(() => {
    if (countIdx < 0 || countIdx >= result) return;
    const t = setTimeout(() => {
      const next = countIdx + 1;
      setCountIdx(next);
      if (next >= result) setPhase("done");
    }, 400);
    return () => clearTimeout(t);
  }, [countIdx, result]);

  let leftCount  = startConfig.left;
  let rightCount = startConfig.right;

  if (phase === "remove" || phase === "counting" || phase === "done") {
    if (removeMode === "fold") {
      if (startConfig.right >= startConfig.left) {
        rightCount = Math.max(startConfig.right - foldsDone, 0);
      } else {
        leftCount = Math.max(startConfig.left - foldsDone, 0);
      }
    } else if (removeMode === "hand" && handRemoved) {
      leftCount  = resultConfig.left;
      rightCount = resultConfig.right;
    }
  }

  const isRemovingLeft  = phase === "remove" && removeMode === "hand" && removeHand === "left";
  const isRemovingRight = phase === "remove" && removeMode === "hand" && removeHand === "right";

  const instruction =
    phase === "show"  ? `Вот ${a} пальцев. Убираем ${b}.` :
    phase === "remove" && removeMode === "hand"
      ? `Убери ${removeHand === "left" ? "левую" : "правую"} руку!` :
    phase === "remove" && removeMode === "fold"
      ? `Загни ${b - foldsDone} палец${b - foldsDone === 1 ? "" : "а"}` :
    phase === "counting" ? "Сколько осталось? Посчитай!" : "";

  return (
    <div className="fng-screen">
      <div className="fng-expression">
        {a} − {b} ={" "}
        {phase === "done"
          ? <span className="fng-result-number">{result}</span>
          : "?"}
      </div>

      <div className="fng-hands-row">
        <div className={
          isRemovingLeft && !handRemoved ? "fng-hand--remove" :
          isRemovingLeft && handRemoved  ? "fng-hand--removed" : ""
        }>
          <HandImg count={leftCount} side="right" animated />
        </div>
        <div className={
          isRemovingRight && !handRemoved ? "fng-hand--remove" :
          isRemovingRight && handRemoved  ? "fng-hand--removed" : ""
        }>
          <HandImg count={rightCount} side="left" animated />
        </div>
      </div>

      {(phase === "counting" || phase === "done") && result > 0 && (
        <div className="fng-count-seq">
          {Array.from({ length: result }, (_, i) => (
            <span
              key={i}
              className={
                i < countIdx ? "fng-count--done" :
                i === countIdx ? "fng-count--active" : ""
              }
            >
              {i + 1}
            </span>
          ))}
        </div>
      )}

      {phase !== "done" && <div className="fng-instruction">{instruction}</div>}

      {phase === "show" && (
        <button className="fng-btn fng-btn--next" onClick={handleReady}>
          Готов
        </button>
      )}

      {phase === "remove" && removeMode === "hand" && !handRemoved && (
        <button className="fng-btn fng-btn--tap" onClick={handleRemoveHand}>
          убрать руку
        </button>
      )}

      {phase === "remove" && removeMode === "fold" && foldsDone < b && (
        <button className="fng-btn fng-btn--tap" onClick={handleFold}>
          загнуть
        </button>
      )}

      {phase === "done" && (
        <button className="fng-btn fng-btn--next" onClick={onCorrect}>
          → Следующая
        </button>
      )}
    </div>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default function FingersCountTask({ task, onCorrect }) {
  if (task.op === "sub") {
    return <SubtractionTask task={task} onCorrect={onCorrect} />;
  }
  return <AdditionTask task={task} onCorrect={onCorrect} />;
}
