import { useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { numberWords, pluralHundreds, pluralTens, pluralOnes } from "./placeValueLabels.js";
import { AnswerField, Keypad, useAutoCheck, useTypedAnswer } from "./FieldPad.jsx";
import { modelPieces } from "./CoinBlocks.jsx";
import "./place_value.css";
import "./coins.css";
import "./group_ten.css";
import "./table.css";
import "./hundreds.css";

// «Разрядные слагаемые»: 47 = 40 + 7 («Разложи») and 40 + 7 = 47 («Сложи»).
// Digits only — the step after the «Таблица»; it prepares adding and taking
// away whole tens in the head (47 + 20) and, later, 347 = 300 + 40 + 7.
// In «Обучение» the number's digits keep their place colours and a mistake
// brings the place-value table (4 | 7) back under the example for this task.
// The number can be given in words («сорок семь = 40 + 7») — the speech-
// therapy core: «сорок» is 40, not 4.
// «Как показываем» (coins / scheme) puts the number's picture above the
// example — 4 sticks and 7 dots over «47 = 40 + 7»: the support before the
// digits-only default.
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

// The number as pieces, one column per place, in rows of five like the ten-frame.
function Picture({ view, places, digit }) {
  const { One, Ten, Hundred } = modelPieces(view);
  const Piece = { hundreds: Hundred, tens: Ten, ones: One };
  return <section className={`sg-card pp-picture pp-picture--${places.length}`} aria-hidden="true">
    {places.map((k) => <div key={k} className={`pp-pic-col pp-pic-col--${k}`}>
      <h3 className={`sg-head sg-head--${k}`}>{PLACE[k].label}</h3>
      <div className="pp-pic-pieces">{Array.from({ length: digit[k] }, (_, i) => { const P = Piece[k]; return <P key={i} />; })}</div>
    </div>)}
  </section>;
}

const PLACE = {
  hundreds: { label: "Сотни", gen: "сотен", unit: 100, plural: pluralHundreds },
  tens: { label: "Десятки", gen: "десятков", unit: 10, plural: pluralTens },
  ones: { label: "Единицы", gen: "единиц", unit: 1, plural: pluralOnes },
};
// «a, b и c» / «a и b».
const list = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} и ${items[items.length - 1]}` : items[0]);

export default function PlacePartsTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const split = task.direction === "split";
  const words = split && task.prompt === "words";
  const n = task.number;
  const digit = { hundreds: Math.floor(n / 100), tens: Math.floor(n / 10) % 10, ones: n % 10 };
  // Places shown in the table (all of the number's places) and the non-zero
  // parts (305 = 300 + 5: a zero place has no part).
  const places = (n >= 100 ? ["hundreds", "tens", "ones"] : ["tens", "ones"]);
  const parts = places.filter((k) => digit[k]).map((k) => ({ key: k, value: digit[k] * PLACE[k].unit }));
  const fields = split
    ? parts.map((p) => ({ key: p.key, label: PLACE[p.key].label, tone: p.key, expected: p.value }))
    : [{ key: "total", label: "Число", tone: "total", expected: n }];
  const [ref, mode] = useScreenMode();
  const typed = useTypedAnswer(5); // «407» for 40 + 7, «30047» for 300 + 40 + 7
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  const solved = step >= fields.length;
  const named = words ? numberWords(n) : n;
  const composition = list(places.map((k) => `${digit[k]} ${PLACE[k].plural(digit[k])}`));

  function hint(f, guess) {
    if (!teaching) return "Проверь ещё раз.";
    if (f.key === "total") {
      if (String(guess).length !== String(n).length) return `${cap(numberWords(n))} — это ${composition}. Сколько цифр нужно?`;
      return `${list(parts.map((p) => `${p.value} — это ${digit[p.key]} ${PLACE[p.key].plural(digit[p.key])}`))}. Какое это число?`;
    }
    const d = digit[f.key];
    if (f.key !== "ones" && guess === d) return `${d} ${PLACE[f.key].plural(d)} — это ${numberWords(f.expected)}. Сколько это?`;
    if (f.key !== "ones") return `Сколько ${PLACE[f.key].gen} в числе ${named}? ${PLACE[f.key].label} пишем круглым числом.`;
    return `Сколько единиц в числе ${named}?`;
  }
  function submit(guess) {
    const f = fields[step];
    if (guess === f.expected) { setNote(""); setStep(step + 1); return true; }
    setNote(hint(f, guess));
    if (teaching) setSupport(true);
    onMistake?.(task.conceptId, task.cardId, { field: split ? f.label : null, given: String(guess), expected: String(f.expected) }); onFlashIncorrect?.();
    return false;
  }
  // The parts check themselves as they are typed; «Проверить» is live too, so
  // a child who stops at «4» for 40 gets the «4 десятка — это сорок» hint.
  const auto = !solved && split;
  useAutoCheck(typed, { auto, expected: solved ? "" : fields[step].expected, submit });
  function enter() {
    if (!typed.digits || solved) return;
    if (submit(Number(typed.digits))) typed.reset(); else typed.fail();
  }

  const colored = (value, kind) => (teaching ? <span className={`tb-digit--${kind}`}>{value}</span> : value);
  const numberShown = words ? <span className="pp-words">{numberWords(n)}</span>
    : <span className="pp-num">{places.map((k) => <span key={k}>{colored(digit[k], k)}</span>)}</span>;
  const field = (i) => {
    const f = fields[i];
    return <AnswerField key={f.key} label={f.label} tone={f.tone} bare ok={step > i} active={step === i} wrong={typed.wrong}
      value={step > i ? f.expected : step === i ? typed.digits : ""} />;
  };
  const plusJoined = (items) => items.flatMap((item, i) => (i ? [<span key={`op${i}`} className="pp-op">+</span>, item] : [item]));
  const title = n >= 100 ? (split ? "Разложи на сотни, десятки и единицы" : "Сложи сотни, десятки и единицы")
    : split ? "Разложи на десятки и единицы" : "Сложи десятки и единицы";

  return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} tb-screen pp-screen`} style={{ "--sg-answer-w": "340px" }}>
    <div className="sg-inner">
      <h2 className="sg-title">{title}</h2>
      <div className="sg-board pp-board">
        {(task.view === "coins" || task.view === "scheme") && <Picture view={task.view} places={places} digit={digit} />}
        <div className={`pp-row${parts.length > 2 ? " pp-row--long" : ""}${words ? " pp-row--words" : ""}`}>
          {split ? <>{numberShown}<span className="pp-op">=</span>{plusJoined(fields.map((_, i) => field(i)))}</>
            : <>{plusJoined(parts.map((p) => <span key={p.key} className="pp-part">{colored(p.value, p.key)}</span>))}<span className="pp-op">=</span>{field(0)}</>}
        </div>
        {support && <section className={`sg-card tb-table pp-support${places.length === 3 ? " hd-table" : ""}`} aria-hidden="true">
          {places.map((k) => <div key={k} className={`tb-col tb-col--${k}`}><h3 className={`sg-head sg-head--${k}`}>{PLACE[k].label}</h3><div className={`tb-digit tb-digit--${k}`}>{digit[k]}</div></div>)}
        </section>}
      </div>
      <div className="sg-answer">
        <div className="sg-status" role="status">
          {solved ? null : note ? <span className="sg-status-note">{note}</span> : null}
        </div>
        <div className="sg-slot">
          {solved ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : <Keypad typed={typed} onEnter={enter} grid={mode !== "phone"} canEnter />}
        </div>
      </div>
    </div>
  </div>;
}
