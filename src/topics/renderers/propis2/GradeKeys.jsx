import { GRADE_DIGITS, GRADE_SIGNS } from "./gradeMark.js";

// The adult's mark for the dictation: 3 4 5 and the two toggles + and − (either, or none). Only a choice: tapping a key writes nothing,
// the mark goes on the sheet when the adult presses «Оценить» (DictationReview.jsx). Owner, 2026-10-29: the mark used to be written on
// the first tap of a digit, so a 5 could no longer get its −.
export default function GradeKeys({ value, onChange }) {
  const { n = null, sign = "" } = value ?? {};
  return (
    <div className="propis2-grade-keys" data-testid="propis2-grade-keys" role="group" aria-label="Оценка">
      {GRADE_DIGITS.map((d) => (
        <button key={d} type="button" className={`propis2-grade-btn${n === d ? " is-on" : ""}`} aria-pressed={n === d} onClick={() => onChange({ n: n === d ? null : d, sign })}>{d}</button>
      ))}
      <span className="propis2-grade-gap" />
      {GRADE_SIGNS.map((s) => (
        <button key={s} type="button" className={`propis2-grade-btn propis2-grade-btn--sign${sign === s ? " is-on" : ""}`} aria-pressed={sign === s} aria-label={s === "+" ? "плюс" : "минус"} onClick={() => onChange({ n, sign: sign === s ? "" : s })}>{s}</button>
      ))}
    </div>
  );
}
