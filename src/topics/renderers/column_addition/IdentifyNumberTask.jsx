import { useState } from "react";
import Button from "@/shared/components/Button";
import { useSpeech } from "@/shared/hooks/useSpeech";
import { UnitCube, TenCard } from "./PlaceValueBlocks.jsx";
import { pluralTens, pluralOnes } from "./placeValueLabels.js";
import "./place_value.css";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export default function IdentifyNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const [val, setVal] = useState({ tens: null, ones: null });
  const [shake, setShake] = useState({ tens: false, ones: false });
  const [solved, setSolved] = useState(false);
  const { speak } = useSpeech();

  function checkAnswer(next) {
    const okTens = next.tens === task.model.tens;
    const okOnes = next.ones === task.model.ones;
    if (okTens && okOnes) {
      speak("Верно!");
      setSolved(true);
      return;
    }
    setShake({ tens: !okTens, ones: !okOnes });
    onMistake?.(task.conceptId, task.cardId);
    onFlashIncorrect?.();
    setTimeout(() => {
      setShake({ tens: false, ones: false });
      setVal({ tens: null, ones: null });
    }, 500);
  }

  function handleDigit(d) {
    if (solved) return;
    if (val.tens === null) {
      setVal({ tens: d, ones: null });
      return;
    }
    if (val.ones === null) {
      const next = { tens: val.tens, ones: d };
      setVal(next);
      checkAnswer(next);
    }
  }

  function handleClear() {
    setVal({ tens: null, ones: null });
  }

  function handleContinue() {
    onCorrect(task.conceptId, task.cardId);
  }

  return (
    <div className="pv-screen">
      <div className="pv-instruction">Какое это число?</div>

      <div className="pv-zones">
        <div className="pv-zone">
          <div className="pv-zone-label">ДЕСЯТКИ</div>
          <div className="pv-zone-body">
            {Array.from({ length: task.model.tens }, (_, i) => (
              <TenCard key={i} numeric={task.numericBlocks} />
            ))}
          </div>
        </div>
        <div className="pv-zone">
          <div className="pv-zone-label">ЕДИНИЦЫ</div>
          <div className="pv-zone-body">
            {Array.from({ length: task.model.ones }, (_, i) => (
              <UnitCube key={i} numeric={task.numericBlocks} />
            ))}
          </div>
        </div>
      </div>

      {task.showCounters && (
        <div className="pv-zones" style={{ flex: 0 }}>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {task.model.tens} {pluralTens(task.model.tens)}
          </div>
          <div style={{ flex: 1 }} className="pv-zone-counter">
            {task.model.ones} {pluralOnes(task.model.ones)}
          </div>
        </div>
      )}

      <div className="pv-answer-row">
        <div className={`pv-answer-slot${val.tens !== null ? " pv-answer-slot--filled" : ""}${solved ? " pv-answer-slot--correct" : ""}${shake.tens ? " pv-answer-slot--shake" : ""}`}>
          {val.tens ?? "?"}
        </div>
        <div className={`pv-answer-slot${val.ones !== null ? " pv-answer-slot--filled" : ""}${solved ? " pv-answer-slot--correct" : ""}${shake.ones ? " pv-answer-slot--shake" : ""}`}>
          {val.ones ?? "?"}
        </div>
      </div>

      <div className="pv-spacer" />

      <div className="pv-numpad">
        {DIGITS.map((d) => (
          <button key={d} className="pv-numkey" onClick={() => handleDigit(d)} disabled={solved}>
            {d}
          </button>
        ))}
      </div>
      <div className="pv-footer">
        {solved ? (
          <Button variant="secondary" onClick={handleContinue}>Далее →</Button>
        ) : (
          <Button variant="secondary" onClick={handleClear}>Стереть</Button>
        )}
      </div>
    </div>
  );
}
