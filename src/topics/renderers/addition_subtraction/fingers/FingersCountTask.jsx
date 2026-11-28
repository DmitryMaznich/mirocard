import { useState, useEffect, useRef } from "react";
import AnimatedHand from "./AnimatedHand.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import { FINGER_TIPS_R } from "./handShapes.js";
import { ForwardArrowIcon } from "@/shared/components/ArrowIcons";
import "./fingers.css";

// The topic's keypad in print digits (1–5 / 6–0, ⌫ on the right): «Считаем на пальцах»
// and «Покажи на пальцах» → «Пальцы → цифра».
export function PrintKeypad({ onDigit, onBackspace, disabled }) {
  return (
    <div className="fng-keypad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => (
        <button key={d} type="button" className="fng-key" disabled={disabled} onClick={() => onDigit(d)}>{d}</button>
      ))}
      <button type="button" className="fng-key fng-key--erase" disabled={disabled} onClick={onBackspace} aria-label="Стереть">⌫</button>
    </div>
  );
}

// A hand with its ▼ / ▲ pair in a row under the wrist (owner, 2026-11-28: off the
// palm, sized from the hand). Used by «Считаем на пальцах» and «Покажи на пальцах» →
// «Цифра → пальцы». `buttons={false}` keeps their place, so the hand doesn't jump.
// `marks`: numbers to show on the fingertips ({ x, y, k } in 0…1 of the drawing).
export function CounterHand({ count, side, onRaise, onLower, disabled, buttons = true, marks = [] }) {
  return (
    <div className="fng-tap-hand">
      <div className="fng-hand-box">
        <AnimatedHand count={count} side={side} style={{ width: "100%", height: "100%" }} />
        {marks.map((m) => (
          <span key={m.k} className="fng-tip-mark" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }}>{m.k}</span>
        ))}
      </div>
      <div className="fng-hand-buttons" style={buttons ? undefined : { visibility: "hidden" }}>
        <button type="button" className="fng-hand-btn fng-hand-btn--down" disabled={disabled || !buttons || count <= 0} onClick={onLower} aria-label="Опустить палец">▼</button>
        <button type="button" className="fng-hand-btn fng-hand-btn--up" disabled={disabled || !buttons || count >= 5} onClick={onRaise} aria-label="Поднять палец">▲</button>
      </div>
    </div>
  );
}

// The raised fingers numbered 1 … n in reading order: the left hand (drawing as is)
// from the left, then the right hand (mirrored) from the left.
function countingMarks(left, right) {
  let k = 0;
  return [left, right].map((count, side) => (FINGER_TIPS_R[count] ?? [])
    .map((p) => ({ x: side ? 1 - p.x : p.x, y: p.y }))
    .sort((a, b) => a.x - b.x)
    .map((p) => ({ ...p, k: ++k })));
}

// «Считаем на пальцах» (redone 2026-11-28 after the mockup
// docs/mockups/addition-subtraction/2026-11-28-fingers-count.html):
// the example large in print in a box; ONE current instruction («Покажи 8» → «Убери 3» /
// «Прибавь ещё 4» → «Сколько стало?»), the steps done as small chips above it; the two
// hands with ▼ / ▲ under the wrists; «Готово» checks every step. Both hands are free
// 0–5 counters — any split that adds up is right. A wrong check shakes and KEEPS the
// hands (the child corrects them); after the 2nd wrong check of a step: on a hands step
// the canonical pose for a moment beside the instruction, on the answer step the
// raised fingers get their numbers one by one. The answer is typed on the print keypad
// and checked on «Готово»; right → «Дальше», and that tap moves on.
const HINT_AFTER_MISTAKES = 2;
const MODEL_SHOW_MS = 3000;
const COUNT_STEP_MS = 380;
const COUNT_HOLD_MS = 1800;
const MAX_DIGITS = 2;

function ModelHands({ n }) {
  const { left, right } = getFingerConfig(n);
  return (
    <span className="fng-count-model" aria-hidden="true">
      {/* the child's left hand on the left (drawing as is), the right hand mirrored */}
      <AnimatedHand count={left} side="right" animated={false} style={{ height: "100%", aspectRatio: "256 / 320" }} />
      <AnimatedHand count={right} side="left" animated={false} style={{ height: "100%", aspectRatio: "256 / 320" }} />
    </span>
  );
}

function TwoPhaseTask({ task, onCorrect, onMistake, onFlashIncorrect, playFeedback }) {
  const { a, b, result, op } = task;
  const [phase, setPhase] = useState("build"); // build | apply | answer | done
  const [handLeft, setHandLeft] = useState(0);
  const [handRight, setHandRight] = useState(0);
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [modelVisible, setModelVisible] = useState(false);
  const [marks, setMarks] = useState(0);
  // Two timer lists: the hint's own (cleared when a hint restarts or the step changes)
  // and the shake's, so restarting a hint never leaves the shake — and the locked
  // buttons — on.
  const timers = useRef([]);
  const shakeTimer = useRef(null);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  useEffect(() => {
    clearTimers(); clearTimeout(shakeTimer.current);
    setPhase("build"); setHandLeft(0); setHandRight(0); setInput("");
    setShake(false); setMistakes(0); setModelVisible(false); setMarks(0);
  }, [task.cardId]);
  useEffect(() => () => { clearTimers(); clearTimeout(shakeTimer.current); }, []);

  const building = phase === "build" || phase === "apply";
  const target = phase === "build" ? a : result;

  function nextStep(to) {
    clearTimers();
    setMistakes(0); setModelVisible(false); setMarks(0);
    setPhase(to);
  }

  function hint() {
    clearTimers();
    if (building) {
      setModelVisible(true);
      later(() => setModelVisible(false), MODEL_SHOW_MS);
      return;
    }
    setMarks(0);
    for (let k = 1; k <= result; k++) later(() => setMarks(k), 500 + (k - 1) * COUNT_STEP_MS);
    later(() => setMarks(0), 500 + (result - 1) * COUNT_STEP_MS + COUNT_HOLD_MS);
  }

  function wrong() {
    setShake(true);
    clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => { setShake(false); if (phase === "answer") setInput(""); }, 450);
    const count = mistakes + 1;
    setMistakes(count);
    playFeedback?.("incorrect");
    onMistake?.();
    onFlashIncorrect?.();
    if (count >= HINT_AFTER_MISTAKES) hint();
  }

  function check() {
    if (shake) return;
    if (phase === "done") { onCorrect(); return; }
    if (phase === "answer") {
      if (!input) return;
      if (Number(input) === result) {
        clearTimers(); setMarks(0);
        setPhase("done");
        playFeedback?.("correct");
      } else wrong();
      return;
    }
    if (handLeft + handRight !== target) { wrong(); return; }
    nextStep(phase === "build" ? "apply" : "answer");
  }

  function addDigit(d) {
    if (phase !== "answer" || shake) return;
    setInput((v) => (v.length >= MAX_DIGITS ? v : v === "0" ? String(d) : v + d));
  }
  function erase() { if (phase === "answer" && !shake) setInput((v) => v.slice(0, -1)); }

  const stepText = op === "sub" ? `Убери ${b}` : `Прибавь ещё ${b}`;
  const instruction = phase === "build" ? `Покажи ${a}` : phase === "apply" ? stepText : "Сколько стало?";
  const chips = [
    phase !== "build" && `Покажи ${a}`,
    (phase === "answer" || phase === "done") && stepText,
  ].filter(Boolean);
  const [marksLeft, marksRight] = countingMarks(handLeft, handRight);
  const shownMarks = (list) => list.filter((m) => m.k <= marks);
  const answered = phase === "done";

  return (
    <div className="fng-count-screen">
      <div className={`fng-count-box${answered ? " is-done" : ""}${shake && phase === "answer" ? " is-wrong" : ""}`} aria-label="пример">
        <span>{a}</span>
        <span className={`fng-count-op fng-count-op--${op === "sub" ? "sub" : "add"}`}>{op === "sub" ? "−" : "+"}</span>
        <span>{b}</span>
        <span className="fng-count-eq">=</span>
        <span className={`fng-count-res${input ? " is-typed" : ""}`}>{answered ? result : (input || "?")}</span>
      </div>

      <div className="fng-count-step">
        <div className="fng-count-chips">
          {chips.map((c) => <span key={c} className="fng-count-chip">✓ {c}</span>)}
        </div>
        <div className="fng-count-instr">
          <span>{instruction}</span>
          {modelVisible && building && <ModelHands n={target} />}
        </div>
      </div>

      <div className={`fng-tap-hands fng-count-hands${shake && building ? " is-shaking" : ""}`}>
        <CounterHand
          count={handLeft} side="right" buttons={building} disabled={shake}
          onRaise={() => setHandLeft((c) => Math.min(5, c + 1))} onLower={() => setHandLeft((c) => Math.max(0, c - 1))}
          marks={shownMarks(marksLeft)}
        />
        <CounterHand
          count={handRight} side="left" buttons={building} disabled={shake}
          onRaise={() => setHandRight((c) => Math.min(5, c + 1))} onLower={() => setHandRight((c) => Math.max(0, c - 1))}
          marks={shownMarks(marksRight)}
        />
      </div>

      {(phase === "answer" || phase === "done") && (
        <div className="fng-count-pad">
          <PrintKeypad onDigit={addDigit} onBackspace={erase} disabled={answered || shake} />
        </div>
      )}

      <div className="fng-show-done-row fng-count-done">
        <button
          type="button"
          className={`fng-done-btn${answered ? " is-next" : ""}${shake ? " is-wrong" : ""}`}
          disabled={phase === "answer" && !input}
          onClick={check}
        >
          {answered ? <>Дальше <ForwardArrowIcon size={18} /></> : "Готово"}
        </button>
      </div>
    </div>
  );
}

export default function FingersCountTask({ task, onCorrect, onMistake, onFlashIncorrect, playFeedback }) {
  return <TwoPhaseTask task={task} onCorrect={onCorrect} onMistake={onMistake} onFlashIncorrect={onFlashIncorrect} playFeedback={playFeedback} />;
}
