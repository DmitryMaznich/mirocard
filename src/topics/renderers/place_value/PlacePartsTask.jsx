import { useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { numberWords, pluralTens, pluralOnes } from "./placeValueLabels.js";
import { AnswerField, Keypad, useAutoCheck, useTypedAnswer } from "./FieldPad.jsx";
import "./place_value.css";
import "./group_ten.css";
import "./table.css";

// «Разрядные слагаемые»: 47 = 40 + 7 («Разложи») and 40 + 7 = 47 («Сложи»).
// Digits only — the step after the «Таблица»; it prepares adding and taking
// away whole tens in the head (47 + 20) and, later, 347 = 300 + 40 + 7.
// In «Обучение» the number's digits keep their place colours and a mistake
// brings the place-value table (4 | 7) back under the example for this task.
// The number can be given in words («сорок семь = 40 + 7») — the speech-
// therapy core: «сорок» is 40, not 4.
// See docs/place-value-methodology.md, раздел 8.

function useScreenMode() {
  const ref = useRef(null);
  const [mode, setMode] = useState("phone");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const { clientWidth: W, clientHeight: H } = el;
      if (W && H) setMode(W >= 900 && W > H * 1.15 ? "wide" : W < 600 ? "phone" : "tablet");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, mode];
}

const cap = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;

export default function PlacePartsTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const split = task.direction === "split";
  const words = split && task.prompt === "words";
  const n = task.number, tens = Math.floor(n / 10), ones = n % 10;
  const fields = split
    ? [{ key: "tensPart", label: "Десятки", tone: "tens", expected: tens * 10 }, { key: "onesPart", label: "Единицы", tone: "ones", expected: ones }]
    : [{ key: "total", label: "Число", tone: "total", expected: n }];
  const [ref, mode] = useScreenMode();
  const typed = useTypedAnswer(3); // «407» for 40 + 7 is the mistake to catch
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  const solved = step >= fields.length;

  function hint(f, guess) {
    if (!teaching) return "Проверь ещё раз.";
    if (f.key === "tensPart" && guess === tens) return `${tens} ${pluralTens(tens)} — это ${numberWords(tens * 10)}. Сколько это?`;
    if (f.key === "tensPart") return `Сколько десятков в числе ${words ? numberWords(n) : n}? Десятки пишем круглым числом.`;
    if (f.key === "onesPart") return `Сколько единиц в числе ${words ? numberWords(n) : n}?`;
    if (guess === tens * 100 + ones) return `${cap(numberWords(n))} — это ${tens} ${pluralTens(tens)} и ${ones} ${pluralOnes(ones)}. Сколько цифр нужно?`;
    return `${tens * 10} — это ${tens} ${pluralTens(tens)}, ${ones} — ${ones} ${pluralOnes(ones)}. Какое это число?`;
  }
  function submit(guess) {
    const f = fields[step];
    if (guess === f.expected) { setNote(""); setStep(step + 1); return true; }
    setNote(hint(f, guess));
    if (teaching) setSupport(true);
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    return false;
  }
  // The two parts check themselves as they are typed; «Проверить» is live too,
  // so a child who stops at «4» for 40 gets the «4 десятка — это сорок» hint.
  const auto = !solved && split;
  useAutoCheck(typed, { auto, expected: solved ? "" : fields[step].expected, submit });
  function enter() {
    if (!typed.digits || solved) return;
    if (submit(Number(typed.digits))) typed.reset(); else typed.fail();
  }

  const colored = (value, kind) => (teaching ? <span className={`tb-digit--${kind}`}>{value}</span> : value);
  const numberShown = words ? <span className="pp-words">{numberWords(n)}</span>
    : <span className="pp-num">{colored(tens, "tens")}{colored(ones, "ones")}</span>;
  const field = (i) => {
    const f = fields[i];
    return <AnswerField key={f.key} label={f.label} tone={f.tone} bare ok={step > i} active={step === i} wrong={typed.wrong}
      value={step > i ? f.expected : step === i ? typed.digits : ""} />;
  };
  const parts = <><span className="pp-part">{colored(tens * 10, "tens")}</span><span className="pp-op">+</span><span className="pp-part">{colored(ones, "ones")}</span></>;
  const say = split ? `${n} = ${tens * 10} + ${ones}. ${cap(numberWords(n))} — это ${numberWords(tens * 10)} и ${numberWords(ones)}.`
    : `${tens * 10} + ${ones} = ${n}. ${cap(numberWords(tens * 10))} и ${numberWords(ones)} — ${numberWords(n)}.`;

  return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} tb-screen pp-screen`} style={{ "--sg-answer-w": "340px" }}>
    <div className="sg-inner">
      <h2 className="sg-title">{split ? "Разложи на десятки и единицы" : "Сложи десятки и единицы"}</h2>
      <div className="sg-board pp-board">
        <div className="pp-row">
          {split ? <>{numberShown}<span className="pp-op">=</span>{field(0)}<span className="pp-op">+</span>{field(1)}</>
            : <>{parts}<span className="pp-op">=</span>{field(0)}</>}
        </div>
        {support && <section className="sg-card tb-table pp-support" aria-hidden="true">
          <div className="tb-col tb-col--tens"><h3 className="sg-head sg-head--tens">Десятки</h3><div className="tb-digit tb-digit--tens">{tens}</div></div>
          <div className="tb-col tb-col--ones"><h3 className="sg-head sg-head--ones">Единицы</h3><div className="tb-digit tb-digit--ones">{ones}</div></div>
        </section>}
      </div>
      <div className="sg-answer">
        <div className="sg-status" role="status">
          {solved ? <span className="sg-status-say">{say}</span> : note ? <span className="sg-status-note">{note}</span> : null}
        </div>
        <div className="sg-slot">
          {solved ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : <Keypad typed={typed} onEnter={enter} grid={mode !== "phone"} canEnter />}
        </div>
      </div>
    </div>
  </div>;
}
