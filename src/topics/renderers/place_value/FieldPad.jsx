import { useState } from "react";

// Answers typed straight into their fields — no separate input box. The task
// places the fields where they belong (tens under the stacks, ones under the
// frame, the number big below); the digits being typed show in the active
// one, and «↵» on the keypad checks it.

export function useTypedAnswer(maxDigits = 2) {
  const [digits, setDigits] = useState("");
  const [wrong, setWrong] = useState(false);
  return {
    digits, wrong,
    type: (d) => { if (digits.length < maxDigits) { setDigits(digits + d); setWrong(false); } },
    erase: () => { setDigits(digits.slice(0, -1)); setWrong(false); },
    reset: () => { setDigits(""); setWrong(false); },
    fail: () => setWrong(true),
  };
}

// `bare`: the label is already on screen as the column's heading, so the
// field shows only its box (the label stays as the box's accessible name).
export function AnswerField({ label, tone, value, active, ok, wrong, big = false, bare = false }) {
  return <div className={`fp-field fp-field--${tone}${big ? " fp-field--big" : ""}${active ? " fp-field--active" : ""}${ok ? " fp-field--ok" : ""}${active && wrong ? " fp-field--wrong" : ""}`}>
    {!bare && <span className="fp-label">{label}</span>}
    <output className="fp-value" aria-label={label}>{value}</output>
  </div>;
}

// Phones: one strip of two rows (1–5 ⌫ / 6–0 ↵), which saves height.
// Tablets (`grid`): the familiar 3 × 4 calculator pad with big keys.
export function Keypad({ off, typed, onEnter, grid = false }) {
  const key = (d) => <button type="button" key={d} className="px-key" disabled={off} onClick={() => typed.type(d)}>{d}</button>;
  const erase = <button type="button" key="erase" className="px-key fp-key--erase" aria-label="Стереть цифру" disabled={off || !typed.digits} onClick={typed.erase}>⌫</button>;
  const enter = <button type="button" key="enter" className="px-key fp-key--enter" aria-label="Проверить" disabled={off || !typed.digits} onClick={onEnter}>↵</button>;
  return <div className={`fp-keys${grid ? " fp-keys--grid" : ""}${off ? " fp-keys--off" : ""}`}>
    {grid
      ? <>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(key)}{erase}{key(0)}{enter}</>
      : <>{[1, 2, 3, 4, 5].map(key)}{erase}{[6, 7, 8, 9, 0].map(key)}{enter}</>}
  </div>;
}
