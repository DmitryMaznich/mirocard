import { useState } from "react";
import Button from "@/shared/components/Button";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { placeValueAnswerSentence } from "./placeValueLabels.js";
import { useFitLongestOneLine } from "./textFit.js";
import "./place_value.css";
import "./coins.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

// Both pv-question strings this screen ever shows — fitting against
// whichever is widest, once, keeps the font size constant as the text
// swaps instead of growing/shrinking between them.
const QUESTION_TEXTS = ["Какое это число?", "Правильно!"];

// One frame for both digits (not two separate slots) — this is a single
// number the child is typing, two digits at a time, not two independent
// answers. See place_value.css's .pv-number-frame for why.
function NumberFrame({ state, digits }) {
  const cls = (state ?? "").split(" ").filter(Boolean).map((s) => ` pv-number-frame--${s}`).join("");
  return (
    <div className={`pv-number-frame${cls}`}>
      <span className="pv-number-cell">{digits[0] ?? "?"}</span>
      <span className="pv-number-cell">{digits[1] ?? "?"}</span>
    </div>
  );
}

export default function IdentifyNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  // The picture (ДЕСЯТКИ/ЕДИНИЦЫ zones) is already fully laid out for the
  // child to read at a glance — asking for tens and ones as separate
  // sub-questions first (the mode's earlier design) tested decomposition,
  // not the holistic number-reading this mode is actually meant to check.
  // One phase now: read the picture, type the whole number.
  const [phase, setPhase] = useState("answer");
  const [wrong, setWrong] = useState(false);
  const [numberInput, setNumberInput] = useState([]);

  function handleDigit(d) {
    const next = [...numberInput, d];
    setNumberInput(next);
    if (next.length < 2) return;
    const guess = Number(next.join(""));
    if (guess === task.model.tens * 10 + task.model.ones) {
      setPhase("done");
    } else {
      // A whole-number guess, not a single digit — no directional hint
      // here (unlike a decomposed tens/ones question), just shake and
      // let the child retry.
      setWrong(true);
      onMistake?.(task.conceptId, task.cardId);
      onFlashIncorrect?.();
      setTimeout(() => setWrong(false), 500);
      setTimeout(() => setNumberInput([]), 500);
    }
  }

  function handleContinue() {
    onCorrect(task.conceptId, task.cardId);
  }

  function frameState() {
    if (phase === "done") return "correct";
    if (wrong) return "shake";
    return undefined;
  }

  const questionText = phase === "done" ? "Правильно!" : "Какое это число?";
  const { ref: questionRef, fontSize: questionFontSize } = useFitLongestOneLine(QUESTION_TEXTS, { max: 40, min: 16 });

  return (
    <div className="pv-screen cb-screen">
      <div className={`pv-question${phase === "done" ? " pv-question--correct" : ""}`}>
        <span ref={questionRef} style={{ fontSize: questionFontSize }}>{questionText}</span>
      </div>

      {/* Pure picture now — no answer slots live inside the zones, the
          child reads them and answers below instead. */}
      <div className="pv-zones pv-zones--flex-fit">
        <div className="pv-zones-row">
          <div className={`pv-zone${phase === "done" ? " pv-zone--correct" : ""}`}>
            <div className="pv-zone-label">ДЕСЯТКИ</div>
            <div className="pv-zone-body">
              {Array.from({ length: task.model.tens }, (_, i) => (
                <TenStack key={i} />
              ))}
            </div>
          </div>
          <div className={`pv-zone${phase === "done" ? " pv-zone--correct" : ""}`}>
            <div className="pv-zone-label">ЕДИНИЦЫ</div>
            <div className="pv-zone-body">
              {Array.from({ length: task.model.ones }, (_, i) => (
                <Coin key={i} />
              ))}
            </div>
          </div>
        </div>

        {phase === "done" && (
          <div className="pv-recap-fit">
            <div className="pv-recap pv-recap--answer">
              {placeValueAnswerSentence(task.model.tens, task.model.ones, task.number)}
            </div>
          </div>
        )}
      </div>

      <div className="pv-guess-row">
        <NumberFrame state={frameState()} digits={numberInput} />
      </div>

      {phase === "done" ? (
        <div className="pv-footer">
          <Button variant="secondary" onClick={handleContinue}>Далее →</Button>
        </div>
      ) : (
        <div className="pv-numpad">
          {DIGITS.map((d) => (
            <button key={d} className="pv-numkey" onClick={() => handleDigit(d)}>
              {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
