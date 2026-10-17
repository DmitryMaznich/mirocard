import { useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { SchemeOne, SchemeTen } from "./CoinBlocks.jsx";
import { numberWords, pluralTens } from "./placeValueLabels.js";
import { AnswerField, Keypad, useAutoCheck, useTypedAnswer } from "./FieldPad.jsx";
import "./place_value.css";
import "./coins.css";
import "./group_ten.css";
import "./table.css";

// «Таблица» — the last step before bare numbers (docs/place-value-methodology.md,
// раздел 8, кадр 3): no picture, only the place-value columns with digits in
// the place colours. «Какое это число?»: the columns are given, the child
// writes the number. «Собери число»: the number is given, the child writes
// its digits into the columns. In «Обучение» a mistake brings the support of
// the step below back for this task: the scheme (sticks and dots) under the
// digits, or the number's digits in their place colours.

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

function SchemeSupport({ kind, count }) {
  const Piece = kind === "tens" ? SchemeTen : SchemeOne;
  return <div className={`tb-support tb-support--${kind}`} aria-hidden="true">
    {Array.from({ length: count }, (_, i) => <Piece key={i} />)}
  </div>;
}

const head = (kind) => <h3 className={`sg-head sg-head--${kind}`}>{kind === "tens" ? "Десятки" : "Единицы"}</h3>;

export function IdentifyTableTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const layout = task.layout ?? "places";
  const { tens, ones } = task.model;
  const [ref, mode] = useScreenMode();
  const typed = useTypedAnswer(3);
  const [solved, setSolved] = useState(false);
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);

  function hint(guess) {
    if (!teaching) return "Проверь число ещё раз.";
    if (layout === "over9" && String(guess) === `${tens}${ones}`) return "Единиц не может быть больше девяти. Десять единиц — это ещё один десяток.";
    if (tens !== ones && ones <= 9 && guess === ones * 10 + tens) return "Десятки пишут первыми, где бы ни стояла колонка.";
    return "Посмотри на колонки ещё раз.";
  }
  function enter() {
    if (!typed.digits || solved) return;
    const guess = Number(typed.digits);
    if (guess === task.number) { typed.reset(); setNote(""); setSolved(true); return; }
    typed.fail();
    setNote(hint(guess));
    if (teaching) setSupport(true);
    onMistake?.(task.conceptId, task.cardId, { given: String(guess), expected: String(task.number) }); onFlashIncorrect?.();
  }

  const column = (kind) => {
    const n = kind === "tens" ? tens : ones;
    return <div key={kind} className={`tb-col tb-col--${kind}`}>
      {head(kind)}
      <div className={`tb-digit tb-digit--${kind}`}>{n}</div>
      {support && <SchemeSupport kind={kind} count={n} />}
    </div>;
  };
  const order = layout === "mixed" ? ["ones", "tens"] : ["tens", "ones"];
  const status = solved ? null
    : note ? <span className="sg-status-note">{note}</span> : null;

  return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} tb-screen`} style={{ "--sg-answer-w": "320px" }}>
    <div className="sg-inner">
      <h2 className="sg-title">Запиши число</h2>
      <div className="sg-board">
        <section className={`sg-card tb-table${layout === "mixed" ? " tb-table--swapped" : ""}`}>{order.map(column)}</section>
      </div>
      <div className="sg-answer">
        <div className="sg-num">
          <AnswerField label="Какое это число?" tone="total" big ok={solved} active={!solved} wrong={typed.wrong}
            value={solved ? task.number : typed.digits} />
        </div>
        <div className="sg-status" role="status">{status}</div>
        <div className="sg-slot">
          {solved ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : <Keypad typed={typed} onEnter={enter} grid={mode !== "phone"} />}
        </div>
      </div>
    </div>
  </div>;
}

export function BuildTableTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const words = task.prompt === "words";
  const { tens, ones } = task.target;
  const [ref, mode] = useScreenMode();
  const typed = useTypedAnswer(2);
  const [step, setStep] = useState(0); // 0 — tens, 1 — ones, 2 — done
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  const fields = [{ key: "tens", expected: tens }, { key: "ones", expected: ones }];
  const solved = step === 2;

  function submit(guess) {
    const f = fields[step];
    if (guess === f.expected) { setNote(""); setStep(step + 1); return true; }
    if (teaching) {
      const name = words ? `${numberWords(task.number)[0].toUpperCase()}${numberWords(task.number).slice(1)}` : String(task.number);
      setNote(f.key === "tens"
        ? (words ? `${name}: сколько здесь десятков?` : "Десятки — первая цифра числа.")
        : (words ? `${name}: сколько единиц сверх десятков?` : "Единицы — последняя цифра числа."));
      setSupport(true);
    } else setNote("Проверь ещё раз.");
    onMistake?.(task.conceptId, task.cardId, { field: f.key === "tens" ? "Десятки" : "Единицы", given: String(guess), expected: String(f.expected) }); onFlashIncorrect?.();
    return false;
  }
  useAutoCheck(typed, { auto: !solved, expected: solved ? "" : fields[step].expected, submit });

  const digits = String(task.number).padStart(2, "0");
  const target = words ? numberWords(task.number)
    : support ? <><span className="tb-digit--tens">{digits[0]}</span><span className="tb-digit--ones">{digits[1]}</span></>
      : task.number;
  const column = (kind, i) => <div key={kind} className={`tb-col tb-col--${kind}`}>
    {head(kind)}
    <AnswerField label={kind === "tens" ? "Десятки" : "Единицы"} tone={kind} bare ok={step > i} active={step === i} wrong={typed.wrong}
      value={step > i ? fields[i].expected : step === i ? typed.digits : ""} />
  </div>;

  return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} tb-screen tb-screen--build`} style={{ "--sg-answer-w": "320px" }}>
    <div className="sg-inner">
      <h2 className="sg-title tb-ask">Разложи по разрядам</h2>
      <div className="sg-board tb-build-board">
        <div className={`tb-target${words ? " tb-target--words" : ""}`}>{target}</div>
        <section className="sg-card tb-table">{["tens", "ones"].map(column)}</section>
      </div>
      <div className="sg-answer">
        <div className="sg-status" role="status">
          {solved ? null
            : note ? <span className="sg-status-note">{note}</span> : null}
        </div>
        <div className="sg-slot">
          {solved ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : <Keypad typed={typed} onEnter={() => {}} grid={mode !== "phone"} canEnter={false} />}
        </div>
      </div>
    </div>
  </div>;
}

// «Число» (кадр 4): no columns at all — only the written number. The child
// reads the places straight from it: «Сколько десятков?», «Сколько единиц?»,
// each with three choices that hold the typical mistakes (the other digit and
// the whole number — «в 47 сорок семь десятков»; given in words, 40 instead of
// 4). In «Обучение» the digits keep their place colours with «дес.» / «ед.»
// under them, and a mistake brings the table back for this task.
export function NumberLevelTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const words = task.prompt === "words";
  const { tens, ones } = task.target;
  const n = task.number;
  const [ref, mode] = useScreenMode();
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  const [wrong, setWrong] = useState(null);
  const questions = useState(() => {
    const pick = (right, others) => {
      const all = [...new Set([right, ...others])];
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      return all;
    };
    return [
      { key: "tens", ask: "Сколько десятков в числе?", right: tens, options: pick(tens, words ? [tens * 10, ones] : [ones, n]) },
      { key: "ones", ask: "Сколько единиц в числе?", right: ones, options: pick(ones, words ? [tens, n] : [tens, n]) },
    ];
  })[0];
  const solved = step >= questions.length;
  const q = questions[step];

  function choose(value) {
    if (solved) return;
    if (value === q.right) { setStep(step + 1); setNote(""); setWrong(null); return; }
    setWrong(value);
    setNote(!teaching ? "Проверь ещё раз."
      : value === n ? `${n} — это всё число. А ${q.key === "tens" ? "десятков" : "единиц"} в нём сколько?`
        : value === tens * 10 ? `${tens * 10} — это ${tens} ${pluralTens(tens)}. Сколько десятков?`
          : q.key === "tens" ? "Десятки — первая цифра числа." : "Единицы — последняя цифра числа.");
    if (teaching) setSupport(true);
    onMistake?.(task.conceptId, task.cardId, { field: q.key === "tens" ? "Сколько десятков?" : "Сколько единиц?", given: String(value), expected: String(q.right) }); onFlashIncorrect?.();
  }

  const digits = String(n).padStart(2, "0");
  return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} tb-screen nl-screen`} style={{ "--sg-answer-w": "340px" }}>
    <div className="sg-inner">
      <h2 className="sg-title">Какие разряды в числе?</h2>
      <div className="sg-board nl-board">
        {words ? <div className="tb-target tb-target--words">{numberWords(n)}</div>
          : <div className="nl-number">
            <span className={`nl-place${teaching ? " tb-digit--tens" : ""}`}>{digits[0]}</span>
            <span className={`nl-place${teaching ? " tb-digit--ones" : ""}`}>{digits[1]}</span>
          </div>}
        {support && <section className="sg-card tb-table pp-support" aria-hidden="true">
          <div className="tb-col tb-col--tens">{head("tens")}<div className="tb-digit tb-digit--tens">{tens}</div></div>
          <div className="tb-col tb-col--ones">{head("ones")}<div className="tb-digit tb-digit--ones">{ones}</div></div>
        </section>}
      </div>
      <div className="sg-answer">
        {!solved && <div className="nl-ask">{q.ask}</div>}
        <div className="sg-slot">
          {solved ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : <div className="nl-choices" key={step}>
              {q.options.map((v) => <button type="button" key={v} className={`xb-choice-btn nl-choice${wrong === v ? " nl-choice--wrong" : ""}`}
                onClick={() => choose(v)}>{v}</button>)}
            </div>}
        </div>
        <div className="sg-status" role="status">
          {solved ? null : note ? <span className="sg-status-note">{note}</span> : null}
        </div>
      </div>
    </div>
  </div>;
}
