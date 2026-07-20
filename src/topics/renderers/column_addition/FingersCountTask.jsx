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
// needed now that hand poses are cheap vector swaps. Only ONE dot is shown
// per hand at a time, always at the exact next finger to change — recomputed
// fresh after every tap, so it can never visually drift from the real target
// the way one fixed-position dot per remaining finger could.

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

// Single-step lookups: called with a 1-wide [count, count±1] range, they
// return exactly the one finger changing. (The functions also tolerate wider
// ranges — unused now, kept general in case a wider cascade is wanted again.)
function removalTips(startCount, endCount) {
  const removeN = startCount - endCount;
  const order   = FOLD_ORDER[startCount] ?? [];
  const tips    = FINGER_TIPS_R[startCount] ?? [];
  return order.slice(0, removeN).map(i => tips[i]).filter(Boolean);
}

// Landing knuckle position for a removed finger — where it ends up once
// folded, i.e. its base in the END state.
function removalBases(startCount, endCount) {
  const removeN = startCount - endCount;
  const order   = FOLD_ORDER[startCount] ?? [];
  const bases   = FINGER_BASES_R[endCount] ?? [];
  return order.slice(0, removeN).map(i => {
    const baseIdx = startCount === 5 ? i : i + 1;
    return bases[baseIdx] ?? null;
  }).filter(Boolean);
}

function additionTips(startCount, endCount) {
  if (startCount >= endCount || endCount > 5) return [];
  const order      = FOLD_ORDER[endCount] ?? [];
  const tips       = FINGER_TIPS_R[endCount] ?? [];
  const raiseOrder = [...order].reverse();
  return raiseOrder.slice(startCount, endCount).map(i => tips[i]).filter(Boolean);
}

// Knuckle position a folded finger raises from, for startCount → endCount.
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

// ── Subtraction (any a, b) ─────────────────────────────────────────────────
// Flow: show a (pause, tap-skippable) → tap red dots to fold b fingers
// (hand cross-fades on every tap) → "Ответ" button → numpad.

function SubtractionTask({ task, onCorrect, onMistake }) {
  const [phase, setPhase] = useState("show"); // show | reduce | readyAnswer | answer | done
  // Lazy-initialized from task.a so the very first render already shows the
  // correct starting pose — a plain useState(0) would flash empty hands for
  // one frame before the reset effect (below) corrected it.
  const [leftCount, setLeftCount]   = useState(() => getFingerConfig(task.a).left);
  const [rightCount, setRightCount] = useState(() => getFingerConfig(task.a).right);
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);
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
    setInput([]); setShake(false);
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

  // "reduce": once both hands reached the target count, show the answer button.
  useEffect(() => {
    if (phase !== "reduce" || leftCount !== leftEnd || rightCount !== rightEnd) return;
    const t = setTimeout(() => setPhase("readyAnswer"), 450);
    return () => clearTimeout(t);
  }, [phase, leftCount, rightCount, leftEnd, rightEnd]);

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
    phase === "show"       ? `Было ${a} →` :
    phase === "reduce"     ? `Убери ${b} →` :
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

  const leftDot  = (phase === "reduce" && leftCount > leftEnd)
    ? { tip: removalTips(leftCount, leftCount - 1)[0], base: removalBases(leftCount, leftCount - 1)[0] }
    : null;
  const rightDotR = (phase === "reduce" && rightCount > rightEnd)
    ? { tip: removalTips(rightCount, rightCount - 1)[0], base: removalBases(rightCount, rightCount - 1)[0] }
    : null;
  const rightDot = rightDotR && { tip: mirror(rightDotR.tip), base: mirror(rightDotR.base) };

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top" onClick={phase === "show" ? goReduce : undefined}
           style={{ cursor: phase === "show" ? "pointer" : "default" }}>
        <div className="fng-count-expr">{a} − {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      <div className="fng-add-hands-zone" onClick={phase === "show" ? goReduce : undefined}
           style={{ cursor: phase === "show" ? "pointer" : "default" }}>
        <div className="fng-sub-hands">
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={leftCount} side="right" style={{ width: "100%", height: "100%" }} />
              {leftDot && (
                <div className="fng-gesture-overlay">
                  <GestureDot pos={leftDot.tip} direction="down" onCommit={() => setLeftCount(c => c - 1)} />
                </div>
              )}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={rightCount} side="left" style={{ width: "100%", height: "100%" }} />
              {rightDot && (
                <div className="fng-gesture-overlay">
                  <GestureDot pos={rightDot.tip} direction="down" onCommit={() => setRightCount(c => c - 1)} />
                </div>
              )}
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
// Flow: two fists → tap green dots to raise a fingers (pause) → fists again,
// tap to raise b fingers (pause) → numpad. No merge animation — the hands
// never need to touch, the two counts are shown one after the other.

function AdditionTask({ task, onCorrect, onMistake }) {
  const [phase, setPhase] = useState("a"); // a | b | answer | done
  const [built, setBuilt] = useState(0);
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);
  const skipRef = useRef(null);

  const { a, b, result } = task;
  const resultStr = String(result);
  const target = phase === "a" ? a : phase === "b" ? b : null;

  useEffect(() => {
    setPhase("a"); setBuilt(0); setInput([]); setShake(false);
  }, [task.cardId]);

  function skipToNext() {
    if (skipRef.current) { clearTimeout(skipRef.current); skipRef.current = null; }
    if (phase === "a") { setPhase("b"); setBuilt(0); }
    else if (phase === "b") { setPhase("answer"); }
  }

  // Once the active addend is fully built, pause briefly then move on.
  useEffect(() => {
    if ((phase !== "a" && phase !== "b") || built !== target) return;
    skipRef.current = setTimeout(skipToNext, 700);
    return () => clearTimeout(skipRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, built, target]);

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
    phase === "b" ? `Теперь ${b} →` :
    "Введи ответ";

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  const kbdVisible = phase === "answer" || phase === "done";
  const building    = phase === "a" || phase === "b";
  const settled     = building && built === target; // waiting out the pause — tap skips it
  const config      = getFingerConfig(building ? built : (phase === "answer" || phase === "done" ? b : 0));
  const leftCount   = config.left;
  const rightCount  = config.right;

  // Which single finger raises next, and on which physical hand.
  let dot = null;
  if (building && built < target) {
    const cur = getFingerConfig(built);
    const nxt = getFingerConfig(built + 1);
    if (nxt.right > cur.right) {
      dot = { side: "right", tip: additionTips(cur.right, nxt.right)[0], base: additionBases(cur.right, nxt.right)[0] };
    } else {
      dot = { side: "left", tip: additionTips(cur.left, nxt.left)[0], base: additionBases(cur.left, nxt.left)[0] };
    }
  }
  const leftDot  = dot && dot.side === "left"  ? dot : null;
  const rightDot = dot && dot.side === "right" ? { tip: mirror(dot.tip), base: mirror(dot.base) } : null;

  function commit() {
    if (building && built < target) setBuilt(c => c + 1);
  }

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top" onClick={settled ? skipToNext : undefined}
           style={{ cursor: settled ? "pointer" : "default" }}>
        <div className="fng-count-expr">{a} + {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      <div className="fng-add-hands-zone" onClick={settled ? skipToNext : undefined}
           style={{ cursor: settled ? "pointer" : "default" }}>
        <div className="fng-sub-hands">
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={leftCount} side="right" style={{ width: "100%", height: "100%" }} />
              {leftDot && (
                <div className="fng-gesture-overlay">
                  <GestureDot pos={leftDot.base} direction="up" onCommit={commit} />
                </div>
              )}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={rightCount} side="left" style={{ width: "100%", height: "100%" }} />
              {rightDot && (
                <div className="fng-gesture-overlay">
                  <GestureDot pos={rightDot.base} direction="up" onCommit={commit} />
                </div>
              )}
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
