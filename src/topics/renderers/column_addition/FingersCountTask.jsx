import { useState, useEffect, useLayoutEffect, useRef } from "react";
import AnimatedHand from "./AnimatedHand.jsx";
import DigitKeypad from "./DigitKeypad.jsx";
import { useTapButtonSize } from "./useTapButtonSize.js";
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

// One button, centered between both hands at wrist height — always
// available while building/applying (never gated on having the right
// count, or its mere presence would be a hint), doubling as both "I'm
// done" and "check my answer". A tap compares the real hands against the
// real example: right → advance; wrong → shake and reset.
function ConfirmZone({ onTap }) {
  return (
    <button type="button" className="fng-confirm-zone" onClick={onTap}>
      Сделал!
    </button>
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

// Shrinks font-size just enough to keep `text` on one line inside its
// parent's content box — vw-based clamp() alone can't do this, since the
// same font-size wraps a long hint ("Прибавь ещё 8") but not a short one
// ("Убери 2"). Unlike a one-shot proportional calculation (containerWidth /
// naturalWidth * max), this steps the size DOWN and re-measures after every
// step, verifying the actual fit directly each time rather than trusting a
// single formula — immune to whatever measurement quirk (font metrics,
// rounding, a not-yet-settled layout) made the proportional version report
// "already fits" when it visibly didn't on real devices. Re-runs on
// container resize, on any font finishing loading (the Nunito stylesheet
// loads async — see index.html), and via two delayed safety-net passes for
// any layout that only settles a little after mount.
function useFitOneLine(text, { min = 16, max = 56, step = 2 } = {}) {
  const ref = useRef(null);
  const [fontSize, setFontSize] = useState(max);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement) return;
    const parent = el.parentElement;

    function fit() {
      const containerWidth = parent.clientWidth;
      if (containerWidth === 0) return;
      let size = max;
      el.style.fontSize = size + "px";
      while (size > min && el.scrollWidth > containerWidth) {
        size -= step;
        el.style.fontSize = size + "px";
      }
      setFontSize(size);
    }

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(parent);
    const fontsApi = typeof document !== "undefined" ? document.fonts : null;
    fontsApi?.addEventListener?.("loadingdone", fit);
    const t1 = setTimeout(fit, 300);
    const t2 = setTimeout(fit, 1200);
    return () => {
      ro.disconnect();
      fontsApi?.removeEventListener?.("loadingdone", fit);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [text, min, max, step]);

  return { ref, fontSize };
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

  const hint =
    phase === "build" ? `Покажи ${a}` :
    phase === "apply" ? (op === "sub" ? `Убери ${b}` : `Прибавь ещё ${b}`) :
    "Введи ответ";

  const expr = op === "sub" ? `${a} − ${b}` : `${a} + ${b}`;

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  const kbdVisible = phase === "answer" || phase === "done";
  const { ref: hintRef, fontSize: hintFontSize } = useFitOneLine(hint);

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top">
        <div className="fng-count-expr">{expr} = {answerPart}</div>
      </div>

      <div className="fng-add-hint">
        <span ref={hintRef} className="fng-add-hint-text" style={{ fontSize: hintFontSize }}>{hint}</span>
      </div>

      <div className={`fng-add-hands-zone${handShake ? " fng-hands-shake" : ""}`}>
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
          {building && <ConfirmZone onTap={confirm} />}
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
