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

// When an addend needs both hands (>5), the ten fingers are ONE combined
// quantity, not two independent per-hand blocks — so building it (and later
// continuing past it toward a+b) always follows getFingerConfig's own
// "right fills 1-5 first, left is the 6-10 overflow" order, same as every
// other single-number hand display in this file (e.g. Subtraction's minuend).
// Dots live on the currently-fillable hand only — the "right" primary hand
// until it physically maxes at 5, only then switching to "left" overflow —
// never both at once: showing the overflow hand's dots before the primary
// hand is even full would let a tap on the not-yet-active hand commit the
// canonical next finger on the OTHER hand instead. Deliberately not capped
// at the real target either — how many dots are on screen must never reveal
// the target number, and tapping past it is no longer blocked; only the
// wrist check (confirmAndAdvance) validates the real count. The caller
// mirrors the "right" set before display, same as everywhere else here.
function multiDotsAcrossHands(built) {
  const primaryCount  = Math.min(built, 5);
  const overflowCount = Math.max(0, built - 5);
  const primaryDots  = primaryCount < 5 ? additionBases(primaryCount, 5) : [];
  const overflowDots = primaryCount === 5 ? additionBases(overflowCount, 5) : [];
  return { rightBases: primaryDots, leftBases: overflowDots };
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
// When both addends are ≤5, they get one dedicated hand each — two genuinely
// separate numbers shown side by side (fixing an earlier bug where they both
// landed on the same hand). When either addend needs both hands (>5), the
// ten fingers are ONE combined, continuously-growing quantity: build up to
// `a`, tap a wrist to confirm, then KEEP GOING — without ever resetting to
// fists — up to `a + b`, then tap again → numpad. (An earlier version reset
// to two fresh fists for B in this case, which is wrong: a raised finger is
// not a per-addend object, it's part of one running count across both hands.)

function AdditionTask({ task, onCorrect, onMistake }) {
  const [phase, setPhase] = useState("a"); // a | b | answer | done
  const [builtA, setBuiltA] = useState(0);
  // In "simple" mode this is B's own independent hand count (0..b). In
  // "combined" mode it's how much has been added PAST the `a` checkpoint —
  // the displayed total is a + builtB, continuing the same running count.
  const [builtB, setBuiltB] = useState(0);
  const [input, setInput] = useState([]);
  const [shake, setShake] = useState(false);
  // Separate from `shake` (the numpad's own wrong-digit shake) — this one
  // fires when the wrist check finds the hands don't match the example.
  const [handShake, setHandShake] = useState(false);

  const { a, b, result } = task;
  const resultStr = String(result);
  const simple = a <= 5 && b <= 5;

  const building = phase === "a" || phase === "b";
  const target   = phase === "a" ? a : phase === "b" ? b : null;
  const built    = phase === "a" ? builtA : phase === "b" ? builtB : null;

  useEffect(() => {
    setPhase("a"); setBuiltA(0); setBuiltB(0); setInput([]); setShake(false); setHandShake(false);
  }, [task.cardId]);

  // The wrist is always tappable while building — its availability must
  // never itself signal correctness. A tap checks the real built count
  // against the real addend: right → advance, wrong → shake and reset.
  // Resetting builtB to 0 in "combined" mode falls back to `a` (the last
  // confirmed checkpoint), not all the way to zero — the first addend was
  // already right, only the continuation needs redoing.
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
  // The physical ceiling differs by mode: each hand maxes at 5 in "simple"
  // mode; in "combined" mode builtB is capped by how much room is left in
  // the shared 10-finger space after `a` already used some of it.
  function commit() {
    if (phase === "a") {
      setBuiltA(c => Math.min(simple ? 5 : 10, c + 1));
    } else if (phase === "b") {
      setBuiltB(c => Math.min(simple ? 5 : 10 - a, c + 1));
    }
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
    phase === "b" ? (simple ? `Теперь покажи ${b} →` : `Прибавь ещё ${b} →`) :
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
    // One combined, continuously-growing quantity across both hands: phase
    // "a" shows builtA (0..a); phase "b" and beyond keep going from there —
    // a + builtB — never resetting back to fists.
    const combinedBuilt = phase === "a" ? builtA : Math.min(10, a + builtB);
    const cfg = getFingerConfig(combinedBuilt);
    leftCount  = cfg.left;
    rightCount = cfg.right;
    const dots = building ? multiDotsAcrossHands(combinedBuilt) : { leftBases: [], rightBases: [] };
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
