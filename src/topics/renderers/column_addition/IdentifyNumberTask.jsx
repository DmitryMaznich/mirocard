import { useState } from "react";
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

function AnswerSlot({ state, value, hint }) {
  const cls = (state ?? "").split(" ").filter(Boolean).map((s) => ` pv-answer-slot--${s}`).join("");
  return (
    <div className={`pv-answer-slot${cls}`}>
      {value ?? "?"}
      {hint && <div className="pv-answer-hint">{hint === "more" ? "Больше ↑" : "Меньше ↓"}</div>}
    </div>
  );
}

export default function IdentifyNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  // answerTens -> answerOnes -> done. No collect/group phase here (unlike
  // build_number): the tens/ones blocks are already laid out for the child
  // to read, not assembled by them first.
  const [phase, setPhase] = useState("answerTens");
  const [rowWrong, setRowWrong] = useState({ tens: false, ones: false });
  const [hintDirection, setHintDirection] = useState({ tens: null, ones: null });

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
        setTimeout(() => onCorrect(task.conceptId, task.cardId), 900);
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

      <div className="pv-checklist pv-checklist--focused">
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
          <AnswerSlot state={tensAnswer.state} value={tensAnswer.value} hint={tensAnswer.hint} />
        </div>
        <div className={`pv-zone${onesAnswer.state === "active" ? " cb-area--focus" : ""}${phase === "done" ? " pv-zone--correct" : ""}`}>
          <div className="pv-zone-label">ЕДИНИЦЫ</div>
          <div className="pv-zone-body">
            {Array.from({ length: task.model.ones }, (_, i) => (
              <Coin key={i} />
            ))}
          </div>
          <AnswerSlot state={onesAnswer.state} value={onesAnswer.value} hint={onesAnswer.hint} />
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
