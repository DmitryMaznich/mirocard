import { useState } from "react";
import Button from "@/shared/components/Button";

// Compact answer row for the place-value coin modes: the number frame, then
// two rows of five digit keys — the coins above must stay readable while the
// child counts them. onSubmit(number) returns true when correct.
export default function NumberAnswer({ onSubmit, maxDigits = 2 }) {
  const [digits, setDigits] = useState("");
  const [wrong, setWrong] = useState(false);
  return <div className="px-numanswer">
    <output aria-label="Ответ" className={`px-frame${wrong ? " px-frame--wrong" : ""}`}>{digits || "?"}</output>
    <div className="px-keys">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => <button type="button" key={d} className="px-key"
        onClick={() => { if (digits.length < maxDigits) { setDigits((v) => v + d); setWrong(false); } }}>{d}</button>)}
    </div>
    <div className="px-answer-actions">
      <button type="button" className="px-key px-key--erase" aria-label="Стереть цифру" disabled={!digits.length}
        onClick={() => { setDigits((v) => v.slice(0, -1)); setWrong(false); }}>⌫</button>
      <Button disabled={!digits.length} onClick={() => setWrong(!onSubmit(Number(digits)))}>Проверить</Button>
    </div>
  </div>;
}
