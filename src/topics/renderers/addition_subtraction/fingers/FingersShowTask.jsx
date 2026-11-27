import React, { useEffect, useState } from "react";
import AnimatedHand from "./AnimatedHand.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import { handPoseImage } from "./fingerTasks.js";
import { ChecklistItem, FingersKeypad, HandArrows } from "./FingersCountTask.jsx";
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

// «Цифра → пальцы»: the number and two fists with ▲ / ▼ arrows (the build step of
// «Считаем на пальцах»). The child raises fingers on either hand; any split that
// adds up to n is right (5 + 2, 4 + 3 …) — checked by a tap on «Покажи n». A wrong
// check shakes, resets to fists and costs the star series; after the second one the
// canonical pose is shown under the hands as a model (owner, 2026-11-27). Whether
// the child also shows it on their own hands is the adult's business.
const MODEL_AFTER_MISTAKES = 2;

function ShowCheckTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    setLeft(0); setRight(0); setMistakes(0); setShake(false); setDone(false);
  }, [task.cardId, task.n]);

  function confirm() {
    if (done || shake) return;
    if (left + right === task.n) {
      setDone(true);
      setTimeout(() => onCorrect(task.conceptId, task.cardId), 700);
      return;
    }
    setShake(true);
    setMistakes(m => m + 1);
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => { setShake(false); setLeft(0); setRight(0); }, 500);
  }

  const showModel = mistakes >= MODEL_AFTER_MISTAKES && !done;
  const model = getFingerConfig(task.n);
  const arrows = !done && !shake;
  return (
    <div className="fng-add-screen fng-show-check">
      <div className="fng-add-top">
        <div className={`fng-count-expr${done ? " fng-count-answer--correct" : ""}`}>{task.n}</div>
      </div>
      <div className="fng-checklist">
        <ChecklistItem
          text={`Покажи ${task.n}`}
          state={done ? "done" : shake ? "wrong" : "active"}
          onTap={confirm}
        />
      </div>
      <div className="fng-add-hands-zone">
        <div className="fng-sub-hands">
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={left} side="right" style={{ width: "100%", height: "100%" }} />
              {arrows && <HandArrows count={left} onRaise={() => setLeft(c => Math.min(5, c + 1))} onLower={() => setLeft(c => Math.max(0, c - 1))} />}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={right} side="left" style={{ width: "100%", height: "100%" }} />
              {arrows && <HandArrows count={right} onRaise={() => setRight(c => Math.min(5, c + 1))} onLower={() => setRight(c => Math.max(0, c - 1))} />}
            </div>
          </div>
        </div>
      </div>
      <div className={`fng-show-model${showModel ? " is-visible" : ""}`} aria-hidden={!showModel}>
        {showModel && <ChildHands left={model.left} right={model.right} className="fng-show-model-hands" />}
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

export default function FingersShowTask({ task, sessionParams, onCorrect, onMistake, onFlashIncorrect, onPrevious }) {
  const variant = task.variant ?? "learn";
  if (variant === "show") {
    return <ShowCheckTask task={task} onCorrect={onCorrect} onMistake={onMistake} onFlashIncorrect={onFlashIncorrect} />;
  }
  if (variant === "recognize") {
    return <RecognizeTask task={task} onCorrect={onCorrect} onMistake={onMistake} onFlashIncorrect={onFlashIncorrect} />;
  }
  return <LearnTask task={task} hint={sessionParams?.hint !== false} onCorrect={onCorrect} onPrevious={onPrevious} />;
}
