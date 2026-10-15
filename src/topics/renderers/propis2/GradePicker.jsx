import { useState } from "react";
import { GRADE_DIGITS, GRADE_SIGNS, gradeText } from "./gradeMark.js";

// The adult picks the mark for the dictation: 1–5, optionally with + or −. Shown after the adult PIN, before the bonus video.
export default function GradePicker({ onPick, onCancel }) {
  const [n, setN] = useState(null);
  const [sign, setSign] = useState("");
  return (
    <div className="propis2-grade-backdrop" role="dialog" aria-modal="true" aria-label="Оценка за диктант" data-testid="propis2-grade-picker">
      <div className="propis2-grade-card">
        <div className="propis2-grade-title">Оценка за диктант</div>
        <div className="propis2-grade-row">
          {GRADE_DIGITS.slice().reverse().map((d) => (
            <button key={d} type="button" className={`propis2-grade-btn${n === d ? " is-on" : ""}`} aria-pressed={n === d} onClick={() => setN(d)}>{d}</button>
          ))}
        </div>
        <div className="propis2-grade-row propis2-grade-row--sign">
          {GRADE_SIGNS.map((s) => (
            <button key={s || "none"} type="button" className={`propis2-grade-btn propis2-grade-btn--sign${sign === s ? " is-on" : ""}`} aria-pressed={sign === s} onClick={() => setSign(s)}>
              {s || "без"}
            </button>
          ))}
        </div>
        <div className="propis2-grade-actions">
          <button type="button" className="propis-dictation-next propis2-grade-go" disabled={n == null} onClick={() => onPick({ n, sign })}>
            {n == null ? "Выберите оценку" : `Поставить ${gradeText({ n, sign })}`}
          </button>
          <button type="button" className="propis2-grade-cancel" onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
