import { useState, useEffect, useRef, useMemo } from "react";
import DotGroup from "./DotGroup";
import { getVerdict } from "./engine";
import { buildDotLayout, rowsPair } from "./dotLayout.js";
import { getTopicTitle } from "@/shared/utils/format";

// Neutral pair: red means "mistake" everywhere else in the app (shake,
// wrong answer), so the right-hand pile must not be red.
const LEFT_COLOR  = "#3b82f6";
const RIGHT_COLOR = "#f97316";

function sideLabel(side, value, visualMode) {
  const where = side === "left" ? "Слева" : "Справа";
  return visualMode === "numbers" ? `${where} число ${value}` : `${where} точек: ${value}`;
}

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
      <button type="button" className="compare-side compare-side--dots" aria-label={sideLabel("left", left, "dots")} onClick={() => tapSide("left")}>
        <div className="compare-pairing-col">
          {dotClasses(left).map((cls, i) => (
            <div key={i} className={`dot compare-pairing-dot ${cls}`} style={{ background: LEFT_COLOR }} />
          ))}
        </div>
      </button>
      <button type="button" className="compare-side compare-side--dots" aria-label={sideLabel("right", right, "dots")} onClick={() => tapSide("right")}>
        <div className="compare-pairing-col">
          {dotClasses(right).map((cls, i) => (
            <div key={i} className={`dot compare-pairing-dot ${cls}`} style={{ background: RIGHT_COLOR }} />
          ))}
        </div>
      </button>
    </div>
  );
}

// Scattered / lure dots: absolutely placed in a square field, sizes in % of
// it. When `pts` switches to rows (after a mistake) the dots glide there.
function DotField({ pts, color }) {
  return (
    <div className="compare-dot-field">
      {pts.map((p, i) => (
        <div
          key={i}
          className="compare-field-dot"
          style={{ background: color, width: `${p.d * 100}%`, height: `${p.d * 100}%`, left: `${(p.x - p.d / 2) * 100}%`, top: `${(p.y - p.d / 2) * 100}%` }}
        />
      ))}
    </div>
  );
}

function SideContent({ value, color, visualMode, showHint, pts }) {
  if (pts) {
    return (
      <>
        <DotField pts={pts} color={color} />
        {visualMode === "dots_numbers" && <div className="compare-number">{value}</div>}
      </>
    );
  }
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

export default function CompareVisual({ task, mode, sessionStatus, taskRetry = 0, onCorrect, onIncorrect }) {
  const [answered,  setAnswered]  = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [shakeSide, setShakeSide] = useState(null); // "left" | "right" | "equal" | null

  const visualMode    = task.visualMode ?? (task.showNumbers ? "dots_numbers" : "dots");
  const isNumbers     = visualMode === "numbers";
  const isPairing     = visualMode === "pairing";
  const [pairingDone, setPairingDone] = useState(!isPairing);
  const isLeftCorrect = task.question === "more" ? task.left > task.right : task.left < task.right;

  // «Как лежат точки»: scatter / lure lay the dots out once per task. After a
  // mistake they glide into rows of one size, and the repeat (the screen is
  // remounted with taskRetry ≥ 1) starts in rows, so the same trick can't
  // fool the child twice.
  const isFieldLayout = (task.dotLayout === "scatter" || task.dotLayout === "lure") && (visualMode === "dots" || visualMode === "dots_numbers");
  const [inRows, setInRows] = useState(taskRetry > 0);
  const layout = useMemo(
    () => (isFieldLayout ? buildDotLayout(task.left, task.right, task.dotLayout, task.lure) : null),
    [isFieldLayout, task.left, task.right, task.dotLayout, task.lure],
  );
  const rows = useMemo(() => rowsPair(task.left, task.right), [task.left, task.right]);
  const pts = isFieldLayout ? (inRows ? rows : layout) : null;
  const rowsTimer = useRef(null);
  useEffect(() => () => clearTimeout(rowsTimer.current), []);
  function showRowsAfterShake() {
    if (!isFieldLayout) return;
    rowsTimer.current = setTimeout(() => setInRows(true), 380);
  }

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
    if (isAnswered) return;
    setAnswered(true);
    // On an equal pair neither side is the answer — a tap on a side is a
    // mistake like any other, not a tap that silently does nothing.
    if (task.question !== "equal" && isLeftCorrect === pickedLeft) {
      onCorrect(task.conceptId, null);
    } else {
      flashWrong(pickedLeft ? "left" : "right");
      showRowsAfterShake();
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
      showRowsAfterShake();
      onIncorrect(task.conceptId, null);
    }
  }

  function sideClass(side) {
    return `compare-side${isNumbers ? " compare-side--number" : " compare-side--dots"}${isFieldLayout ? " compare-side--field" : ""}${shakeSide === side ? " compare-side--shake" : ""}`;
  }

  return (
    <div className="compare-body">
      <div className="compare-instruction">{task.instruction ?? getTopicTitle(mode.ui.instruction)}</div>
      {task.equalHint && !isPairing && <div className="compare-instruction-hint">{task.equalHint}</div>}
      {isPairing && !pairingDone ? (
        <PairingStage left={task.left} right={task.right} onDone={() => setPairingDone(true)} />
      ) : (
        <div className="compare-sides">
          <button className={sideClass("left")} disabled={isAnswered} aria-label={sideLabel("left", task.left, isNumbers ? "numbers" : "dots")} onClick={() => handleSide(true)}>
            <SideContent value={task.left} color={LEFT_COLOR} visualMode={isPairing ? "dots" : visualMode} showHint={showHints} pts={pts?.left} />
          </button>
          {/* Deliberately an empty amber square, no «=» and no caption: the
              owner's choice — nothing extra to distract, and it looks
              inviting to the child. Don't "fix" it (tried in 2.48.0, reverted). */}
          {task.showEqual && (
            <button
              className={`compare-equal-btn compare-equal-btn--empty compare-equal-btn--hint${shakeSide === "equal" ? " compare-equal-btn--shake" : ""}`}
              style={{ alignSelf: "center" }}
              disabled={isAnswered}
              onClick={handleEqual}
              aria-label="Поровну"
            />
          )}
          <button className={sideClass("right")} disabled={isAnswered} aria-label={sideLabel("right", task.right, isNumbers ? "numbers" : "dots")} onClick={() => handleSide(false)}>
            <SideContent value={task.right} color={RIGHT_COLOR} visualMode={isPairing ? "dots" : visualMode} showHint={showHints} pts={pts?.right} />
          </button>
        </div>
      )}
      {verdict && <div className="compare-verdict">{verdict}</div>}
    </div>
  );
}
