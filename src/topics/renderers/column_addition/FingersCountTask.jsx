import { useState, useEffect, useLayoutEffect, useRef } from "react";
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

// One button, centered between both hands at wrist height — always
// available while building/reducing (never gated on having the right
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

// Shrinks font-size just enough to keep `text` on one line inside its
// parent's content box — vw-based clamp() alone can't do this, since the
// same font-size wraps a long hint ("Прибавь ещё 8") but not a short one
// ("Убери 2"). Recalculates on text change, on container resize, and again
// whenever a font finishes loading. Nunito comes from a Google Fonts
// stylesheet loaded via the media="print"→"all" async trick (see
// index.html) with display=swap, so the very first measurement can run
// against the fallback font — sized narrower than real Nunito — and the
// stylesheet may not even be attached yet, which is why this listens for
// the fonts API's own "loadingdone" event rather than just fonts.ready
// (ready only covers @font-face rules already registered at the time it's
// read). A small safety margin (0.98) absorbs fractional rounding slack
// between scrollWidth and clientWidth.
function useFitOneLine(text, { min = 22, max = 78 } = {}) {
  const ref = useRef(null);
  const [fontSize, setFontSize] = useState(max);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement) return;

    function fit() {
      el.style.fontSize = max + "px";
      const containerWidth = el.parentElement.clientWidth;
      const naturalWidth = el.scrollWidth;
      if (containerWidth === 0 || naturalWidth <= containerWidth) {
        setFontSize(max);
        return;
      }
      setFontSize(Math.max(min, Math.floor((containerWidth / naturalWidth) * max * 0.98)));
    }

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement);
    const fontsApi = typeof document !== "undefined" ? document.fonts : null;
    fontsApi?.addEventListener?.("loadingdone", fit);
    return () => {
      ro.disconnect();
      fontsApi?.removeEventListener?.("loadingdone", fit);
    };
  }, [text, min, max]);

  return { ref, fontSize };
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
    phase === "show"        ? `Было ${a}` :
    phase === "reduce"      ? `Убери ${b}` :
    phase === "readyAnswer" ? "Готово?" :
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
  const { ref: hintRef, fontSize: hintFontSize } = useFitOneLine(hint);

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top" onClick={phase === "show" ? goReduce : undefined}
           style={{ cursor: phase === "show" ? "pointer" : "default" }}>
        <div className="fng-count-expr">{a} − {b} = {answerPart}</div>
      </div>

      <div className="fng-add-hint" onClick={phase === "show" ? goReduce : undefined}
           style={{ cursor: phase === "show" ? "pointer" : "default" }}>
        <span ref={hintRef} className="fng-add-hint-text" style={{ fontSize: hintFontSize }}>{hint}</span>
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
            </div>
          </div>
          {phase === "reduce" && <ConfirmZone onTap={confirmReduce} />}
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
  // "simple" mode (both addends ≤5): builtA/builtB are each hand's own
  // dedicated count, gated by phase (only the active hand's dots show).
  const [builtA, setBuiltA] = useState(0);
  const [builtB, setBuiltB] = useState(0);
  // "combined" mode (either addend >5): handLeft/handRight are the ACTUAL
  // physical finger counts on each hand, free for the child to distribute
  // however they like — no fixed fill order. checkpointRef remembers the
  // exact split once `a` is confirmed, so a wrong second check can restore
  // that specific combination rather than some other split that also sums
  // to `a`.
  const [handLeft, setHandLeft] = useState(0);
  const [handRight, setHandRight] = useState(0);
  const checkpointRef = useRef({ left: 0, right: 0 });
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
    setPhase("a");
    setBuiltA(0); setBuiltB(0);
    setHandLeft(0); setHandRight(0);
    checkpointRef.current = { left: 0, right: 0 };
    setInput([]); setShake(false); setHandShake(false);
  }, [task.cardId]);

  // The wrist is always tappable while building — its availability must
  // never itself signal correctness. A tap checks the real hands against
  // the real example: right → advance, wrong → shake and reset.
  function confirmAndAdvance() {
    if (simple) {
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
      return;
    }

    // combined mode: check the SUM of both hands, whatever split the child
    // chose. Wrong on the first checkpoint resets both hands to 0; wrong on
    // the second restores the exact split that was confirmed for `a` — the
    // first addend was already right, only the continuation needs redoing.
    const total = handLeft + handRight;
    const goal = phase === "a" ? a : a + b;
    if (total !== goal) {
      setHandShake(true);
      setTimeout(() => {
        setHandShake(false);
        if (phase === "a") { setHandLeft(0); setHandRight(0); }
        else { setHandLeft(checkpointRef.current.left); setHandRight(checkpointRef.current.right); }
      }, 500);
      onMistake?.();
      return;
    }
    if (phase === "a") {
      checkpointRef.current = { left: handLeft, right: handRight };
      setPhase("b");
    } else if (phase === "b") {
      setPhase("answer");
    }
  }

  // Uncapped at the real target — reaching (or overshooting) it no longer
  // blocks further taps, otherwise the block itself would be a hint. Each
  // commit function always raises the finger on the hand its dot is on —
  // in "simple" mode only the phase-active hand ever has dots, so there's
  // no ambiguity; in "combined" mode both hands can have dots at once and
  // each tap moves exactly the hand it was tapped on.
  function commitLeft() {
    if (simple) { if (phase === "a") setBuiltA(c => Math.min(5, c + 1)); }
    else setHandLeft(c => Math.min(5, c + 1));
  }
  function commitRight() {
    if (simple) { if (phase === "b") setBuiltB(c => Math.min(5, c + 1)); }
    else setHandRight(c => Math.min(5, c + 1));
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
    phase === "a" ? `Покажи ${a}` :
    phase === "b" ? (simple ? `Теперь покажи ${b}` : `Прибавь ещё ${b}`) :
    "Введи ответ";

  const answerPart = phase === "done"
    ? <span className="fng-count-answer fng-count-answer--correct">{result}</span>
    : phase === "answer"
      ? <span className={`fng-count-answer${shake ? " fng-count-answer--shake" : ""}`}>
          {input.length > 0 ? input.join("") : "?"}
        </span>
      : "?";

  const kbdVisible = phase === "answer" || phase === "done";

  // Dots always span each hand's full remaining capacity (up to 5), never
  // just "target − built" — otherwise counting the dots would hand the
  // child the answer instead of the number itself. They track the real
  // (now uncapped) hand counts continuously; only the wrist tap clears them.
  let leftCount, rightCount, leftBases, rightBases;
  if (simple) {
    // One hand per addend — both stay visible side by side once built, dots
    // only on the phase-active hand (the other addend isn't being built).
    leftCount  = builtA;
    rightCount = builtB;
    leftBases  = (phase === "a") ? additionBases(builtA, 5) : [];
    rightBases = (phase === "b") ? additionBases(builtB, 5).map(mirror) : [];
  } else {
    // Combined mode: both hands are just the real physical finger counts,
    // free for the child to split however they want — dots on BOTH hands
    // at once (whichever still has room), no fixed fill order between them.
    leftCount  = handLeft;
    rightCount = handRight;
    leftBases  = building && handLeft  < 5 ? additionBases(handLeft, 5)  : [];
    rightBases = building && handRight < 5 ? additionBases(handRight, 5).map(mirror) : [];
  }

  const { ref: hintRef, fontSize: hintFontSize } = useFitOneLine(hint);

  return (
    <div className="fng-add-screen">
      <div className="fng-add-top">
        <div className="fng-count-expr">{a} + {b} = {answerPart}</div>
      </div>

      <div className="fng-add-hint">
        <span ref={hintRef} className="fng-add-hint-text" style={{ fontSize: hintFontSize }}>{hint}</span>
      </div>

      <div className={`fng-add-hands-zone${handShake ? " fng-hands-shake" : ""}`}>
        <div className="fng-sub-hands">
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={leftCount} side="right" style={{ width: "100%", height: "100%" }} />
              {leftBases.length > 0 && (
                <div className="fng-gesture-overlay">
                  {leftBases.map((pos, i) => (
                    <GestureDot key={i} pos={pos} direction="up" onCommit={commitLeft} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="fng-sub-hand-wrap">
            <div className="fng-sub-hand-inner">
              <AnimatedHand count={rightCount} side="left" style={{ width: "100%", height: "100%" }} />
              {rightBases.length > 0 && (
                <div className="fng-gesture-overlay">
                  {rightBases.map((pos, i) => (
                    <GestureDot key={i} pos={pos} direction="up" onCommit={commitRight} />
                  ))}
                </div>
              )}
            </div>
          </div>
          {building && <ConfirmZone onTap={confirmAndAdvance} />}
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
