import { useState, useEffect, useRef } from "react";
import AnimatedHand from "./AnimatedHand.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import { FINGER_TIPS_R, FINGER_BASES_R } from "./handShapes.js";
import DigitKeypad from "./DigitKeypad.jsx";
import { useTapButtonSize } from "./useTapButtonSize.js";
import "./fingers.css";

// Same hand-written-style buttons as the Столбик tap keyboard, plus a delete
// key (needed here since results can be multi-digit and mistyped, unlike a
// single-cell column entry). fontFamily is forced to sans-serif for the ⌫
// glyph — Primo (the digit font) doesn't have a glyph for it.
function FingersKeypad({ onDigit, onDelete, active }) {
  const bs = useTapButtonSize(48);
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

// ── Shared gesture system (Subtraction + Addition) ────────────────────────────
// A tap commits a dot — the hand itself swaps to the new pose (AnimatedHand's
// own cross-fade) instead of drawing an arrow: watching the finger actually
// appear/disappear on the hand *is* the feedback, no separate annotation
// needed now that hand poses are cheap vector swaps. Dots are shown on EVERY
// finger still to change (not just the next one) so a child can tap in any
// order; every dot commits the same single canonical next-step change, since
// the hand artwork only has one pose per count — which exact dot was tapped
// doesn't matter, only that one was.

function GestureDot({ pos, direction, onCommit }) {
  const startRef = useRef(null);

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    startRef.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e) {
    if (!startRef.current) return;
    const dx = Math.abs(e.clientX - startRef.current.x);
    const dy = Math.abs(e.clientY - startRef.current.y);
    startRef.current = null;
    if (dx < 15 && dy < 15) onCommit();
  }

  return (
    <div
      className={`fng-gesture-dot fng-gesture-dot--${direction}`}
      style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    />
  );
}

// index into FINGER_TIPS_R[N]/fold-position order: [thumb, index, middle, ring, pinky]
// only for N=5; for N<5 the thumb is never in the raised set, so tips arrays
// skip it and every other index shifts down by one — see additionBases below.
const FOLD_ORDER = {
  1: [0],
  2: [1, 0],
  3: [2, 1, 0],
  4: [3, 2, 1, 0],
  5: [0, 4, 3, 2, 1],
};

// Tip position of every currently-raised finger that still needs to fold,
// for startCount → endCount (both within the same hand, 0-5). All returned
// at once — the hand is currently rendering `startCount`, so every one of
// these tips is a real, currently-visible fingertip.
function removalTips(startCount, endCount) {
  const removeN = startCount - endCount;
  const order   = FOLD_ORDER[startCount] ?? [];
  const tips    = FINGER_TIPS_R[startCount] ?? [];
  return order.slice(0, removeN).map(i => tips[i]).filter(Boolean);
}

// Knuckle position of every currently-folded finger that still needs to
// raise, for startCount → endCount (both within the same hand, 0-5).
function additionBases(startCount, endCount) {
  if (startCount >= endCount || endCount > 5) return [];
  const order      = FOLD_ORDER[endCount] ?? [];
  const raiseOrder = [...order].reverse();
  const bases      = FINGER_BASES_R[startCount] ?? [];
  return raiseOrder.slice(startCount, endCount).map(i => {
    const baseIdx = endCount === 5 ? i : i + 1;
    return bases[baseIdx] ?? null;
  }).filter(Boolean);
}

// Mirrors a fraction-of-canvas point for the physically-right hand (rendered
// with side="left", i.e. flipped artwork) — same convention used throughout.
function mirror(pt) {
  return pt && { x: 1 - pt.x, y: pt.y };
}

// A wide highlight near the wrist — always available while building/reducing
// (never gated on having the right count, or its mere presence would be a
// hint), doubling as both "I'm done" and "check my answer". A tap compares
// the real hands against the real example: right → advance; wrong → shake
// and reset, same wrong-answer language as the numpad. The same zone exists
// on both hands so either can be tapped.
function WristZone({ onTap }) {
  return <div className="fng-wrist-zone" onClick={onTap} role="button" aria-label="Дальше" />;
}

// Like getFingerConfig, but the caller picks which hand fills first (1-5)
// before the other takes the 6-10 overflow — getFingerConfig always fills
// "right" first, which is wrong for addend A: a 2-in-2+8 would build
// entirely on the physically-right hand (since 2 ≤ 5 never needs to
// overflow), the exact same physical hand addend B later uses too. Addend A
// always prefers the physically-left hand, B the physically-right one, so
// the two addends never default onto the same hand — even when one of them
// is large enough to need both.
function splitAddend(n, preferLeft) {
  const primary = Math.min(n, 5);
  const overflow = Math.max(0, n - 5);
  return preferLeft ? { left: primary, right: overflow } : { right: primary, left: overflow };
}

// For an addend that may span both hands: dots live on the primary hand
// (left for A, right for B) until IT physically fills up (5), only then
// switching to the overflow hand — never both at once. Showing the overflow
// hand's dots early (before the primary hand is even full) was the actual
// 2+8 bug: a "future" dot on the not-yet-active hand still committed the
// same canonical next finger on the PRIMARY hand when tapped, so a finger
// meant for the left hand visibly rose while the child was tapping what
// looked like a dot on the right. Deliberately NOT capped at the real
// target either — how many dots are on screen must never reveal the target
// number, and tapping past it is no longer blocked; only the wrist check
// (confirmAndAdvance) validates the real count. The caller mirrors the
// "right" set before display, same as everywhere else in this file.
function multiDotsAcrossHands(built, preferLeft) {
  const primaryCount  = Math.min(built, 5);
  const overflowCount = Math.max(0, built - 5);
  const primaryDots  = primaryCount < 5 ? additionBases(primaryCount, 5) : [];
  const overflowDots = primaryCount === 5 ? additionBases(overflowCount, 5) : [];
  return preferLeft
    ? { leftBases: primaryDots, rightBases: overflowDots }
    : { rightBases: primaryDots, leftBases: overflowDots };
}

// ── Subtraction (any a, b) ─────────────────────────────────────────────────
// Flow: show a (pause, tap-skippable) → tap red dots to fold fingers (hand
// cross-fades on every tap, uncapped — folding too many or too few is
// possible) → tap a wrist to check → correct advances to "Ответ" → numpad;
// wrong shakes and resets the hands to try again.

function SubtractionTask({ task, onCorrect, onMistake }) {
  const [phase, setPhase] = useState("show"); // show | reduce | readyAnswer | answer | done
  // Lazy-initialized from task.a so the very first render already shows the
  // correct starting pose — a plain useState(0) would flash empty hands for
  // one frame before the reset effect (below) corrected it.
  const [leftCount, setLeftCount]   = useState(() => getFingerConfig(task.a).left);
  const [rightCount, setRightCount] = useState(() => getFingerConfig(task.a).right);
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);
  // Separate from `shake` (the numpad's own wrong-digit shake) — this one
  // fires when the wrist check finds the hands don't match the example.
  const [handShake, setHandShake] = useState(false);
  const skipRef = useRef(null);

  const { a, b, result } = task;
  const resultStr    = String(result);
  const startConfig  = getFingerConfig(a);
  const resultConfig = getFingerConfig(result);
  const leftEnd  = resultConfig.left;
  const rightEnd = resultConfig.right;

  useEffect(() => {
    setPhase("show");
    setLeftCount(startConfig.left);
    setRightCount(startConfig.right);
    setInput([]); setShake(false); setHandShake(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.cardId]);

  function goReduce() {
    if (skipRef.current) { clearTimeout(skipRef.current); skipRef.current = null; }
    setPhase("reduce");
  }

  // "show": a brief look at the starting number before dots appear.
  useEffect(() => {
    if (phase !== "show") return;
    skipRef.current = setTimeout(goReduce, 1000);
    return () => clearTimeout(skipRef.current);
  }, [phase]);

  // The wrist is always tappable during "reduce", whatever the hands
  // currently show — its availability must never itself signal correctness.
  // A tap checks the real hands against the real result: right → advance,
  // wrong → shake and reset to the starting pose so the child tries again.
  function confirmReduce() {
    if (leftCount === leftEnd && rightCount === rightEnd) {
      setPhase("readyAnswer");
      return;
    }
    setHandShake(true);
    setTimeout(() => {
      setHandShake(false);
      setLeftCount(startConfig.left);
      setRightCount(startConfig.right);
    }, 500);
    onMistake?.();
  }

  function handleDigit(d) {
    if (phase !== "answer" || shake) return;
    const next = [...input, String(d)];
    if (next.length < resultStr.length) { setInput(next); return; }
    if (Number(next.join("")) === result) {
      setPhase("done"); setTimeout(() => onCorrect(), 700);
    } else {
      setShake(true); setTimeout(() => { setShake(false); setInput([]); }, 500);
      onMistake?.();
    }
  }

  function handleDelete() { if (shake) return; setInput(p => p.slice(0, -1)); }

  const hint =
    phase === "show"        ? `Было ${a} →` :
    phase === "reduce"      ? `Убери ${b} →` :
    phase === "readyAnswer" ? "Готово? →" :
    "Введи ответ";

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  const kbdVisible = phase === "answer" || phase === "done";

  // Every currently-raised finger gets a dot, always down to 0 — folding
  // isn't capped at the real result, so a child really can show the wrong
  // count. Only the wrist tap (always available during "reduce", see
  // confirmReduce above) checks correctness.
  const leftTips  = (phase === "reduce" && leftCount > 0)  ? removalTips(leftCount, 0)  : [];
  const rightTips = (phase === "reduce" && rightCount > 0) ? removalTips(rightCount, 0).map(mirror) : [];

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top" onClick={phase === "show" ? goReduce : undefined}
           style={{ cursor: phase === "show" ? "pointer" : "default" }}>
        <div className="fng-count-expr">{a} − {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      <div className={`fng-add-hands-zone${handShake ? " fng-hands-shake" : ""}`} onClick={phase === "show" ? goReduce : undefined}
           style={{ cursor: phase === "show" ? "pointer" : "default" }}>
        <div className="fng-sub-hands">
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={leftCount} side="right" style={{ width: "100%", height: "100%" }} />
              {leftTips.length > 0 && (
                <div className="fng-gesture-overlay">
                  {leftTips.map((pos, i) => (
                    <GestureDot key={i} pos={pos} direction="down" onCommit={() => setLeftCount(c => Math.max(0, c - 1))} />
                  ))}
                </div>
              )}
              {phase === "reduce" && <WristZone onTap={confirmReduce} />}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={rightCount} side="left" style={{ width: "100%", height: "100%" }} />
              {rightTips.length > 0 && (
                <div className="fng-gesture-overlay">
                  {rightTips.map((pos, i) => (
                    <GestureDot key={i} pos={pos} direction="down" onCommit={() => setRightCount(c => Math.max(0, c - 1))} />
                  ))}
                </div>
              )}
              {phase === "reduce" && <WristZone onTap={confirmReduce} />}
            </div>
          </div>
        </div>
      </div>

      <div className="fng-add-kbd-zone fng-kbd-relative">
        <div style={{ opacity: kbdVisible ? 1 : 0, transition: "opacity 0.3s ease" }}>
          <FingersKeypad onDigit={handleDigit} onDelete={handleDelete} active={phase === "answer"} />
        </div>
        {phase === "readyAnswer" && (
          <div className="fng-ready-zone">
            <button className="fng-ready-btn" onClick={() => setPhase("answer")}>Ответ</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Addition (any a, b) ────────────────────────────────────────────────────
// Flow: two fists → tap green dots to build A on one dedicated hand → tap
// its wrist to confirm → build B on the other hand (A stays visible, frozen)
// → tap its wrist → numpad. When an addend needs both hands to represent
// itself (>5), it falls back to the combined two-hand build instead of a
// single dedicated hand.

function AdditionTask({ task, onCorrect, onMistake }) {
  const [phase, setPhase] = useState("a"); // a | b | answer | done
  const [builtA, setBuiltA] = useState(0);
  const [builtB, setBuiltB] = useState(0);
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);
  // Separate from `shake` (the numpad's own wrong-digit shake) — this one
  // fires when the wrist check finds the hands don't match the example.
  const [handShake, setHandShake] = useState(false);

  const { a, b, result } = task;
  const resultStr = String(result);
  // Each addend ≤5 fits on one hand — dedicate a hand per addend so A and B
  // are never both shown on the same hand (the previous bug: FINGER_MAP
  // always fills its "right" slot first, so two addends ≤5 landed on the
  // exact same physical hand one after another). When either addend needs
  // both hands to represent itself (>5), there's no hand left to dedicate to
  // the other addend, so fall back to the combined two-hand FINGER_MAP build
  // used for a single large number (same as before this fix).
  const simple = a <= 5 && b <= 5;
  const cap = simple ? 5 : 10; // physical ceiling for a free (uncapped-at-target) tap

  const building = phase === "a" || phase === "b";
  const target   = phase === "a" ? a : phase === "b" ? b : null;
  const built    = phase === "a" ? builtA : phase === "b" ? builtB : null;

  useEffect(() => {
    setPhase("a"); setBuiltA(0); setBuiltB(0); setInput([]); setShake(false); setHandShake(false);
  }, [task.cardId]);

  // The wrist is always tappable while building — its availability must
  // never itself signal correctness. A tap checks the real built count
  // against the real addend: right → advance, wrong → shake and reset this
  // hand to a fist so the child tries again.
  function confirmAndAdvance() {
    if (built !== target) {
      setHandShake(true);
      setTimeout(() => {
        setHandShake(false);
        if (phase === "a") setBuiltA(0); else setBuiltB(0);
      }, 500);
      onMistake?.();
      return;
    }
    if (phase === "a") setPhase("b");
    else if (phase === "b") setPhase("answer");
  }

  // Uncapped at the real target — reaching (or overshooting) `a`/`b` no
  // longer blocks further taps, otherwise the block itself would be a hint.
  function commit() {
    if (phase === "a") setBuiltA(c => Math.min(cap, c + 1));
    else if (phase === "b") setBuiltB(c => Math.min(cap, c + 1));
  }

  function handleDigit(d) {
    if (phase !== "answer" || shake) return;
    const next = [...input, String(d)];
    if (next.length < resultStr.length) { setInput(next); return; }
    if (Number(next.join("")) === result) {
      setPhase("done"); setTimeout(() => onCorrect(), 700);
    } else {
      setShake(true); setTimeout(() => { setShake(false); setInput([]); }, 500);
      onMistake?.();
    }
  }

  function handleDelete() { if (shake) return; setInput(p => p.slice(0, -1)); }

  const hint =
    phase === "a" ? `Покажи ${a} →` :
    phase === "b" ? `Теперь покажи ${b} →` :
    "Введи ответ";

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  const kbdVisible = phase === "answer" || phase === "done";

  // Dots always span the hand's full remaining capacity (up to 5, or 10
  // across both hands), never just "target − built" — otherwise counting
  // the dots would hand the child the answer instead of the number itself.
  // They track the real (now uncapped) built count continuously; only the
  // wrist tap clears them, by changing phase.
  let leftCount, rightCount, leftBases, rightBases;
  if (simple) {
    // One hand per addend — both stay visible side by side once built.
    leftCount  = builtA;
    rightCount = builtB;
    leftBases  = (phase === "a") ? additionBases(builtA, 5) : [];
    rightBases = (phase === "b") ? additionBases(builtB, 5).map(mirror) : [];
  } else {
    // Either addend needs both hands to represent itself, so they can't stay
    // frozen side by side — but each still prefers its own hand first (A
    // left, B right, via splitAddend) so a small addend paired with a large
    // one doesn't default onto the same physical hand the other one uses.
    const preferLeft = phase === "a";
    const activeBuilt = building ? built : b;
    const cfg = splitAddend(activeBuilt, preferLeft);
    leftCount  = cfg.left;
    rightCount = cfg.right;
    const dots = building ? multiDotsAcrossHands(built, preferLeft) : { leftBases: [], rightBases: [] };
    leftBases  = dots.leftBases;
    rightBases = dots.rightBases.map(mirror);
  }

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top">
        <div className="fng-count-expr">{a} + {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      <div className={`fng-add-hands-zone${handShake ? " fng-hands-shake" : ""}`}>
        <div className="fng-sub-hands">
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={leftCount} side="right" style={{ width: "100%", height: "100%" }} />
              {leftBases.length > 0 && (
                <div className="fng-gesture-overlay">
                  {leftBases.map((pos, i) => (
                    <GestureDot key={i} pos={pos} direction="up" onCommit={commit} />
                  ))}
                </div>
              )}
              {phase === "a" && <WristZone onTap={confirmAndAdvance} />}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={rightCount} side="left" style={{ width: "100%", height: "100%" }} />
              {rightBases.length > 0 && (
                <div className="fng-gesture-overlay">
                  {rightBases.map((pos, i) => (
                    <GestureDot key={i} pos={pos} direction="up" onCommit={commit} />
                  ))}
                </div>
              )}
              {phase === "b" && <WristZone onTap={confirmAndAdvance} />}
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

export default function FingersCountTask({ task, onCorrect, onMistake }) {
  if (task.op === "sub") {
    return <SubtractionTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
  }
  return <AdditionTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
}
