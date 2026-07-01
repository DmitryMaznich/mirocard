import React, { useState, useEffect } from "react";
import HandImg from "./HandImg.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import "./fingers.css";

// Shows count fingers on one or two HandImg components.
// side = dominant side for the zone ("right" for left zone, "left" for right zone).
// For count ≤ 5: single hand. For count > 5: two hands (overflow | main).
function HandGroup({ count, side, style }) {
  const config = getFingerConfig(count);
  if (config.left === 0) {
    return <HandImg count={count} side={side} style={style} />;
  }
  // Show overflow hand + full hand side-by-side within the zone.
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", gap: 4, alignItems: "center" }}>
      <HandImg count={config.left} side={side} style={{ flex: 1, height: "100%" }} />
      <HandImg count={config.right} side={side} style={{ flex: 1, height: "100%" }} />
    </div>
  );
}

// ── Addition ──────────────────────────────────────────────────────────────────
// Three fixed zones, always in DOM — only opacity changes so layout never shifts.
// Flow: show (3s) → merge (0.9s, hands close + kbd fades in) → answer → done

function AdditionTask({ task, onCorrect, onMistake }) {
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
      onMistake?.();
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
          <HandGroup count={a} side="right" style={{ width: "100%", height: "100%" }} />
        </div>
        <div className={`fng-add-hand-r${handsMerged ? " fng-add-hand--merge" : ""}`}>
          <HandGroup count={b} side="left"  style={{ width: "100%", height: "100%" }} />
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

// Precise (x, y) tip of each raised finger in hand_right_N.png, as fractions
// of the 256×320 canvas. Measured by alpha-scan (scripts/find-finger-tips.mjs).
// Sorted LEFT → RIGHT in image: index 0 = pinky, index 4 = thumb.
// For hand_left (mirrored screen): x_L = 1 - x_R, array reversed.
const FINGER_TIPS_R = {
  1: [{ x: 0.369, y: 0.053 }],
  2: [{ x: 0.273, y: 0.050 }, { x: 0.523, y: 0.006 }],
  3: [{ x: 0.279, y: 0.109 }, { x: 0.500, y: 0.066 }, { x: 0.705, y: 0.116 }],
  4: [{ x: 0.207, y: 0.069 }, { x: 0.424, y: 0.000 }, { x: 0.629, y: 0.050 }, { x: 0.799, y: 0.184 }],
  5: [{ x: 0.158, y: 0.381 }, { x: 0.375, y: 0.075 }, { x: 0.547, y: 0.025 }, { x: 0.711, y: 0.069 }, { x: 0.846, y: 0.191 }],
};

// Pedagogical fold order — indices into FINGER_TIPS_R[count].
// For 1-4 fingers (no thumb in image): fold from rightmost (pinky side) inward.
//   index 0 = leftmost = index finger; index N-1 = rightmost = pinky.
// For 5 fingers (thumb included): fold thumb first, then pinky inward.
const FOLD_ORDER = {
  1: [0],
  2: [1, 0],
  3: [2, 1, 0],
  4: [3, 2, 1, 0],
  5: [0, 4, 3, 2, 1],
};

// Returns tips of fingers to mark for removal in hand_right image space.
function removalTips(startCount, endCount) {
  const removeN = startCount - endCount;
  const order   = FOLD_ORDER[startCount] ?? [];
  const tips    = FINGER_TIPS_R[startCount] ?? [];
  return order.slice(0, removeN).map(i => tips[i]).filter(Boolean);
}

function SubtractionTask({ task, onCorrect, onMistake }) {
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
      onMistake?.();
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

  // Removal tips: {x,y} for each finger that disappears.
  // Left screen uses hand_right images directly; right screen is mirrored (x → 1-x, reversed).
  const leftTips   = removalTips(leftStart, leftEnd);
  const rightTipsR = removalTips(rightStart, rightEnd);
  const rightTips  = [...rightTipsR].reverse().map(t => ({ x: 1 - t.x, y: t.y }));

  // Arrow overlay: SVG arrow grows from finger tip downward.
  // viewBox 0 0 40 100: stem y2=2..68 (len=66), head 68..100.
  function makeOverlay(tips) {
    if (!tips.length) return null;
    return (
      <div className="fng-sub-finger-overlay">
        {tips.map((tip, i) => (
          <svg key={i} viewBox="0 0 40 100"
               className="fng-sub-arrow"
               style={{ left: `${tip.x * 100}%`, top: `${tip.y * 100}%` }}>
            {/* white border behind stem */}
            <line x1="20" y1="2" x2="20" y2="68"
                  stroke="white" strokeWidth="12" strokeLinecap="round"
                  className="fng-stem-bg" />
            {/* red stem draws itself top→bottom */}
            <line x1="20" y1="2" x2="20" y2="68"
                  stroke="#ef4444" strokeWidth="7" strokeLinecap="round"
                  className="fng-stem" />
            {/* white arrowhead border */}
            <polygon points="20,100 0,63 40,63" fill="white" className="fng-head-bg" />
            {/* red arrowhead */}
            <polygon points="20,96 5,66 35,66" fill="#ef4444" className="fng-head" />
          </svg>
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
            <div className="fng-sub-hand-inner">
              <HandImg count={leftCount}  side="right" style={{ width: "100%", height: "100%" }} />
              {phase === "remove" && makeOverlay(leftTips)}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <HandImg count={rightCount} side="left"  style={{ width: "100%", height: "100%" }} />
              {phase === "remove" && makeOverlay(rightTips)}
            </div>
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

export default function FingersCountTask({ task, onCorrect, onMistake }) {
  if (task.op === "sub") {
    return <SubtractionTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
  }
  return <AdditionTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
}
