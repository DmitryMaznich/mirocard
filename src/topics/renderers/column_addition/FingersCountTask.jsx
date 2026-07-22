import { useState, useEffect, useRef } from "react";
import AnimatedHand from "./AnimatedHand.jsx";
import DigitKeypad from "./DigitKeypad.jsx";
import { useTapButtonSize } from "./useTapButtonSize.js";
import { useFitOneLine, useRowsHeightCap } from "./textFit.js";
import "./fingers.css";

// Same hand-written-style buttons as the Столбик tap keyboard, plus a delete
// key (needed here since results can be multi-digit and mistyped, unlike a
// single-cell column entry). fontFamily is forced to sans-serif for the ⌫
// glyph — Primo (the digit font) doesn't have a glyph for it.
function FingersKeypad({ onDigit, onDelete, active }) {
  // 48 is the shared col-tap-kb base — 15% smaller here specifically,
  // since this keypad felt oversized on phone; passed locally rather than
  // changed in useTapButtonSize itself so the Столбик keyboard is untouched.
  const bs = useTapButtonSize(41);
  const bsStr = bs + "px";
  return (
    <div className="col-tap-kb" style={{ pointerEvents: active ? "auto" : "none" }}>
      <DigitKeypad onDigit={onDigit} bs={bs} />
      <div className="col-tap-row">
        <button
          className="col-tap-btn col-tap-btn--line"
          style={{ height: bsStr, flex: 1, color: "#ef4444", fontFamily: "sans-serif", fontSize: Math.round(bs * 0.5) + "px" }}
          onClick={onDelete}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="fng-check-icon" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// A checklist row doubling as the confirm button — replaces the old
// floating "Сделал!" pill between the hands, which kids kept missing
// entirely since it wasn't visually tied to the instruction they'd just
// read. The instruction itself is now the tap target: a checkbox that
// fills in once tapped correctly. Completed rows STAY on screen (frozen,
// green, checked, struck through) instead of being replaced by the next
// instruction — the child can see the whole path so far, not just the
// current step. `clickable=false` is for the final "Введи ответ" row: it
// still shows pending → done, but ticks itself off once the numpad gets
// the right digits, not from a tap on the row.
function ChecklistItem({ text, state, onTap, textRef, fontSize, clickable = true }) {
  const done = state === "done";
  const wrong = state === "wrong";
  const interactive = clickable && !done;
  return (
    <div
      className={`fng-checklist-item${done ? " is-done" : ""}${wrong ? " is-wrong" : ""}${!clickable ? " is-pending" : ""}`}
      onClick={interactive ? onTap : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <span className="fng-checklist-box">{done && <CheckIcon />}</span>
      <span ref={textRef} className="fng-checklist-text" style={fontSize ? { fontSize } : undefined}>
        {text}
      </span>
    </div>
  );
}

// Two big arrow buttons — green raises, red lowers — centered on one hand's
// palm. Replaces the old per-finger dot system entirely: AnimatedHand only
// ever needs a COUNT (0-5) to pick its pose, never which specific finger
// changed, so there's no more need to compute individual finger tip/base
// positions — a hand is just a number that goes up or down. Each arrow
// disables at that hand's own physical limit (can't raise past 5, can't
// lower past 0) — never at the secret target, so their availability never
// hints the answer, and any wrong split is genuinely reachable and
// self-correctable with the opposite arrow (no full reset needed for a
// single mis-tap).
function HandArrows({ count, onRaise, onLower }) {
  return (
    <div className="fng-hand-arrows">
      <button
        type="button"
        className="fng-arrow fng-arrow--up"
        disabled={count >= 5}
        onClick={onRaise}
        aria-label="Поднять палец"
      >
        ▲
      </button>
      <button
        type="button"
        className="fng-arrow fng-arrow--down"
        disabled={count <= 0}
        onClick={onLower}
        aria-label="Опустить палец"
      >
        ▼
      </button>
    </div>
  );
}

// ── Shared two-phase flow (addition and subtraction) ────────────────────────
// Both hands are just free-standing 0-5 counters the child distributes
// however they like — no dedicated "this hand is addend A" rule, no fixed
// fill order. Flow: two fists → raise/lower freely on either hand until the
// total matches `a` → confirm → keep going WITHOUT resetting (raise more
// for addition, lower for subtraction) until the total matches the result →
// confirm → numpad. A wrong confirm shakes and resets: to 0/0 fists at the
// first checkpoint, or back to the EXACT split that was confirmed for `a`
// at the second (the first number was already right, only the
// continuation needs redoing). Subtraction used to pre-show the minuend
// automatically — now the child builds it themselves too, same as addition,
// so the two operations share this one component entirely.
function TwoPhaseTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const { a, b, result, op } = task;
  const [phase, setPhase] = useState("build"); // build | apply | answer | done
  const [handLeft, setHandLeft] = useState(0);
  const [handRight, setHandRight] = useState(0);
  const checkpointRef = useRef({ left: 0, right: 0 });
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);
  // Separate from `shake` (the numpad's own wrong-digit shake) — this one
  // fires when the confirm check finds the hands don't match the example.
  const [handShake, setHandShake] = useState(false);

  const resultStr = String(result);
  const building = phase === "build" || phase === "apply";
  const target = phase === "build" ? a : result;

  useEffect(() => {
    setPhase("build");
    setHandLeft(0); setHandRight(0);
    checkpointRef.current = { left: 0, right: 0 };
    setInput([]); setShake(false); setHandShake(false);
  }, [task.cardId]);

  function confirm() {
    const total = handLeft + handRight;
    if (total !== target) {
      setHandShake(true);
      setTimeout(() => {
        setHandShake(false);
        if (phase === "build") { setHandLeft(0); setHandRight(0); }
        else { setHandLeft(checkpointRef.current.left); setHandRight(checkpointRef.current.right); }
      }, 500);
      onMistake?.();
      return;
    }
    if (phase === "build") {
      checkpointRef.current = { left: handLeft, right: handRight };
      setPhase("apply");
    } else if (phase === "apply") {
      setPhase("answer");
    }
  }

  function raiseLeft()  { setHandLeft(c => Math.min(5, c + 1)); }
  function lowerLeft()  { setHandLeft(c => Math.max(0, c - 1)); }
  function raiseRight() { setHandRight(c => Math.min(5, c + 1)); }
  function lowerRight() { setHandRight(c => Math.max(0, c - 1)); }

  function handleDigit(d) {
    if (phase !== "answer" || shake) return;
    const next = [...input, String(d)];
    if (next.length < resultStr.length) { setInput(next); return; }
    if (Number(next.join("")) === result) {
      setPhase("done"); setTimeout(() => onCorrect(), 700);
    } else {
      setShake(true); setTimeout(() => { setShake(false); setInput([]); }, 500);
      onMistake?.();
      onFlashIncorrect?.();
    }
  }

  function handleDelete() { if (shake) return; setInput(p => p.slice(0, -1)); }

  const item1Text = `Покажи ${a}`;
  const item2Text = op === "sub" ? `Убери ${b}` : `Прибавь ещё ${b}`;
  const activeText = phase === "build" ? item1Text : phase === "apply" ? item2Text : "";

  const item1State = phase === "build" ? (handShake ? "wrong" : "active") : "done";
  const item2State = phase === "apply" ? (handShake ? "wrong" : "active") : "done";

  const expr = op === "sub" ? `${a} − ${b}` : `${a} + ${b}`;

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  const kbdVisible = phase === "answer" || phase === "done";
  const { ref: rowsCapRef, cap: rowsCap } = useRowsHeightCap(3);
  const { ref: hintRef, fontSize: hintFontSize } = useFitOneLine(activeText, { max: rowsCap, min: 14 });

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top">
        <div className="fng-count-expr">{expr} = {answerPart}</div>
      </div>

      <div className="fng-checklist" ref={rowsCapRef}>
        <ChecklistItem
          text={item1Text}
          state={item1State}
          onTap={phase === "build" ? confirm : undefined}
          textRef={phase === "build" ? hintRef : undefined}
          fontSize={phase === "build" ? hintFontSize : undefined}
        />
        {phase !== "build" && (
          <ChecklistItem
            text={item2Text}
            state={item2State}
            onTap={phase === "apply" ? confirm : undefined}
            textRef={phase === "apply" ? hintRef : undefined}
            fontSize={phase === "apply" ? hintFontSize : undefined}
          />
        )}
        {kbdVisible && (
          <ChecklistItem
            text="Введи ответ"
            state={phase === "done" ? "done" : "active"}
            clickable={false}
          />
        )}
      </div>

      <div className="fng-add-hands-zone">
        <div className="fng-sub-hands">
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={handLeft} side="right" style={{ width: "100%", height: "100%" }} />
              {building && <HandArrows count={handLeft} onRaise={raiseLeft} onLower={lowerLeft} />}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={handRight} side="left" style={{ width: "100%", height: "100%" }} />
              {building && <HandArrows count={handRight} onRaise={raiseRight} onLower={lowerRight} />}
            </div>
          </div>
        </div>
      </div>

      <div className="fng-add-kbd-zone" style={{ opacity: kbdVisible ? 1 : 0, transition: "opacity 0.3s ease" }}>
        <FingersKeypad onDigit={handleDigit} onDelete={handleDelete} active={phase === "answer"} />
      </div>
    </div>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default function FingersCountTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  return <TwoPhaseTask task={task} onCorrect={onCorrect} onMistake={onMistake} onFlashIncorrect={onFlashIncorrect} />;
}
