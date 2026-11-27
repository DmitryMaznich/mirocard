import React, { useEffect, useState } from "react";
import AnimatedHand from "./AnimatedHand.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import { canToggleFinger, handPoseImage, poseFromFingers } from "./fingerTasks.js";
import { ChecklistItem, FingersKeypad } from "./FingersCountTask.jsx";
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

// «Цифра → пальцы»: the number and two fists; under each hand a row of five dots,
// one per finger in the order the fingers stand in the drawing (the child's left
// hand: thumb … pinky from the left; the right hand, mirrored: pinky … thumb). A dot
// is green ▲ while its finger is down (tap = raise it) and red ▼ while it is up
// (tap = fold it) — owner, 2026-11-27: a row under the wrist, not dots on the fingers.
// Only 14 of the 32 finger sets are drawn (the model cannot draw «ring finger alone»),
// so a dot works only when the tap leads to a drawn pose; the others are pale grey.
// Any fingers that add up to n are right; the check is a tap on «Покажи n». A wrong
// check shakes, folds everything and costs the star series; after the second one the
// canonical pose is shown as a model. Whether the child also shows it on their own
// hands is the adult's business.
const MODEL_AFTER_MISTAKES = 2;
const DOTS_LEFT_HAND = ["t", "i", "m", "r", "p"];
const DOTS_RIGHT_HAND = ["p", "r", "m", "i", "t"];

function FingerDots({ order, raised, onToggle, disabled }) {
  return (
    <div className="fng-finger-dots">
      {order.map((f) => {
        const up = raised.includes(f);
        const blocked = !canToggleFinger(raised, f);
        return (
          <button
            key={f}
            type="button"
            className={`fng-finger-dot${up ? " is-up" : ""}${blocked ? " is-blocked" : ""}`}
            disabled={disabled || blocked}
            onClick={() => onToggle(f)}
            aria-label={up ? "Опустить палец" : "Поднять палец"}
          >
            {up ? "▼" : "▲"}
          </button>
        );
      })}
    </div>
  );
}

function TapHand({ pose, mirror, order, onToggle, disabled }) {
  const base = import.meta.env?.BASE_URL ?? "/";
  return (
    <div className="fng-tap-hand">
      <img
        className={`fng-tap-hand__img${mirror ? " fng-pose-hand--mirror" : ""}`}
        src={base + handPoseImage(pose)}
        alt=""
        draggable={false}
      />
      <FingerDots order={order} raised={pose} onToggle={onToggle} disabled={disabled} />
    </div>
  );
}

function toggleFinger(pose, f) {
  return poseFromFingers(pose.includes(f) ? pose.replace(f, "") : pose + f);
}

function ShowCheckTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    setLeft(""); setRight(""); setMistakes(0); setShake(false); setDone(false);
  }, [task.cardId, task.n]);

  function confirm() {
    if (done || shake) return;
    if (left.length + right.length === task.n) {
      setDone(true);
      setTimeout(() => onCorrect(task.conceptId, task.cardId), 700);
      return;
    }
    setShake(true);
    setMistakes(m => m + 1);
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => { setShake(false); setLeft(""); setRight(""); }, 500);
  }

  const showModel = mistakes >= MODEL_AFTER_MISTAKES && !done;
  const model = getFingerConfig(task.n);
  const locked = done || shake;
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
      <div className={`fng-tap-hands${shake ? " is-shaking" : ""}`}>
        <TapHand pose={left} order={DOTS_LEFT_HAND} onToggle={f => setLeft(p => toggleFinger(p, f))} disabled={locked} />
        <TapHand pose={right} mirror order={DOTS_RIGHT_HAND} onToggle={f => setRight(p => toggleFinger(p, f))} disabled={locked} />
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
