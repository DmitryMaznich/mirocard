import { useRef, useState } from "react";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { hintDirectionFor } from "./placeValueLabels.js";
import { useFitOneLine } from "./textFit.js";
import "./place_value.css";
import "./coins.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="pv-check-icon" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Same tap-to-confirm-row idiom as BuildNumberTask's ChecklistItem, kept as
// its own copy (not a shared import) so retouching one mode's checklist
// never touches the other's. Both rows here are ticked by the numpad, not
// by tapping the row itself, so unlike BuildNumberTask's collect/group rows
// there's no onTap/clickable path at all — a row is always "is-pending"
// until it's done or (briefly) wrong.
function ChecklistItem({ text, state, textRef, fontSize }) {
  const done = state === "done";
  const wrong = state === "wrong";
  return (
    <div className={`pv-checklist-item${done ? " is-done" : ""}${wrong ? " is-wrong" : ""}${!done && !wrong ? " is-pending" : ""}`}>
      <span className="pv-checklist-box">{done && <CheckIcon />}</span>
      <span ref={textRef} className="pv-checklist-text" style={fontSize ? { fontSize } : undefined}>
        {text}
      </span>
    </div>
  );
}

function AnswerSlot({ state, value, hint, slotRef }) {
  const cls = (state ?? "").split(" ").filter(Boolean).map((s) => ` pv-answer-slot--${s}`).join("");
  return (
    <div ref={slotRef} className={`pv-answer-slot${cls}`}>
      {value ?? "?"}
      {hint && <div className="pv-answer-hint">{hint === "more" ? "Больше ↑" : "Меньше ↓"}</div>}
    </div>
  );
}

function rectCenter(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// One flying digit ghost: appended to document.body, animated from `from`
// to `to` in screen coordinates via the Web Animations API, removed and
// `onArrive()` called once it lands — same technique as BuildNumberTask's
// coin-fly-ghost (flyCoinGhost), applied here to the two confirmed digits
// merging into one number once "Сколько единиц?" is answered correctly.
function flyDigitGhost(from, to, text, delayMs, onArrive) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const ghost = document.createElement("div");
  ghost.className = "pv-digit-ghost";
  ghost.textContent = text;
  ghost.style.left = `${from.x}px`;
  ghost.style.top = `${from.y}px`;
  document.body.appendChild(ghost);

  const anim = ghost.animate(
    [
      { transform: "translate(-50%, -50%) scale(1)", offset: 0 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`, offset: 1 },
    ],
    { duration: 380, delay: delayMs, easing: "cubic-bezier(.35,.6,.4,1)", fill: "forwards" },
  );
  anim.onfinish = () => {
    ghost.remove();
    onArrive();
  };
}

export default function IdentifyNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  // answerTens -> answerOnes -> done. No collect/group phase here (unlike
  // build_number): the tens/ones blocks are already laid out for the child
  // to read, not assembled by them first.
  const [phase, setPhase] = useState("answerTens");
  const [rowWrong, setRowWrong] = useState({ tens: false, ones: false });
  const [hintDirection, setHintDirection] = useState({ tens: null, ones: null });
  // merging: the two real AnswerSlots are hidden and their digits are
  // flying (as ghosts) toward the merged-number spot. merged: the ghosts
  // have arrived and the real two-digit number is shown in their place.
  // Two separate flags (not one) because the real slots must fade out
  // BEFORE the ghosts are measured/spawned, and the merged number must
  // only pop in AFTER both ghosts land — they're never true at once, but
  // collapsing them into one enum wouldn't save anything here.
  const [merging, setMerging] = useState(false);
  const [merged, setMerged] = useState(false);
  const tensSlotRef = useRef(null);
  const onesSlotRef = useRef(null);
  const mergedRef = useRef(null);

  // Same shape as BuildNumberTask's flashRowWrong, minus the zone-error
  // callback build_number needs for its drag/drop error zones — this mode
  // only ever flashes a checklist row + its answer slot.
  function flashRowWrong(key, direction) {
    setRowWrong((w) => ({ ...w, [key]: true }));
    setHintDirection((h) => ({ ...h, [key]: direction }));
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => setRowWrong((w) => ({ ...w, [key]: false })), 500);
    setTimeout(() => setHintDirection((h) => ({ ...h, [key]: null })), 1300);
  }

  // Fires once "Сколько единиц?" is answered correctly: a brief pause on
  // the two confirmed-correct digits, then they fly toward each other and
  // land as one two-digit number — see the approved design in
  // docs/superpowers/specs (place-value visual unification follow-up).
  // Positions are measured from the REAL slots and the REAL (already
  // laid-out, just invisible) merged-number spot, not guessed — same
  // "measure the real thing" rule flyCoinGhost follows for its landing
  // spot.
  function playMergeAnimation() {
    const tensEl = tensSlotRef.current;
    const onesEl = onesSlotRef.current;
    const targetEl = mergedRef.current;
    if (!tensEl || !onesEl || !targetEl) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMerging(true);
      setMerged(true);
      setTimeout(() => onCorrect(task.conceptId, task.cardId), 500);
      return;
    }

    const tensRect = tensEl.getBoundingClientRect();
    const onesRect = onesEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    setMerging(true);

    let arrived = 0;
    function onArrive() {
      arrived += 1;
      if (arrived === 2) {
        setMerged(true);
        setTimeout(() => onCorrect(task.conceptId, task.cardId), 550);
      }
    }
    flyDigitGhost(rectCenter(tensRect), rectCenter(targetRect), String(task.model.tens), 0, onArrive);
    flyDigitGhost(rectCenter(onesRect), rectCenter(targetRect), String(task.model.ones), 60, onArrive);
  }

  function handleDigit(d) {
    if (phase === "answerTens") {
      if (d === task.model.tens) {
        setPhase("answerOnes");
      } else {
        flashRowWrong("tens", hintDirectionFor(d, task.model.tens));
      }
      return;
    }
    if (phase === "answerOnes") {
      if (d === task.model.ones) {
        setPhase("done");
        // A short beat on the confirmed-correct digits before they merge —
        // long enough to register "that's right", short enough to still
        // feel like one continuous moment.
        setTimeout(playMergeAnimation, 180);
      } else {
        flashRowWrong("ones", hintDirectionFor(d, task.model.ones));
      }
    }
  }

  const tensDone = phase === "answerOnes" || phase === "done";
  const onesDone = phase === "done";
  const tensAnswer = {
    value: tensDone ? task.model.tens : null,
    state: tensDone ? "filled correct" : rowWrong.tens ? "shake" : phase === "answerTens" ? "active" : undefined,
    hint: hintDirection.tens,
  };
  const onesAnswer = {
    value: onesDone ? task.model.ones : null,
    state: onesDone ? "filled correct" : rowWrong.ones ? "shake" : phase === "answerOnes" ? "active" : undefined,
    hint: hintDirection.ones,
  };

  const { ref: tensQRef, fontSize: tensQFontSize } = useFitOneLine("Сколько десятков?", { max: 45, min: 13 });
  const { ref: onesQRef, fontSize: onesQFontSize } = useFitOneLine("Сколько единиц?", { max: 45, min: 13 });

  return (
    <div className="pv-screen cb-screen">
      <div className="pv-instruction">Какое это число?</div>

      {/* pv-checklist--reserve-2 reserves room for BOTH question rows from
          the start, even while only the first is mounted — otherwise
          revealing "Сколько единиц?" grows the checklist and pushes the
          answer row / coin zones down the screen the moment it appears. */}
      <div className="pv-checklist pv-checklist--focused pv-checklist--reserve-2">
        <ChecklistItem
          text="Сколько десятков?"
          state={phase === "answerTens" ? (rowWrong.tens ? "wrong" : "active") : "done"}
          textRef={tensQRef}
          fontSize={tensQFontSize}
        />
        {(phase === "answerOnes" || phase === "done") && (
          <ChecklistItem
            text="Сколько единиц?"
            state={phase === "answerOnes" ? (rowWrong.ones ? "wrong" : "active") : "done"}
            textRef={onesQRef}
            fontSize={onesQFontSize}
          />
        )}
      </div>

      {/* Split into two zone-width columns so each slot centers over its
          own zone below, right under the questions — not a compact pair
          centered on the screen. The merge animation depends on this too:
          the two digits need real horizontal separation to visibly travel
          toward each other once "Сколько единиц?" is answered. */}
      <div className="pv-answer-row pv-answer-row--split">
        <div className="pv-answer-col">
          <AnswerSlot
            slotRef={tensSlotRef}
            state={merging ? "hidden" : tensAnswer.state}
            value={tensAnswer.value}
            hint={tensAnswer.hint}
          />
        </div>
        <div className="pv-answer-col">
          <AnswerSlot
            slotRef={onesSlotRef}
            state={merging ? "hidden" : onesAnswer.state}
            value={onesAnswer.value}
            hint={onesAnswer.hint}
          />
        </div>
        {/* Always rendered with its final text (not just once merged) so
            its real, laid-out position is measurable the moment the merge
            starts — same "measure the real thing, don't guess" rule as
            flyDigitGhost's targets above. --visible is what actually
            reveals it. */}
        <div ref={mergedRef} className={`pv-merged-number${merged ? " pv-merged-number--visible" : ""}`}>
          {task.model.tens}{task.model.ones}
        </div>
      </div>

      {/* Zone highlight (cb-area--focus) marks which side the currently-
          asked question refers to — same pulse AnswerSlot's own "active"
          state uses, so the question, the zone, and where to type the
          answer are all visually tied together. */}
      <div className="pv-zones">
        <div className={`pv-zone${tensAnswer.state === "active" ? " cb-area--focus" : ""}${phase === "done" ? " pv-zone--correct" : ""}`}>
          <div className="pv-zone-label">ДЕСЯТКИ</div>
          <div className="pv-zone-body">
            {Array.from({ length: task.model.tens }, (_, i) => (
              <TenStack key={i} />
            ))}
          </div>
        </div>
        <div className={`pv-zone${onesAnswer.state === "active" ? " cb-area--focus" : ""}${phase === "done" ? " pv-zone--correct" : ""}`}>
          <div className="pv-zone-label">ЕДИНИЦЫ</div>
          <div className="pv-zone-body">
            {Array.from({ length: task.model.ones }, (_, i) => (
              <Coin key={i} />
            ))}
          </div>
        </div>
      </div>

      <div className="pv-spacer" />

      <div className="pv-numpad">
        {DIGITS.map((d) => (
          <button key={d} className="pv-numkey" onClick={() => handleDigit(d)} disabled={phase === "done"}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
