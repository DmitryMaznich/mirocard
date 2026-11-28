import React, { useEffect, useRef, useState } from "react";
import AnimatedHand from "./AnimatedHand.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import { handPoseImage } from "./fingerTasks.js";
import { CounterHand } from "./FingersCountTask.jsx";
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

// «Цифра → пальцы»: the number and two fists; under each wrist a pair of buttons,
// red ▼ (fold a finger) and green ▲ (raise one) — the counter of «Считаем на пальцах»,
// moved off the palm to a row under the hand (owner, 2026-11-28). Fingers go up in the
// usual order (index … pinky, then thumb): any finger set was tried and dropped — most
// sets can't be shown by a real hand, and only 14 could be drawn. Any split of n over
// the two hands is right (5 + 2, 4 + 3 …); the check is a tap on «Покажи n». A wrong
// check shakes, folds all and costs the star series; after the second one the
// canonical pose is shown for 3 seconds as a model. Whether the child also shows it on their own
// hands is the adult's business.
const MODEL_AFTER_MISTAKES = 2;
// The model is a fading prompt: shown for a moment after the 2nd wrong check (and after
// every one after it), then hidden — the child sets the pose from memory, not by copying
// a picture that stays on screen (owner, 2026-11-28).
const MODEL_SHOW_MS = 3000;

// Layout (owner, 2026-11-28): the bold instruction «Покажи на пальцах» on top, the number
// in the app's print font (Nunito) — the form the child reads in books and on screens —,
// the hands, and a «Готово» button at the bottom. A right answer does not move on by
// itself: the number turns green, the button becomes «Дальше», and that tap moves on
// (the answer is counted then). The model appears beside the number.
function ShowCheckTask({ task, onCorrect, onMistake, onFlashIncorrect, playFeedback }) {
  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const [modelVisible, setModelVisible] = useState(false);
  const modelTimer = useRef(null);
  useEffect(() => {
    setLeft(0); setRight(0); setMistakes(0); setShake(false); setDone(false); setModelVisible(false);
    clearTimeout(modelTimer.current);
  }, [task.cardId, task.n]);
  useEffect(() => () => clearTimeout(modelTimer.current), []);

  function flashModel() {
    clearTimeout(modelTimer.current);
    setModelVisible(true);
    modelTimer.current = setTimeout(() => setModelVisible(false), MODEL_SHOW_MS);
  }

  function check() {
    if (shake) return;
    if (done) { onCorrect(task.conceptId, task.cardId); return; }
    if (left + right === task.n) {
      setDone(true);
      setModelVisible(false);
      playFeedback?.("correct");
      return;
    }
    setShake(true);
    const count = mistakes + 1;
    setMistakes(count);
    if (count >= MODEL_AFTER_MISTAKES) flashModel();
    playFeedback?.("incorrect");
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => { setShake(false); setLeft(0); setRight(0); }, 500);
  }

  const showModel = modelVisible && !done;
  const model = getFingerConfig(task.n);
  const locked = done || shake;
  return (
    <div className="fng-show-check">
      <div className="fng-show-title">Покажи на пальцах</div>
      <div className="fng-show-top">
        <div className={`fng-show-print-number${done ? " is-done" : ""}`}>{task.n}</div>
        {showModel && <ChildHands left={model.left} right={model.right} className="fng-show-model-hands" />}
      </div>
      <div className={`fng-tap-hands${shake ? " is-shaking" : ""}`}>
        <CounterHand count={left} side="right" disabled={locked} onRaise={() => setLeft(c => Math.min(5, c + 1))} onLower={() => setLeft(c => Math.max(0, c - 1))} />
        <CounterHand count={right} side="left" disabled={locked} onRaise={() => setRight(c => Math.min(5, c + 1))} onLower={() => setRight(c => Math.max(0, c - 1))} />
      </div>
      <div className="fng-show-done-row">
        <button
          type="button"
          className={`fng-done-btn${done ? " is-next" : ""}${shake ? " is-wrong" : ""}`}
          onClick={check}
        >
          {done ? <>Дальше <ForwardArrowIcon size={18} /></> : "Готово"}
        </button>
      </div>
    </div>
  );
}

// «Пальцы → цифра» (owner, 2026-11-28 — same layout as «Цифра → пальцы»): the bold
// question «Сколько пальцев?», the answer field, the two hands (a split of n, the fingers
// of each hand drawn at random from the checked drawings), the topic's keypad in print
// digits, «Готово» at the bottom. Checked on «Готово» only (an automatic check after the
// last digit gave away that 10 has two digits). Wrong: the field shakes and clears,
// the star series resets, the task stays. Right: the field turns green, «Готово» becomes
// «Дальше», and that tap moves on (the answer is counted then).
const RECOGNIZE_MAX_DIGITS = 2;

function PrintKeypad({ onDigit, onBackspace, disabled }) {
  return (
    <div className="fng-keypad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
        <button key={d} type="button" className="fng-key" disabled={disabled} onClick={() => onDigit(d)}>{d}</button>
      ))}
      <button type="button" className="fng-key fng-key--erase" disabled={disabled} onClick={onBackspace} aria-label="Стереть">⌫</button>
    </div>
  );
}

function RecognizeTask({ task, onCorrect, onMistake, onFlashIncorrect, playFeedback }) {
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { setInput(""); setShake(false); setDone(false); }, [task.cardId, task.n]);

  function addDigit(d) {
    if (done || shake) return;
    setInput(v => (v.length >= RECOGNIZE_MAX_DIGITS ? v : v === "0" ? String(d) : v + d));
  }
  function erase() { if (!done && !shake) setInput(v => v.slice(0, -1)); }

  function check() {
    if (shake) return;
    if (done) { onCorrect(task.conceptId, task.cardId); return; }
    if (!input) return;
    if (Number(input) === task.n) {
      setDone(true);
      playFeedback?.("correct");
      return;
    }
    setShake(true);
    playFeedback?.("incorrect");
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => { setShake(false); setInput(""); }, 500);
  }

  return (
    <div className="fng-show-check fng-recognize">
      <div className="fng-show-title">Сколько пальцев?</div>
      <div className={`fng-answer-box${done ? " is-done" : ""}${shake ? " is-wrong" : ""}${input ? "" : " is-empty"}`}>
        {input}
      </div>
      <PoseHands leftPose={task.leftPose ?? ""} rightPose={task.rightPose ?? ""} />
      <PrintKeypad onDigit={addDigit} onBackspace={erase} disabled={done || shake} />
      <div className="fng-show-done-row">
        <button
          type="button"
          className={`fng-done-btn${done ? " is-next" : ""}${shake ? " is-wrong" : ""}`}
          disabled={!done && !input}
          onClick={check}
        >
          {done ? <>Дальше <ForwardArrowIcon size={18} /></> : "Готово"}
        </button>
      </div>
    </div>
  );
}

export default function FingersShowTask({ task, sessionParams, onCorrect, onMistake, onFlashIncorrect, onPrevious, playFeedback }) {
  const variant = task.variant ?? "learn";
  if (variant === "show") {
    return <ShowCheckTask task={task} onCorrect={onCorrect} onMistake={onMistake} onFlashIncorrect={onFlashIncorrect} playFeedback={playFeedback} />;
  }
  if (variant === "recognize") {
    return <RecognizeTask task={task} onCorrect={onCorrect} onMistake={onMistake} onFlashIncorrect={onFlashIncorrect} playFeedback={playFeedback} />;
  }
  return <LearnTask task={task} hint={sessionParams?.hint !== false} onCorrect={onCorrect} onPrevious={onPrevious} />;
}
