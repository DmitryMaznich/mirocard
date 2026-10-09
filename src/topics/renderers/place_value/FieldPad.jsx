import { useEffect, useState } from "react";

// Answers typed straight into their fields — no separate input box. The task
// places the fields where they belong (tens under the stacks, ones under the
// frame, the number big below); the digits being typed show in the active
// one, and «↵» on the keypad checks it.

export function useTypedAnswer(maxDigits = 2) {
  const [digits, setDigits] = useState("");
  const [wrong, setWrong] = useState(false);
  return {
    digits, wrong,
    // After a wrong answer the next digit starts a new entry.
    type: (d) => {
      if (wrong) { setDigits(String(d)); setWrong(false); return; }
      if (digits.length < maxDigits) setDigits(digits + d);
    },
    erase: () => { setDigits(digits.slice(0, -1)); setWrong(false); },
    reset: () => { setDigits(""); setWrong(false); },
    fail: () => setWrong(true),
  };
}

// Tens and ones need no «Проверить»: the field checks itself as it is typed.
// The right digits are accepted at once (submit → the next field); a digit
// that can no longer lead to the answer counts as a mistake right away, and
// the field clears itself a moment later for a new try. submit(number) is
// the task's own answer check (true when right).
const AUTO_CLEAR_MS = 800;
export function useAutoCheck(typed, { auto, expected, submit }) {
  useEffect(() => {
    if (!auto || !typed.digits || typed.wrong) return;
    const want = String(expected);
    if (typed.digits === want) { if (submit(Number(typed.digits))) typed.reset(); return; }
    if (!want.startsWith(typed.digits)) { submit(Number(typed.digits)); typed.fail(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed.digits]);
  useEffect(() => {
    if (!auto || !typed.wrong) return undefined;
    const timer = setTimeout(typed.reset, AUTO_CLEAR_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, typed.wrong]);
}

// `bare`: the label is already on screen as the column's heading, so the
// field shows only its box (the label stays as the box's accessible name).
export function AnswerField({ label, tone, value, active, ok, wrong, big = false, bare = false }) {
  return <div className={`fp-field fp-field--${tone}${big ? " fp-field--big" : ""}${active ? " fp-field--active" : ""}${ok ? " fp-field--ok" : ""}${active && wrong ? " fp-field--wrong" : ""}`}>
    {!bare && <span className="fp-label">{label}</span>}
    <output className="fp-value" aria-label={label}>{value}</output>
  </div>;
}

// Digits, with ⌫ and «Проверить» far apart so one can't be hit for the other,
// and «Проверить» a big target. Phones: a tall ⌫ on the left, two rows of
// five digits, a tall wide ✓ on the right (two rows high, to save height).
// Tablets (`grid`): the 3 × 4 calculator pad (⌫, a double-width 0) and a
// full-width «Проверить» under it. «Проверить» stays in place but is only
// live where a field needs confirming (`canEnter`): tens and ones check
// themselves as they are typed.
export function Keypad({ off, typed, onEnter, grid = false, canEnter = true }) {
  const key = (d) => <button type="button" key={d} className="px-key" disabled={off} onClick={() => typed.type(d)}>{d}</button>;
  const erase = <button type="button" key="erase" className="px-key fp-key--erase" aria-label="Стереть цифру" disabled={off || !typed.digits} onClick={typed.erase}>⌫</button>;
  const enter = <button type="button" key="enter" className="fp-enter" aria-label="Проверить" disabled={off || !canEnter || !typed.digits} onClick={onEnter}>
    <span aria-hidden="true">✓</span><span className="fp-enter-word">Проверить</span>
  </button>;
  return <div className={`fp-keys${grid ? " fp-keys--grid" : ""}${off ? " fp-keys--off" : ""}`}>
    {grid
      ? <>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(key)}{erase}<span className="fp-key-zero">{key(0)}</span>{enter}</>
      : <>{erase}{[1, 2, 3, 4, 5].map(key)}{enter}{[6, 7, 8, 9, 0].map(key)}</>}
  </div>;
}
