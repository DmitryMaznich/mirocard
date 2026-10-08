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

export function AnswerField({ label, tone, value, active, ok, wrong, big = false }) {
  return <div className={`fp-field fp-field--${tone}${big ? " fp-field--big" : ""}${active ? " fp-field--active" : ""}${ok ? " fp-field--ok" : ""}${active && wrong ? " fp-field--wrong" : ""}`}>
    <span className="fp-label">{label}</span>
    <output className="fp-value" aria-label={label}>{value}</output>
  </div>;
}

export function Keypad({ off, typed, onEnter }) {
  const key = (d) => <button type="button" key={d} className="px-key" disabled={off} onClick={() => typed.type(d)}>{d}</button>;
  return <div className={`fp-keys${off ? " fp-keys--off" : ""}`}>
    {[1, 2, 3, 4, 5].map(key)}
    <button type="button" className="px-key fp-key--erase" aria-label="Стереть цифру" disabled={off || !typed.digits} onClick={typed.erase}>⌫</button>
    {[6, 7, 8, 9, 0].map(key)}
    <button type="button" className="px-key fp-key--enter" aria-label="Проверить" disabled={off || !typed.digits} onClick={onEnter}>↵</button>
  </div>;
}
