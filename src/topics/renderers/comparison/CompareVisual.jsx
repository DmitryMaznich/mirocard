import { useState, useEffect, useRef } from "react";
import DotGroup from "./DotGroup";
import { getVerdict } from "./engine";
import { getTopicTitle } from "@/shared/utils/format";

// One-to-one pairing before the "where's more" judgement: the child taps
// off dots on each side in lockstep. Once the smaller side is exhausted,
// whatever's left unmatched on the other side is the visual proof of
// "more" — not just a bigger pile, but a pile with leftovers after every
// possible pair is gone. Tapping the whole column (not individual dots,
// which are visually interchangeable) keeps the target big and forgiving.
function PairingStage({ left, right, onDone }) {
  const [usedLeft,  setUsedLeft]  = useState(0);
  const [usedRight, setUsedRight] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const pairs  = Math.min(usedLeft, usedRight);
  const target = Math.min(left, right);

  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });

  // Split in two: detecting "pairing just finished" and "now schedule the
  // reveal timer" must not share a dependency array. A single effect keyed
  // on `revealing` that also *sets* revealing tears itself down the instant
  // it flips the flag — React reruns the effect for the new `revealing`
  // value, firing this same effect's own cleanup and canceling the timeout
  // before it ever fires.
  useEffect(() => {
    if (pairs >= target) setRevealing(true);
  }, [pairs, target]);

  useEffect(() => {
    if (!revealing) return;
    const t = setTimeout(() => onDoneRef.current(), 900);
    return () => clearTimeout(t);
  }, [revealing]);

  function tapSide(side) {
    if (revealing) return;
    if (side === "left"  && usedLeft  < left)  setUsedLeft((n) => n + 1);
    if (side === "right" && usedRight < right) setUsedRight((n) => n + 1);
  }

  function dotClasses(count) {
    return Array.from({ length: count }, (_, i) => {
      if (i < pairs) return "compare-pairing-dot--paired";
      if (revealing && count > target) return "compare-pairing-dot--leftover";
      return "";
    });
  }

  return (
    <div className="compare-sides">
      <button type="button" className="compare-side compare-side--dots" onClick={() => tapSide("left")}>
        <div className="compare-pairing-col">
          {dotClasses(left).map((cls, i) => (
            <div key={i} className={`dot compare-pairing-dot ${cls}`} style={{ background: "#3b82f6" }} />
          ))}
        </div>
      </button>
      <button type="button" className="compare-side compare-side--dots" onClick={() => tapSide("right")}>
        <div className="compare-pairing-col">
          {dotClasses(right).map((cls, i) => (
            <div key={i} className={`dot compare-pairing-dot ${cls}`} style={{ background: "#fc8181" }} />
          ))}
        </div>
      </button>
    </div>
  );
}

function SideContent({ value, color, visualMode, showHint }) {
  if (visualMode === "numbers") {
    return (
      <>
        <div className="compare-big-number">{value}</div>
        {showHint && <DotGroup count={value} color={color} />}
      </>
    );
  }
  const showNumber = visualMode === "dots_numbers";
  return (
    <>
      <DotGroup count={value} color={color} />
      {showNumber && <div className="compare-number">{value}</div>}
    </>
  );
}

export default function CompareVisual({ task, mode, sessionStatus, onCorrect, onIncorrect }) {
  const [answered,  setAnswered]  = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [shakeSide, setShakeSide] = useState(null); // "left" | "right" | "equal" | null

  const visualMode    = task.visualMode ?? (task.showNumbers ? "dots_numbers" : "dots");
  const isNumbers     = visualMode === "numbers";
  const isPairing     = visualMode === "pairing";
  const [pairingDone, setPairingDone] = useState(!isPairing);
  const isLeftCorrect = task.question === "more" ? task.left > task.right : task.left < task.right;

  // Derive locked state from authoritative session status so retries always unblock
  const isAnswered = answered || sessionStatus !== "task_active";
  const verdict    = sessionStatus === "answer_correct" ? getVerdict(task) : null;

  useEffect(() => {
    if (sessionStatus === "task_active") {
      setAnswered(false);
      setShowHints(false);
      setShakeSide(null);
      setPairingDone(!isPairing);
    }
  }, [sessionStatus, isPairing]);

  function flashWrong(side) {
    setShakeSide(side);
    setTimeout(() => setShakeSide(null), 350);
  }

  function handleSide(pickedLeft) {
    if (isAnswered || task.question === "equal") return;
    setAnswered(true);
    if (isLeftCorrect === pickedLeft) {
      onCorrect(task.conceptId, null);
    } else {
      flashWrong(pickedLeft ? "left" : "right");
      if (isNumbers) {
        setShowHints(true);
        setTimeout(() => setShowHints(false), 1500);
      }
      onIncorrect(task.conceptId, null);
    }
  }

  function handleEqual() {
    if (isAnswered) return;
    setAnswered(true);
    if (task.left === task.right) {
      onCorrect(task.conceptId, null);
    } else {
      flashWrong("equal");
      onIncorrect(task.conceptId, null);
    }
  }

  function sideClass(side) {
    return `compare-side${isNumbers ? " compare-side--number" : " compare-side--dots"}${shakeSide === side ? " compare-side--shake" : ""}`;
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{task.instruction ?? getTopicTitle(mode.ui.instruction)}</div>
      {task.equalHint && !isPairing && <div className="compare-instruction-hint">{task.equalHint}</div>}
      {isPairing && !pairingDone ? (
        <PairingStage left={task.left} right={task.right} onDone={() => setPairingDone(true)} />
      ) : (
        <div className="compare-sides">
          <button className={sideClass("left")} disabled={isAnswered} onClick={() => handleSide(true)}>
            <SideContent value={task.left} color="#3b82f6" visualMode={isPairing ? "dots" : visualMode} showHint={showHints} />
          </button>
          {task.showEqual && (
            <button
              className={`compare-equal-btn compare-equal-btn--empty compare-equal-btn--hint${shakeSide === "equal" ? " compare-equal-btn--shake" : ""}`}
              style={{ alignSelf: "center" }}
              disabled={isAnswered}
              onClick={handleEqual}
              aria-label="Одинаково"
            />
          )}
          <button className={sideClass("right")} disabled={isAnswered} onClick={() => handleSide(false)}>
            <SideContent value={task.right} color="#fc8181" visualMode={isPairing ? "dots" : visualMode} showHint={showHints} />
          </button>
        </div>
      )}
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
