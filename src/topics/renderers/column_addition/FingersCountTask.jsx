import React, { useState, useEffect, useRef } from "react";
import HandImg from "./HandImg.jsx";
import { getFingerConfig } from "./FingerSystem.js";
import "./fingers.css";

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
          <HandImg count={a} side="right" style={{ width: "100%", height: "100%" }} />
        </div>
        <div className={`fng-add-hand-r${handsMerged ? " fng-add-hand--merge" : ""}`}>
          <HandImg count={b} side="left"  style={{ width: "100%", height: "100%" }} />
        </div>
      </div>

      <div className="fng-add-kbd-zone">
        <div className="col-copy-keyboard"
             style={{ opacity: kbdVisible ? 1 : 0, pointerEvents: phase === "answer" ? "auto" : "none" }}>
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

// ── Shared gesture system (Subtraction + Large Addition) ──────────────────────

const GESTURE_THRESHOLD = 30; // px (~1 cm на планшете)

function GestureDot({ pos, direction, onCommit }) {
  const startRef = useRef(null);

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    startRef.current = { y: e.clientY };
  }

  function onPointerMove(e) {
    if (!startRef.current) return;
    const dy = e.clientY - startRef.current.y;
    if (direction === "down" && dy > GESTURE_THRESHOLD) {
      startRef.current = null;
      onCommit();
    } else if (direction === "up" && dy < -GESTURE_THRESHOLD) {
      startRef.current = null;
      onCommit();
    }
  }

  function onPointerUp() {
    startRef.current = null;
  }

  return (
    <div
      className={`fng-gesture-dot fng-gesture-dot--${direction}`}
      style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

function DrawnArrow({ tip, base, direction, onTap }) {
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
    if (dx < 15 && dy < 15) onTap();
    startRef.current = null;
  }

  if (direction === "down") {
    return (
      <svg
        viewBox="0 0 40 100"
        className="fng-sub-arrow fng-gesture-arrow"
        style={{ left: `${tip.x * 100}%`, top: `${tip.y * 100}%`, pointerEvents: "auto" }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <line x1="20" y1="2" x2="20" y2="68" stroke="white" strokeWidth="12" strokeLinecap="round" className="fng-stem-bg" />
        <line x1="20" y1="2" x2="20" y2="68" stroke="#ef4444" strokeWidth="7" strokeLinecap="round" className="fng-stem" />
        <polygon points="20,100 0,63 40,63" fill="white" className="fng-head-bg" />
        <polygon points="20,96 5,66 35,66" fill="#ef4444" className="fng-head" />
      </svg>
    );
  }

  // direction === "up"
  const h = base ? (base.y - tip.y) * 100 : 0;
  if (h <= 0) return null;
  return (
    <svg
      viewBox="0 0 40 100"
      className="fng-add-arrow fng-gesture-arrow"
      style={{ left: `${tip.x * 100}%`, top: `${tip.y * 100}%`, height: `${h}%`, pointerEvents: "auto" }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <polygon points="20,0 0,37 40,37" fill="white" className="fng-head-bg" />
      <polygon points="20,4 5,34 35,34" fill="#22c55e" className="fng-head" />
      <line x1="20" y1="98" x2="20" y2="32" stroke="white" strokeWidth="12" strokeLinecap="round" className="fng-stem-bg" />
      <line x1="20" y1="98" x2="20" y2="32" stroke="#22c55e" strokeWidth="7" strokeLinecap="round" className="fng-stem" />
    </svg>
  );
}

function GestureOverlay({ items, direction }) {
  const [committed, setCommitted] = useState(() => new Set());

  function commit(i) { setCommitted(s => new Set([...s, i])); }
  function revoke(i) { setCommitted(s => { const n = new Set(s); n.delete(i); return n; }); }

  return (
    <div className="fng-gesture-overlay">
      {items.map((item, i) => {
        const dotPos = direction === "down" ? item.tip : item.base;
        if (!dotPos) return null;
        return committed.has(i) ? (
          <DrawnArrow key={i} tip={item.tip} base={item.base} direction={direction} onTap={() => revoke(i)} />
        ) : (
          <GestureDot key={i} pos={dotPos} direction={direction} onCommit={() => commit(i)} />
        );
      })}
    </div>
  );
}

function Keyboard({ onDigit, onDelete, active }) {
  return (
    <div className="col-copy-keyboard" style={{ pointerEvents: active ? "auto" : "none" }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
        <button key={d} className="col-copy-kb-btn" onClick={() => onDigit(d)}>
          <span className="col-slant">{d}</span>
        </button>
      ))}
      <button className="col-copy-kb-btn col-copy-kb-del" onClick={onDelete}>⌫</button>
      <button className="col-copy-kb-btn" onClick={() => onDigit(0)}>
        <span className="col-slant">0</span>
      </button>
      <div />
    </div>
  );
}

// ── Subtraction ───────────────────────────────────────────────────────────────
// Flow: show (dots + Готово) → result [tap] → answer

const FINGER_TIPS_R = {
  1: [{ x: 0.375, y: 0.113 }],
  2: [{ x: 0.344, y: 0.151 }, { x: 0.555, y: 0.101 }],
  3: [{ x: 0.320, y: 0.159 }, { x: 0.531, y: 0.090 }, { x: 0.711, y: 0.152 }],
  4: [{ x: 0.344, y: 0.147 }, { x: 0.539, y: 0.104 }, { x: 0.719, y: 0.147 }, { x: 0.852, y: 0.272 }],
  5: [{ x: 0.148, y: 0.486 }, { x: 0.336, y: 0.174 }, { x: 0.523, y: 0.117 }, { x: 0.711, y: 0.161 }, { x: 0.867, y: 0.286 }],
};

const FOLD_ORDER = {
  1: [0],
  2: [1, 0],
  3: [2, 1, 0],
  4: [3, 2, 1, 0],
  5: [0, 4, 3, 2, 1],
};

// Knuckle positions of folded fingers when hand shows N raised fingers.
// Indexed [thumb=0, index=1, middle=2, ring=3, pinky=4]. null = finger is raised.
const FINGER_BASES_R = {
  0: [{ x: 0.494, y: 0.530 }, { x: 0.394, y: 0.550 }, { x: 0.431, y: 0.460 }, { x: 0.725, y: 0.540 }, { x: 0.619, y: 0.535 }],
  1: [{ x: 0.619, y: 0.542 }, null,                   { x: 0.719, y: 0.552 }, { x: 0.594, y: 0.462 }, { x: 0.513, y: 0.552 }],
  2: [{ x: 0.625, y: 0.484 }, null,                   null,                   { x: 0.594, y: 0.539 }, { x: 0.669, y: 0.594 }],
  3: [{ x: 0.606, y: 0.511 }, null,                   null,                   null,                   { x: 0.688, y: 0.531 }],
  4: [{ x: 0.488, y: 0.477 }, null,                   null,                   null,                   null                  ],
};

function removalTips(startCount, endCount) {
  const removeN = startCount - endCount;
  const order   = FOLD_ORDER[startCount] ?? [];
  const tips    = FINGER_TIPS_R[startCount] ?? [];
  return order.slice(0, removeN).map(i => tips[i]).filter(Boolean);
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

  useEffect(() => {
    setPhase("show"); setInput([]); setShake(false);
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

  const leftTips   = removalTips(leftStart, leftEnd);
  const rightTipsR = removalTips(rightStart, rightEnd);
  const rightTips  = [...rightTipsR].reverse().map(t => ({ x: 1 - t.x, y: t.y }));

  const leftItems  = leftTips.map(tip => ({ tip, base: null }));
  const rightItems = rightTips.map(tip => ({ tip, base: null }));

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
              <HandImg count={leftCount}  side="right" style={{ width: "100%", height: "100%" }} />
              {phase === "show" && leftItems.length > 0 && (
                <GestureOverlay key={task.cardId + "-L"} items={leftItems} direction="down" />
              )}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <HandImg count={rightCount} side="left"  style={{ width: "100%", height: "100%" }} />
              {phase === "show" && rightItems.length > 0 && (
                <GestureOverlay key={task.cardId + "-R"} items={rightItems} direction="down" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fng-add-kbd-zone fng-kbd-relative">
        <div style={{ opacity: kbdVisible ? 1 : 0, transition: "opacity 0.3s ease" }}>
          <Keyboard onDigit={handleDigit} onDelete={handleDelete} active={phase === "answer"} />
        </div>
        {phase === "show" && (
          <div className="fng-ready-zone">
            <button className="fng-ready-btn" onClick={() => setPhase("result")}>Готово</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Large Addition (a > 5 or b > 5) ──────────────────────────────────────────
// Flow: show (dots + Готово) → result [tap] → answer

function LargeAdditionTask({ task, onCorrect, onMistake }) {
  const [phase, setPhase] = useState("show");
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);

  const { a, b, result } = task;
  const resultStr = String(result);
  const aConfig   = getFingerConfig(a);
  const resConfig = getFingerConfig(result);

  useEffect(() => {
    setPhase("show"); setInput([]); setShake(false);
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
              <HandImg count={leftCount}  side="right" style={{ width: "100%", height: "100%" }} />
              {phase === "show" && leftItems.length > 0 && (
                <GestureOverlay key={task.cardId + "-L"} items={leftItems} direction="up" />
              )}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <HandImg count={rightCount} side="left"  style={{ width: "100%", height: "100%" }} />
              {phase === "show" && rightItems.length > 0 && (
                <GestureOverlay key={task.cardId + "-R"} items={rightItems} direction="up" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="fng-add-kbd-zone fng-kbd-relative">
        <div style={{ opacity: kbdVisible ? 1 : 0, transition: "opacity 0.3s ease" }}>
          <Keyboard onDigit={handleDigit} onDelete={handleDelete} active={phase === "answer"} />
        </div>
        {phase === "show" && (
          <div className="fng-ready-zone">
            <button className="fng-ready-btn" onClick={() => setPhase("result")}>Готово</button>
          </div>
        )}
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
