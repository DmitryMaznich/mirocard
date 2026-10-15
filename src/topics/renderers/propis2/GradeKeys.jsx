import { useState } from "react";
import { GRADE_DIGITS, GRADE_SIGNS } from "./gradeMark.js";

// The adult's mark for the dictation, right under the answer sheet: 3 4 5 and the two toggles + and − (either, or none: tap again to
// release). Tapping a digit gives the mark at once and the pen writes it.
export default function GradeKeys({ onPick }) {
  const [sign, setSign] = useState("");
  return (
    <div className="propis2-grade-keys" data-testid="propis2-grade-keys">
      <div className="propis2-grade-keys-row">
        {GRADE_DIGITS.map((n) => (
          <button key={n} type="button" className="propis2-grade-btn" onClick={() => onPick({ n, sign })}>{n}</button>
        ))}
        <span className="propis2-grade-gap" />
        {GRADE_SIGNS.map((s) => (
          <button key={s} type="button" className={`propis2-grade-btn propis2-grade-btn--sign${sign === s ? " is-on" : ""}`} aria-pressed={sign === s} onClick={() => setSign(sign === s ? "" : s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}
