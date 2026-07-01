import React, { useState, useEffect } from "react";
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
// Flow: show → [tap] → remove (arrows) → [tap] → result → [tap] → answer

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

  function advance() {
    if (phase === "show")   { setPhase("remove"); return; }
    if (phase === "remove") { setPhase("result"); return; }
    if (phase === "result") { setPhase("answer"); return; }
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
    phase === "show"   ? "Было →" :
    phase === "remove" ? `Убираем ${b} →` :
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

  const leftCount  = (phase === "show" || phase === "remove") ? leftStart  : leftEnd;
  const rightCount = (phase === "show" || phase === "remove") ? rightStart : rightEnd;
  const kbdVisible = phase === "answer" || phase === "done";
  const tappable   = phase !== "answer" && phase !== "done";

  const leftTips   = removalTips(leftStart, leftEnd);
  const rightTipsR = removalTips(rightStart, rightEnd);
  const rightTips  = [...rightTipsR].reverse().map(t => ({ x: 1 - t.x, y: t.y }));

  function makeOverlay(tips) {
    if (!tips.length) return null;
    return (
      <div className="fng-sub-finger-overlay">
        {tips.map((tip, i) => (
          <svg key={i} viewBox="0 0 40 100" className="fng-sub-arrow"
               style={{ left: `${tip.x * 100}%`, top: `${tip.y * 100}%` }}>
            <line x1="20" y1="2" x2="20" y2="68" stroke="white" strokeWidth="12" strokeLinecap="round" className="fng-stem-bg" />
            <line x1="20" y1="2" x2="20" y2="68" stroke="#ef4444" strokeWidth="7" strokeLinecap="round" className="fng-stem" />
            <polygon points="20,100 0,63 40,63" fill="white" className="fng-head-bg" />
            <polygon points="20,96 5,66 35,66" fill="#ef4444" className="fng-head" />
          </svg>
        ))}
      </div>
    );
  }

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top" onClick={advance} style={{ cursor: tappable ? "pointer" : "default" }}>
        <div className="fng-count-expr">{a} − {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      <div className="fng-add-hands-zone" onClick={advance}
           style={{ cursor: tappable ? "pointer" : "default" }}>
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

// ── Large Addition (a > 5 or b > 5) ──────────────────────────────────────────
// Flow: show → [tap] → add (arrows) → [tap] → result → [tap] → answer

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

  function advance() {
    if (phase === "show")   { setPhase("add");    return; }
    if (phase === "add")    { setPhase("result"); return; }
    if (phase === "result") { setPhase("answer"); return; }
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
    phase === "show"   ? `Было ${a} →` :
    phase === "add"    ? `Добавляем ${b} →` :
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

  const leftCount  = (phase === "show" || phase === "add") ? leftStart  : leftEnd;
  const rightCount = (phase === "show" || phase === "add") ? rightStart : rightEnd;
  const kbdVisible = phase === "answer" || phase === "done";
  const tappable   = phase !== "answer" && phase !== "done";

  const leftTips   = additionTips(leftStart, leftEnd);
  const rightTipsR = additionTips(rightStart, rightEnd);
  const rightTips  = [...rightTipsR].reverse().map(t => ({ x: 1 - t.x, y: t.y }));

  function makeAddOverlay(tips) {
    if (!tips.length) return null;
    return (
      <div className="fng-sub-finger-overlay">
        {tips.map((tip, i) => (
          <svg key={i} viewBox="0 0 40 100" className="fng-add-arrow"
               style={{ left: `${tip.x * 100}%`, top: `${tip.y * 100}%` }}>
            <polygon points="20,0 0,37 40,37" fill="white" className="fng-head-bg" />
            <polygon points="20,4 5,34 35,34" fill="#22c55e" className="fng-head" />
            <line x1="20" y1="98" x2="20" y2="32" stroke="white" strokeWidth="12" strokeLinecap="round" className="fng-stem-bg" />
            <line x1="20" y1="98" x2="20" y2="32" stroke="#22c55e" strokeWidth="7" strokeLinecap="round" className="fng-stem" />
          </svg>
        ))}
      </div>
    );
  }

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top" onClick={advance} style={{ cursor: tappable ? "pointer" : "default" }}>
        <div className="fng-count-expr">{a} + {b} = {answerPart}</div>
        <div className="fng-add-hint">{hint}</div>
      </div>

      <div className="fng-add-hands-zone" onClick={advance}
           style={{ cursor: tappable ? "pointer" : "default" }}>
        <div className="fng-sub-hands">
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <HandImg count={leftCount}  side="right" style={{ width: "100%", height: "100%" }} />
              {phase === "add" && makeAddOverlay(leftTips)}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <HandImg count={rightCount} side="left"  style={{ width: "100%", height: "100%" }} />
              {phase === "add" && makeAddOverlay(rightTips)}
            </div>
          </div>
        </div>
      </div>

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
  if (task.op === "add" && (task.a > 5 || task.b > 5)) {
    return <LargeAdditionTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
  }
  return <AdditionTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
}
