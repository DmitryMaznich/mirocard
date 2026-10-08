import { useState } from "react";

// Answer fields filled straight from the keypad — no separate input box: the
// digits appear in the active field, «↵» checks it, and the next field comes
// up. onCheck(key, number) returns true when the answer is right.
export default function FieldPad({ fields, step, values, onCheck, maxDigits = 2, done = false }) {
  const [digits, setDigits] = useState("");
  const [wrong, setWrong] = useState(false);
  const type = (d) => { if (digits.length < maxDigits) { setDigits(digits + d); setWrong(false); } };
  function enter() {
    if (!digits) return;
    if (onCheck(fields[step].key, Number(digits))) { setDigits(""); setWrong(false); } else setWrong(true);
  }
  return <div className="fp">
    <div className="fp-fields">
      {fields.map((f, i) => {
        const ok = values[f.key] !== undefined;
        const active = !done && i === step;
        return <div key={f.key} className={`fp-field fp-field--${f.tone}${active ? " fp-field--active" : ""}${ok ? " fp-field--ok" : ""}${active && wrong ? " fp-field--wrong" : ""}`}>
          <span className="fp-label">{f.label}</span>
          <output className="fp-value" aria-label={f.label}>{ok ? values[f.key] : active ? digits : ""}</output>
        </div>;
      })}
    </div>
    {!done && <div className="fp-keys">
      {[1, 2, 3, 4, 5].map((d) => <button type="button" key={d} className="px-key" onClick={() => type(d)}>{d}</button>)}
      <button type="button" className="px-key fp-key--erase" aria-label="Стереть цифру" disabled={!digits}
        onClick={() => { setDigits(digits.slice(0, -1)); setWrong(false); }}>⌫</button>
      {[6, 7, 8, 9, 0].map((d) => <button type="button" key={d} className="px-key" onClick={() => type(d)}>{d}</button>)}
      <button type="button" className="px-key fp-key--enter" aria-label="Проверить" disabled={!digits} onClick={enter}>↵</button>
    </div>}
  </div>;
}
