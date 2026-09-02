import { useState } from "react";
import Button from "@/shared/components/Button";
import { BackspaceIcon } from "@/shared/components/ArrowIcons";
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

// One frame for the whole number (not one slot per digit) — this is a
// single number the child is typing, not several independent answers. See
// place_value.css's .pv-number-frame for why. `length` is the number of
// digits the TARGET actually has (1 for a bare single digit like 7, 2 for
// 10-99) — a single-digit target gets a single-cell frame, not a padded
// leading zero.
function NumberFrame({ state, digits, length }) {
  const cls = (state ?? "").split(" ").filter(Boolean).map((s) => ` pv-number-frame--${s}`).join("");
  return (
    <div className={`pv-number-frame${cls}`}>
      {Array.from({ length }, (_, i) => (
        <span key={i} className="pv-number-cell">{digits[i] ?? "?"}</span>
      ))}
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

  // How many digits the TARGET actually has — 1 for a bare single digit
  // (tens = 0, e.g. 7), 2 for the regular 10-99 range. Reading this off
  // task.number itself (not always assuming 2) is what lets a single-digit
  // target end after one tap instead of demanding a padded "07".
  const expectedDigits = String(task.number).length;

  function handleDigit(d) {
    if (wrong) return; // mid-shake from the previous guess — ignore taps until it clears
    const next = [...numberInput, d];
    setNumberInput(next);
    if (next.length < expectedDigits) return;
    const guess = Number(next.join(""));
    if (guess === task.number) {
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

  // Removes only the last digit — lets a child who typed the first digit
  // of a two-digit guess wrong fix just that one, instead of being forced
  // to complete a guess they already know is wrong just to get the shake
  // and a full clear.
  function handleBackspace() {
    if (wrong || numberInput.length === 0) return;
    setNumberInput((prev) => prev.slice(0, -1));
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
        <NumberFrame state={frameState()} digits={numberInput} length={expectedDigits} />
        {phase !== "done" && (
          <button
            type="button"
            className="pv-backspace-btn"
            onClick={handleBackspace}
            disabled={wrong || numberInput.length === 0}
            aria-label="Стереть цифру"
          >
            <BackspaceIcon />
          </button>
        )}
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
