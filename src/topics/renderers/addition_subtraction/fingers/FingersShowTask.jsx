import React, { useEffect, useState } from "react";
import AnimatedHand from "./AnimatedHand.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import { handPoseImage } from "./fingerTasks.js";
import { FingersKeypad } from "./FingersCountTask.jsx";
import { BackArrowIcon, ForwardArrowIcon } from "@/shared/components/ArrowIcons";
import "./fingers.css";

// The two hands as the child sees their own palms: the child's left hand on the
// left of the screen, the right one on the right. The drawings are palms of a
// left hand, so AnimatedHand's side="right" (not mirrored) is the child's LEFT hand
// and side="left" (mirrored) the child's RIGHT hand. The right hand fills first (1–5).
function ChildHands({ left, right, className = "fng-show-hands" }) {
  return (
    <div className={className}>
      <AnimatedHand count={left} side="right" style={{ flex: 1, minWidth: 0, height: "100%" }} />
      <AnimatedHand count={right} side="left" style={{ flex: 1, minWidth: 0, height: "100%" }} />
    </div>
  );
}

// «Пальцы → цифра» shows any fingers, not only the canonical pose, so its hands are
// the raster drawings (the vector AnimatedHand has the canonical poses only). Same
// sides as ChildHands: the drawing as is = the child's left hand, mirrored = right.
function PoseHands({ leftPose, rightPose }) {
  const base = import.meta.env?.BASE_URL ?? "/";
  return (
    <div className="fng-show-hands">
      <img className="fng-pose-hand" src={base + handPoseImage(leftPose)} alt="" draggable={false} />
      <img className="fng-pose-hand fng-pose-hand--mirror" src={base + handPoseImage(rightPose)} alt="" draggable={false} />
    </div>
  );
}

// «Обучение»: the number and its hands, «Назад» / «Следующая». Not scored.
function LearnTask({ task, hint, onCorrect, onPrevious }) {
  const { right, left } = getFingerConfig(task.n);
  return (
    <div className="fng-show-screen">
      <div className="fng-show-number-zone">
        <div className="fng-show-number">{task.n}</div>
      </div>
      {hint && <ChildHands left={left} right={right} />}
      <div className="fng-show-buttons">
        <button className="fng-show-btn fng-show-btn--prev" onClick={onPrevious}>
          <BackArrowIcon size={16} /> Назад
        </button>
        <button className="fng-show-btn fng-show-btn--next" onClick={() => onCorrect()}>
          Следующая <ForwardArrowIcon size={16} />
        </button>
      </div>
    </div>
  );
}

// «Цифра → пальцы»: only the number; the child shows it on their own hands and
// the adult marks it. «Не показал» opens the model hands first, so the child can
// copy it, and only «Дальше» moves on (the mistake is counted then).
function ShowCheckTask({ task, onCorrect, onIncorrect }) {
  const [missed, setMissed] = useState(false);
  useEffect(() => { setMissed(false); }, [task.cardId]);
  const { right, left } = getFingerConfig(task.n);
  return (
    <div className="fng-show-screen">
      <div className={`fng-show-number-zone${missed ? "" : " fng-show-number-zone--alone"}`}>
        <div className="fng-show-number">{task.n}</div>
      </div>
      {missed && <ChildHands left={left} right={right} />}
      <div className="fng-show-buttons">
        {missed ? (
          <button className="fng-show-btn fng-show-btn--next" onClick={() => onIncorrect(task.conceptId, task.cardId)}>
            Дальше <ForwardArrowIcon size={16} />
          </button>
        ) : (
          <>
            <button className="fng-show-btn fng-show-btn--miss" onClick={() => setMissed(true)}>
              ✗ Не показал
            </button>
            <button className="fng-show-btn fng-show-btn--next" onClick={() => onCorrect(task.conceptId, task.cardId)}>
              ✓ Показал
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// «Пальцы → цифра»: hands in one of the splits of n (task.left / task.right),
// the child types the number. A wrong number shakes and clears; the task stays.
function RecognizeTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { setInput([]); setShake(false); setDone(false); }, [task.cardId, task.n]);
  const answer = String(task.n);

  function handleDigit(d) {
    if (done || shake) return;
    const next = [...input, String(d)];
    if (next.length < answer.length) { setInput(next); return; }
    if (next.join("") === answer) {
      setInput(next);
      setDone(true);
      setTimeout(() => onCorrect(task.conceptId, task.cardId), 700);
    } else {
      setInput(next);
      setShake(true);
      setTimeout(() => { setShake(false); setInput([]); }, 500);
      onMistake?.(task.conceptId, task.cardId);
      onFlashIncorrect?.();
    }
  }

  function handleDelete() { if (!shake && !done) setInput(p => p.slice(0, -1)); }

  const shown = input.length ? input.join("") : "?";
  return (
    <div className="fng-show-screen">
      <div className="fng-show-number-zone fng-show-number-zone--answer">
        <div className={`fng-show-number fng-show-answer${done ? " fng-count-answer--correct" : shake ? " fng-count-answer--shake" : input.length ? " fng-count-answer" : " fng-show-answer--empty"}`}>
          {shown}
        </div>
      </div>
      {task.leftPose !== undefined
        ? <PoseHands leftPose={task.leftPose} rightPose={task.rightPose} />
        : <ChildHands left={task.left ?? 0} right={task.right ?? 0} />}
      <div className="fng-add-kbd-zone">
        <FingersKeypad onDigit={handleDigit} onDelete={handleDelete} active={!done} />
      </div>
    </div>
  );
}

export default function FingersShowTask({ task, sessionParams, onCorrect, onIncorrect, onMistake, onFlashIncorrect, onPrevious }) {
  const variant = task.variant ?? "learn";
  if (variant === "show") return <ShowCheckTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
  if (variant === "recognize") {
    return <RecognizeTask task={task} onCorrect={onCorrect} onMistake={onMistake} onFlashIncorrect={onFlashIncorrect} />;
  }
  return <LearnTask task={task} hint={sessionParams?.hint !== false} onCorrect={onCorrect} onPrevious={onPrevious} />;
}
