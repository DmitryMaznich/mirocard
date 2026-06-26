import React, { useState, useEffect, useCallback } from "react";
import HandImg from "./HandImg.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import "./fingers.css";

// ── Addition ──────────────────────────────────────────────────────────────────

function AdditionTask({ task, onCorrect }) {
  const [phase, setPhase]       = useState("left");
  const [leftSolid, setLeftSolid]   = useState(0);
  const [rightSolid, setRightSolid] = useState(0);
  const [countIdx, setCountIdx] = useState(-1);
  const [merging, setMerging]   = useState(false);

  const { a, b, result } = task;

  useEffect(() => {
    setPhase("left");
    setLeftSolid(0);
    setRightSolid(0);
    setCountIdx(-1);
    setMerging(false);
  }, [task.cardId]);

  const handleTap = useCallback(() => {
    if (phase === "left") {
      const next = leftSolid + 1;
      setLeftSolid(next);
      if (next >= a) setPhase("right");
    } else if (phase === "right") {
      const next = rightSolid + 1;
      setRightSolid(next);
      if (next >= b) setPhase("merge");
    }
  }, [phase, leftSolid, rightSolid, a, b]);

  const handleMerge = useCallback(() => {
    setMerging(true);
    setPhase("counting");
    setTimeout(() => setCountIdx(0), 700);
  }, []);

  useEffect(() => {
    if (countIdx < 0 || countIdx >= result) return;
    const t = setTimeout(() => {
      const next = countIdx + 1;
      setCountIdx(next);
      if (next >= result) setPhase("done");
    }, 400);
    return () => clearTimeout(t);
  }, [countIdx, result]);

  const instruction =
    phase === "left"    ? `Подними ${a} пальца${a === 1 ? "" : "х"} левой руки` :
    phase === "right"   ? `Подними ${b} пальца${b === 1 ? "" : "х"} правой руки` :
    phase === "merge"   ? "Соединяем руки!" :
    phase === "counting"? "Посчитай все пальцы!" : "";

  return (
    <div className="fng-screen">
      <div className="fng-expression">
        {a} + {b} ={" "}
        {phase === "done"
          ? <span className="fng-result-number">{result}</span>
          : "?"}
      </div>

      <div className={merging ? "fng-hands-merge" : "fng-hands-row"}>
        <div className={merging ? "fng-hand-merging-left" : ""}>
          <HandImg
            count={leftSolid}
            ghost={phase === "left" && leftSolid > 0 ? a - leftSolid : 0}
            side="right"
                     />
        </div>
        <div className={merging ? "fng-hand-merging-right" : ""}>
          <HandImg
            count={rightSolid}
            ghost={phase === "right" && rightSolid > 0 ? b - rightSolid : 0}
            side="left"
                     />
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

      {phase !== "done" && (
        <div className="fng-instruction">{instruction}</div>
      )}

      {(phase === "left" || phase === "right") && (
        <div className="fng-count-dots">
          {Array.from({ length: phase === "left" ? a : b }, (_, i) => (
            <div
              key={i}
              className={`fng-dot ${
                (phase === "left" && i < leftSolid) ||
                (phase === "right" && i < rightSolid)
                  ? "fng-dot--filled" : ""
              }`}
            />
          ))}
        </div>
      )}

      {phase === "merge" && (
        <button className="fng-btn fng-btn--merge" onClick={handleMerge}>
          Соединяем →
        </button>
      )}

      {(phase === "left" || phase === "right") && (
        <button className="fng-btn fng-btn--tap" onClick={handleTap}>
          тап
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

  // Compute displayed finger counts during remove phase
  let leftCount  = startConfig.left;
  let rightCount = startConfig.right;

  if (phase === "remove" || phase === "counting" || phase === "done") {
    if (removeMode === "fold") {
      // Fold from the larger hand
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
          тап
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
