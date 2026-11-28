import React, { useEffect, useRef, useState } from "react";
import AnimatedHand from "./AnimatedHand.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import { FINGER_TIPS, handPoseImage } from "./fingerTasks.js";
import { CounterHand, PrintKeypad } from "./FingersCountTask.jsx";
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
function PoseHands({ leftPose, rightPose, marks = 0 }) {
  const base = import.meta.env?.BASE_URL ?? "/";
  const tips = countingOrder(leftPose, rightPose);
  return (
    <div className="fng-show-hands">
      {[[leftPose, false], [rightPose, true]].map(([pose, mirror], side) => (
        <div key={side} className="fng-pose-wrap">
          <div className="fng-pose-box">
            <img className={`fng-pose-hand${mirror ? " fng-pose-hand--mirror" : ""}`} src={base + handPoseImage(pose)} alt="" draggable={false} />
            {tips.filter(t => t.side === side && t.k < marks).map(t => (
              <span key={t.k} className="fng-tip-mark" style={{ left: `${(t.x / 256) * 100}%`, top: `${(t.y / 320) * 100}%` }}>{t.k + 1}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// The raised fingers numbered in reading order: the left hand from the left, then the
// right hand (mirrored drawing) from the left — 1 … n across the screen.
function countingOrder(leftPose, rightPose) {
  const list = [];
  [[leftPose, false], [rightPose, true]].forEach(([pose, mirror], side) => {
    const tips = Object.values(FINGER_TIPS[pose] ?? {})
      .map(([x, y]) => ({ side, x: mirror ? 256 - x : x, y }))
      .sort((a, b) => a.x - b.x);
    list.push(...tips);
  });
  return list.map((t, k) => ({ ...t, k }));
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
// The hint after the 2nd wrong answer (and every one after it): the raised fingers get
// their numbers one by one, 1 … n, then the numbers go — the child sees how to count,
// but still types the number. Owner, 2026-11-28.
const HINT_AFTER_MISTAKES = 2;
const HINT_STEP_MS = 380;
const HINT_HOLD_MS = 1800;

function RecognizeTask({ task, onCorrect, onMistake, onFlashIncorrect, playFeedback }) {
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [marks, setMarks] = useState(0);
  const hintTimers = useRef([]);
  const stopHint = () => { hintTimers.current.forEach(clearTimeout); hintTimers.current = []; setMarks(0); };
  useEffect(() => { setInput(""); setShake(false); setDone(false); setMistakes(0); stopHint(); }, [task.cardId, task.n]);
  useEffect(() => () => hintTimers.current.forEach(clearTimeout), []);

  function playHint() {
    stopHint();
    const start = 500; // after the shake
    for (let k = 1; k <= task.n; k++) hintTimers.current.push(setTimeout(() => setMarks(k), start + (k - 1) * HINT_STEP_MS));
    hintTimers.current.push(setTimeout(() => setMarks(0), start + (task.n - 1) * HINT_STEP_MS + HINT_HOLD_MS));
  }

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
      stopHint();
      playFeedback?.("correct");
      return;
    }
    setShake(true);
    const count = mistakes + 1;
    setMistakes(count);
    if (count >= HINT_AFTER_MISTAKES) playHint();
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
      <PoseHands leftPose={task.leftPose ?? ""} rightPose={task.rightPose ?? ""} marks={marks} />
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
