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
// "было" → "стало" без анимации пальцев.
// Fold mode: result пальцев solid + b пальцев ghost (HandImg ghost prop).
// Hand mode: оставшаяся рука solid, убранная рука 28% opacity.
// Flow: show (2.5s) → fold (1.5s, shows "стало") → answer → done

function SubtractionTask({ task, onCorrect }) {
  const [phase, setPhase] = useState("show");
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);

  const { a, b, result, removeMode, removeHand } = task;
  const resultStr   = String(result);
  const startConfig = getFingerConfig(a);

  useEffect(() => {
    setPhase("show"); setInput([]); setShake(false);
  }, [task.cardId]);

  useEffect(() => {
    if (phase !== "show") return;
    const t = setTimeout(() => setPhase("fold"), 2500);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fold") return;
    const t = setTimeout(() => setPhase("answer"), 1500);
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

  // ── Compute what to display on each hand ─────────────────────────
  let leftCount = startConfig.left,  rightCount = startConfig.right;
  let leftGhost = 0,                 rightGhost = 0;
  let leftOpacity = 1,               rightOpacity = 1;

  if (phase !== "show") {
    if (removeMode === "fold") {
      if (startConfig.right >= startConfig.left) {
        // remove b fingers from the right (larger) hand
        rightCount = startConfig.right - b;
        rightGhost = b;
      } else {
        leftCount = startConfig.left - b;
        leftGhost = b;
      }
    } else {
      // hand mode: removed hand shown at 28% with original count
      if (removeHand === "left") {
        leftOpacity  = 0.28;
        rightCount   = startConfig.right;   // remaining hand unchanged visually
      } else {
        rightOpacity = 0.28;
        leftCount    = startConfig.left;
      }
    }
  }

  // ── Hints ────────────────────────────────────────────────────────
  const hint =
    phase === "show" ? "Сделай так" :
    phase === "fold" ? (removeMode === "fold" ? `Загнули ${b}` : "Убрали руку") :
    "Введи ответ";

  // ── Answer display in expression ─────────────────────────────────
  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  const kbdVisible = phase === "answer" || phase === "done";

  return (
    <div className="fng-add-screen">
      {/* Zone 1 — expression + hint */}
      <div className="fng-add-top">
        <div className="fng-count-expr">{a} − {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      {/* Zone 2 — hands (flex, no merge animation for subtraction) */}
      <div className="fng-add-hands-zone">
        <div className="fng-sub-hands">
          <div style={{ flex: 1, minWidth: 0, height: "100%", opacity: leftOpacity,
                        transition: "opacity 0.4s ease" }}>
            <HandImg count={leftCount}  ghost={leftGhost}
                     side="right" style={{ width: "100%", height: "100%" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0, height: "100%", opacity: rightOpacity,
                        transition: "opacity 0.4s ease" }}>
            <HandImg count={rightCount} ghost={rightGhost}
                     side="left"  style={{ width: "100%", height: "100%" }} />
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
