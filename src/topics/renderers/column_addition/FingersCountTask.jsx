import React, { useState, useEffect } from "react";
import HandImg from "./HandImg.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import "./fingers.css";

// ── Addition ──────────────────────────────────────────────────────────────────
// Three fixed zones, always in DOM — only opacity changes so layout never shifts.
// Flow: show (3s) → merge (0.9s, hands close + kbd fades in) → answer → done

function AdditionTask({ task, onCorrect }) {
  const [phase, setPhase] = useState("show");
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);

  const { a, b, result } = task;
  const resultStr = String(result);

  useEffect(() => {
    setPhase("show"); setInput([]); setShake(false);
  }, [task.cardId]);

  useEffect(() => {
    if (phase !== "show") return;
    const t = setTimeout(() => setPhase("merge"), 3000);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "merge") return;
    const t = setTimeout(() => setPhase("answer"), 900);
    return () => clearTimeout(t);
  }, [phase]);

  function handleDigit(d) {
    if (phase !== "answer" || shake) return;
    const next = [...input, String(d)];
    if (next.length < resultStr.length) { setInput(next); return; }
    if (Number(next.join("")) === result) {
      setPhase("done"); setTimeout(() => onCorrect(), 700);
    } else {
      setShake(true); setTimeout(() => { setShake(false); setInput([]); }, 500);
    }
  }

  function handleDelete() { if (shake) return; setInput(p => p.slice(0, -1)); }

  const hint =
    phase === "show"  ? "Сделай так" :
    phase === "merge" ? "Соедини руки" :
    "Введи ответ";

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : (phase === "answer" || phase === "done")
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  const kbdVisible  = phase === "merge" || phase === "answer" || phase === "done";
  const handsMerged = phase !== "show";

  return (
    <div className="fng-add-screen">
      {/* Zone 1 — expression + instruction (fixed, flex-shrink: 0) */}
      <div className="fng-add-top">
        <div className="fng-count-expr">{a} + {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      {/* Zone 2 — hands (always visible; merged position stays during answer) */}
      <div className="fng-add-hands-zone">
        <div className={`fng-add-hand-l${handsMerged ? " fng-add-hand--merge" : ""}`}>
          <HandImg count={a} side="right" style={{ width: "100%", height: "100%" }} />
        </div>
        <div className={`fng-add-hand-r${handsMerged ? " fng-add-hand--merge" : ""}`}>
          <HandImg count={b} side="left"  style={{ width: "100%", height: "100%" }} />
        </div>
      </div>

      {/* Zone 3 — keyboard (flex-shrink: 0, always reserves space at bottom) */}
      <div className="fng-add-kbd-zone" style={{ opacity: kbdVisible ? 1 : 0 }}>
        <div className="col-copy-keyboard"
             style={{ pointerEvents: phase === "answer" ? "auto" : "none" }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
            <button key={d} className="col-copy-kb-btn" onClick={() => handleDigit(d)}>
              <span className="col-slant">{d}</span>
            </button>
          ))}
          <button className="col-copy-kb-btn col-copy-kb-del" onClick={handleDelete}>⌫</button>
          <button className="col-copy-kb-btn" onClick={() => handleDigit(0)}>
            <span className="col-slant">0</span>
          </button>
          <div />
        </div>
      </div>
    </div>
  );
}

// ── Subtraction ───────────────────────────────────────────────────────────────
// Three steps: "Было" (a fingers) → "Убираем" (b arrows ↓) → "Стало" (result fingers)
// Flow: show (2.5s) → remove (2s) → result (1.2s) → answer → done

// X positions of each finger as fraction of image width (256px canvas).
// Fingers are numbered 1..5 in counting order (1st raised → 5th raised).
// hand_right images: thumb on LEFT → counting goes left-to-right (thumb first).
// hand_left  images: mirror of right → thumb on RIGHT, positions reversed.
// If the actual images use a different counting order, swap the array values.
const FINGER_XS = {
  right: [0.25, 0.36, 0.48, 0.60, 0.73], // [1st…5th], leftmost→rightmost
  left:  [0.75, 0.64, 0.52, 0.40, 0.27], // mirrored: rightmost→leftmost
};

function SubtractionTask({ task, onCorrect }) {
  const [phase, setPhase] = useState("show");
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);

  const { a, b, result } = task;
  const resultStr   = String(result);
  const startConfig  = getFingerConfig(a);
  const resultConfig = getFingerConfig(result);

  useEffect(() => {
    setPhase("show"); setInput([]); setShake(false);
  }, [task.cardId]);

  useEffect(() => {
    if (phase !== "show")   return;
    const t = setTimeout(() => setPhase("remove"), 2500);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "remove") return;
    const t = setTimeout(() => setPhase("result"), 2000);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "result") return;
    const t = setTimeout(() => setPhase("answer"), 1200);
    return () => clearTimeout(t);
  }, [phase]);

  function handleDigit(d) {
    if (phase !== "answer" || shake) return;
    const next = [...input, String(d)];
    if (next.length < resultStr.length) { setInput(next); return; }
    if (Number(next.join("")) === result) {
      setPhase("done"); setTimeout(() => onCorrect(), 700);
    } else {
      setShake(true); setTimeout(() => { setShake(false); setInput([]); }, 500);
    }
  }

  function handleDelete() { if (shake) return; setInput(p => p.slice(0, -1)); }

  const hint =
    phase === "show"   ? "Было" :
    phase === "remove" ? `Убираем ${b}` :
    phase === "result" ? "Стало" :
    "Введи ответ";

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  // Per-hand removal counts via startConfig vs resultConfig.
  // This correctly places arrows on each hand that actually loses fingers
  // (e.g. 4−2=2: each hand goes 2→1, one arrow per hand, not two on one).
  const leftStart  = startConfig.left;
  const leftEnd    = resultConfig.left;
  const rightStart = startConfig.right;
  const rightEnd   = resultConfig.right;

  // counts: "show" and "remove" phases → a fingers; "result"+ → result fingers
  const leftCount  = (phase === "show" || phase === "remove") ? leftStart  : leftEnd;
  const rightCount = (phase === "show" || phase === "remove") ? rightStart : rightEnd;
  const kbdVisible = phase === "answer" || phase === "done";

  // X positions of removed fingers per hand.
  // Screen-left uses hand_right images (FINGER_XS.right); screen-right uses hand_left (FINGER_XS.left).
  // slice(end, start) = the fingers with indices end..start-1 = those that disappear.
  const leftArrowXs  = FINGER_XS.right.slice(leftEnd,  leftStart);
  const rightArrowXs = FINGER_XS.left.slice(rightEnd, rightStart);

  function makeOverlay(xs) {
    if (!xs.length) return null;
    return (
      <div className="fng-sub-finger-overlay">
        {xs.map((x, i) => (
          <span key={i} className="fng-sub-arrow" style={{ left: `${x * 100}%` }}>↓</span>
        ))}
      </div>
    );
  }

  return (
    <div className="fng-add-screen">
      {/* Zone 1 — expression + hint */}
      <div className="fng-add-top">
        <div className="fng-count-expr">{a} − {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      {/* Zone 2 — hands; each hand gets arrows only for fingers it loses */}
      <div className="fng-add-hands-zone">
        <div className="fng-sub-hands">
          <div className="fng-sub-hand-wrap">
            {phase === "remove" && makeOverlay(leftArrowXs)}
            <HandImg count={leftCount}  side="right" style={{ width: "100%", height: "100%" }} />
          </div>
          <div className="fng-sub-hand-wrap">
            {phase === "remove" && makeOverlay(rightArrowXs)}
            <HandImg count={rightCount} side="left"  style={{ width: "100%", height: "100%" }} />
          </div>
        </div>
      </div>

      {/* Zone 3 — keyboard */}
      <div className="fng-add-kbd-zone" style={{ opacity: kbdVisible ? 1 : 0 }}>
        <div className="col-copy-keyboard"
             style={{ pointerEvents: phase === "answer" ? "auto" : "none" }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
            <button key={d} className="col-copy-kb-btn" onClick={() => handleDigit(d)}>
              <span className="col-slant">{d}</span>
            </button>
          ))}
          <button className="col-copy-kb-btn col-copy-kb-del" onClick={handleDelete}>⌫</button>
          <button className="col-copy-kb-btn" onClick={() => handleDigit(0)}>
            <span className="col-slant">0</span>
          </button>
          <div />
        </div>
      </div>
    </div>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export default function FingersCountTask({ task, onCorrect }) {
  if (task.op === "sub") {
    return <SubtractionTask task={task} onCorrect={onCorrect} />;
  }
  return <AdditionTask task={task} onCorrect={onCorrect} />;
}
