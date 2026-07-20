import React, { useState, useEffect, useRef, useId } from "react";
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

// ── Addition (a ≤ 5 and b ≤ 5) ───────────────────────────────────────────────
// Flow: show → [tap] → answer (merge animation plays)

function AdditionTask({ task, onCorrect, onMistake }) {
  const [phase, setPhase] = useState("show");
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);

  const { a, b, result } = task;
  const resultStr = String(result);

  useEffect(() => {
    setPhase("show"); setInput([]); setShake(false);
  }, [task.cardId]);

  function advance() {
    if (phase === "show") setPhase("answer");
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
    phase === "show"    ? "Сделай так →" :
    "Введи ответ";

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  const kbdVisible  = phase === "answer" || phase === "done";
  const handsMerged = phase !== "show";
  const tappable    = phase === "show";

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top" onClick={advance} style={{ cursor: tappable ? "pointer" : "default" }}>
        <div className="fng-count-expr">{a} + {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      <div className="fng-add-hands-zone" onClick={advance}
           style={{ cursor: tappable ? "pointer" : "default" }}>
        <div className={`fng-add-hand-l${handsMerged ? " fng-add-hand--merge" : ""}`}>
          <AnimatedHand count={a} side="right" style={{ width: "100%", height: "100%" }} />
        </div>
        <div className={`fng-add-hand-r${handsMerged ? " fng-add-hand--merge" : ""}`}>
          <AnimatedHand count={b} side="left"  style={{ width: "100%", height: "100%" }} />
        </div>
      </div>

      <div className="fng-add-kbd-zone" style={{ opacity: kbdVisible ? 1 : 0, transition: "opacity 0.3s ease" }}>
        <FingersKeypad onDigit={handleDigit} onDelete={handleDelete} active={phase === "answer"} />
      </div>
    </div>
  );
}

// ── Shared gesture system (Subtraction + Large Addition) ──────────────────────
// A tap commits a dot (color still marks intent: red = removing, green =
// adding) — direction/distance used to matter here, but nothing distinguished
// "how far" a correct drag was from an accidental one, so a plain tap (same
// dx/dy<15 detection DrawnArrow already uses to tell a tap from a drag) is
// both simpler to discover and impossible to get "wrong length" on.

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

const ARROW_CANVAS_W = 256;
const ARROW_CANVAS_H = 320;

// Curved path between the two REAL points (not just a vertical line anchored
// at one of them) — a straight line that only follows tip.y-base.y and
// ignores any x-difference visibly misses its target whenever a finger
// doesn't fold/unfold perfectly vertically (most of them don't). Bulges
// outward from the hand's centerline for a natural, non-robotic curve,
// matching the technique proved out in the finger-raise mockups.
function curvedArrowPath(from, to) {
  const fx = from.x * ARROW_CANVAS_W, fy = from.y * ARROW_CANVAS_H;
  const tx = to.x * ARROW_CANVAS_W, ty = to.y * ARROW_CANVAS_H;
  const mx = (fx + tx) / 2, my = (fy + ty) / 2;
  const dx = tx - fx, dy = ty - fy;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (Math.abs(mx + nx * 10 - ARROW_CANVAS_W / 2) < Math.abs(mx - ARROW_CANVAS_W / 2)) {
    nx = -nx; ny = -ny;
  }
  const bulge = Math.min(len * 0.35, 45);
  const cx = mx + nx * bulge, cy = my + ny * bulge;
  return `M ${fx} ${fy} Q ${cx} ${cy} ${tx} ${ty}`;
}

function DrawnArrow({ tip, base, direction, onTap, order }) {
  const startRef = useRef(null);
  const markerId = useId();
  const showBadge = order != null;

  if (!base) return null;

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    startRef.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e) {
    if (!startRef.current) return;
    const dx = Math.abs(e.clientX - startRef.current.x);
    const dy = Math.abs(e.clientY - startRef.current.y);
    if (dx < 15 && dy < 15) onTap();
    startRef.current = null;
  }

  const color = direction === "down" ? "#ef4444" : "#22c55e";
  const from = direction === "down" ? tip : base;
  const to   = direction === "down" ? base : tip;
  const d = curvedArrowPath(from, to);
  const badgeAt = direction === "down" ? tip : base; // same point the dot sat on

  return (
    <>
      <svg
        viewBox={`0 0 ${ARROW_CANVAS_W} ${ARROW_CANVAS_H}`}
        className={`fng-gesture-arrow ${direction === "down" ? "fng-sub-arrow" : "fng-add-arrow"}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "auto" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <defs>
          <marker id={markerId} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 Z" fill={color} />
          </marker>
        </defs>
        <path d={d} className="fng-arrow-halo" />
        <path d={d} className="fng-arrow-line" style={{ stroke: color }} markerEnd={`url(#${markerId})`} />
      </svg>
      {showBadge && (
        <div className={`fng-gesture-badge fng-gesture-badge--${direction}`} style={{ left: `${badgeAt.x * 100}%`, top: `${badgeAt.y * 100}%` }}>
          {order}
        </div>
      )}
    </>
  );
}

// Controlled by the parent task (not self-contained state) so it can tell
// when every dot across BOTH hands has been resolved and advance on its own —
// see the "auto-advance once fully committed" effect in SubtractionTask /
// LargeAdditionTask.
function GestureOverlay({ items, direction, committed, onCommit, onRevoke }) {
  const multi = items.length > 1;

  return (
    <div className="fng-gesture-overlay">
      {items.map((item, i) => {
        const dotPos = direction === "down" ? item.tip : item.base;
        if (!dotPos) return null;
        return committed.has(i) ? (
          <DrawnArrow
            key={i}
            tip={item.tip}
            base={item.base}
            direction={direction}
            onTap={() => onRevoke(i)}
            order={multi ? i + 1 : null}
          />
        ) : (
          <GestureDot key={i} pos={dotPos} direction={direction} onCommit={() => onCommit(i)} />
        );
      })}
    </div>
  );
}

// ── Subtraction ───────────────────────────────────────────────────────────────
// Flow: show (tap the dots) → auto-advance → result [tap] → answer

const FOLD_ORDER = {
  1: [0],
  2: [1, 0],
  3: [2, 1, 0],
  4: [3, 2, 1, 0],
  5: [0, 4, 3, 2, 1],
};

function removalTips(startCount, endCount) {
  const removeN = startCount - endCount;
  const order   = FOLD_ORDER[startCount] ?? [];
  const tips    = FINGER_TIPS_R[startCount] ?? [];
  return order.slice(0, removeN).map(i => tips[i]).filter(Boolean);
}

// Landing knuckle position for each removed finger — where it ends up once
// folded, i.e. its base in the END state. Mirrors additionBases' index-shift
// (FINGER_TIPS_R skips the thumb unless the pose is a full 5).
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

// Returns knuckle positions for fingers being raised from startCount to endCount.
// For endCount<5: FINGER_TIPS_R indices skip thumb, so shift base index by +1.
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

function SubtractionTask({ task, onCorrect, onMistake }) {
  const [phase, setPhase] = useState("show");
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);

  const { a, b, result } = task;
  const resultStr    = String(result);
  const startConfig  = getFingerConfig(a);
  const resultConfig = getFingerConfig(result);
  const [committedLeft, setCommittedLeft]   = useState(() => new Set());
  const [committedRight, setCommittedRight] = useState(() => new Set());

  useEffect(() => {
    setPhase("show"); setInput([]); setShake(false);
    setCommittedLeft(new Set()); setCommittedRight(new Set());
  }, [task.cardId]);

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
    phase === "show"   ? "Было →" :
    phase === "result" ? "Стало →" :
    "Введи ответ";

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  const leftStart  = startConfig.left;
  const leftEnd    = resultConfig.left;
  const rightStart = startConfig.right;
  const rightEnd   = resultConfig.right;

  const leftCount  = phase === "show" ? leftStart  : leftEnd;
  const rightCount = phase === "show" ? rightStart : rightEnd;
  const kbdVisible = phase === "answer" || phase === "done";
  const tappable   = phase === "result";

  const leftTipsArr   = removalTips(leftStart, leftEnd);
  const leftBasesArr  = removalBases(leftStart, leftEnd);
  const leftItems     = leftTipsArr.map((tip, i) => ({ tip, base: leftBasesArr[i] ?? null })).filter(item => item.base);

  const rightTipsArrR  = removalTips(rightStart, rightEnd);
  const rightBasesArrR = removalBases(rightStart, rightEnd);
  const rightItems     = [...Array(rightTipsArrR.length).keys()]
    .reverse()
    .map(origIdx => ({
      tip:  { x: 1 - rightTipsArrR[origIdx].x,  y: rightTipsArrR[origIdx].y },
      base: rightBasesArrR[origIdx] ? { x: 1 - rightBasesArrR[origIdx].x, y: rightBasesArrR[origIdx].y } : null,
    }))
    .filter(item => item.base);

  const totalItems     = leftItems.length + rightItems.length;
  const totalCommitted = committedLeft.size + committedRight.size;

  // Once every dot's been tapped, move on by itself — no separate "done"
  // button to hunt for once the hands already show the change happened.
  useEffect(() => {
    if (phase !== "show" || totalItems === 0 || totalCommitted < totalItems) return;
    const t = setTimeout(() => setPhase("result"), 500);
    return () => clearTimeout(t);
  }, [phase, totalCommitted, totalItems]);

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top"
           onClick={tappable ? () => setPhase("answer") : undefined}
           style={{ cursor: tappable ? "pointer" : "default" }}>
        <div className="fng-count-expr">{a} − {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      <div className="fng-add-hands-zone"
           onClick={tappable ? () => setPhase("answer") : undefined}
           style={{ cursor: tappable ? "pointer" : "default" }}>
        <div className="fng-sub-hands">
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={leftCount}  side="right" style={{ width: "100%", height: "100%" }} />
              {phase === "show" && leftItems.length > 0 && (
                <GestureOverlay
                  key={task.cardId + "-L"}
                  items={leftItems}
                  direction="down"
                  committed={committedLeft}
                  onCommit={(i) => setCommittedLeft(s => new Set([...s, i]))}
                  onRevoke={(i) => setCommittedLeft(s => { const n = new Set(s); n.delete(i); return n; })}
                />
              )}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={rightCount} side="left"  style={{ width: "100%", height: "100%" }} />
              {phase === "show" && rightItems.length > 0 && (
                <GestureOverlay
                  key={task.cardId + "-R"}
                  items={rightItems}
                  direction="down"
                  committed={committedRight}
                  onCommit={(i) => setCommittedRight(s => new Set([...s, i]))}
                  onRevoke={(i) => setCommittedRight(s => { const n = new Set(s); n.delete(i); return n; })}
                />
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

// ── Large Addition (a > 5 or b > 5) ──────────────────────────────────────────
// Flow: show (tap the dots) → auto-advance → result [tap] → answer

function LargeAdditionTask({ task, onCorrect, onMistake }) {
  const [phase, setPhase] = useState("show");
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);

  const { a, b, result } = task;
  const resultStr = String(result);
  const aConfig   = getFingerConfig(a);
  const resConfig = getFingerConfig(result);

  const [committedLeft, setCommittedLeft]   = useState(() => new Set());
  const [committedRight, setCommittedRight] = useState(() => new Set());

  useEffect(() => {
    setPhase("show"); setInput([]); setShake(false);
    setCommittedLeft(new Set()); setCommittedRight(new Set());
  }, [task.cardId]);

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
    phase === "show"   ? `Было ${a} →` :
    phase === "result" ? "Стало →" :
    "Введи ответ";

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  const leftStart  = aConfig.left;
  const leftEnd    = resConfig.left;
  const rightStart = aConfig.right;
  const rightEnd   = resConfig.right;

  const leftCount  = phase === "show" ? leftStart  : leftEnd;
  const rightCount = phase === "show" ? rightStart : rightEnd;
  const kbdVisible = phase === "answer" || phase === "done";
  const tappable   = phase === "result";

  // Addition gesture: dot at knuckle (base), arrow grows up to fingertip
  const leftTipsArr   = additionTips(leftStart, leftEnd);
  const leftBasesArr  = additionBases(leftStart, leftEnd);
  const leftItems     = leftTipsArr.map((tip, i) => ({ tip, base: leftBasesArr[i] ?? null })).filter(item => item.base);

  const rightTipsArrR  = additionTips(rightStart, rightEnd);
  const rightBasesArrR = additionBases(rightStart, rightEnd);
  const rightItems     = [...Array(rightTipsArrR.length).keys()]
    .reverse()
    .map(origIdx => ({
      tip:  { x: 1 - rightTipsArrR[origIdx].x,  y: rightTipsArrR[origIdx].y },
      base: rightBasesArrR[origIdx] ? { x: 1 - rightBasesArrR[origIdx].x, y: rightBasesArrR[origIdx].y } : null,
    }))
    .filter(item => item.base);

  const totalItems     = leftItems.length + rightItems.length;
  const totalCommitted = committedLeft.size + committedRight.size;

  // Once every dot's been tapped, move on by itself — no separate "done"
  // button to hunt for once the hands already show the change happened.
  useEffect(() => {
    if (phase !== "show" || totalItems === 0 || totalCommitted < totalItems) return;
    const t = setTimeout(() => setPhase("result"), 500);
    return () => clearTimeout(t);
  }, [phase, totalCommitted, totalItems]);

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top"
           onClick={tappable ? () => setPhase("answer") : undefined}
           style={{ cursor: tappable ? "pointer" : "default" }}>
        <div className="fng-count-expr">{a} + {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      <div className="fng-add-hands-zone"
           onClick={tappable ? () => setPhase("answer") : undefined}
           style={{ cursor: tappable ? "pointer" : "default" }}>
        <div className="fng-sub-hands">
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={leftCount}  side="right" style={{ width: "100%", height: "100%" }} />
              {phase === "show" && leftItems.length > 0 && (
                <GestureOverlay
                  key={task.cardId + "-L"}
                  items={leftItems}
                  direction="up"
                  committed={committedLeft}
                  onCommit={(i) => setCommittedLeft(s => new Set([...s, i]))}
                  onRevoke={(i) => setCommittedLeft(s => { const n = new Set(s); n.delete(i); return n; })}
                />
              )}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={rightCount} side="left"  style={{ width: "100%", height: "100%" }} />
              {phase === "show" && rightItems.length > 0 && (
                <GestureOverlay
                  key={task.cardId + "-R"}
                  items={rightItems}
                  direction="up"
                  committed={committedRight}
                  onCommit={(i) => setCommittedRight(s => new Set([...s, i]))}
                  onRevoke={(i) => setCommittedRight(s => { const n = new Set(s); n.delete(i); return n; })}
                />
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
  if (task.op === "add" && (task.a > 5 || task.b > 5)) {
    return <LargeAdditionTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
  }
  return <AdditionTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
}
