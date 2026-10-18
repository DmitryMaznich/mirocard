import { useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { SchemeOne, SchemeTen } from "./CoinBlocks.jsx";
import ExchangeFlight, { CarryDigit, EnoughChoice } from "./ExchangeFlight.jsx";
import { AnswerField, Keypad, useAutoCheck, useTypedAnswer } from "./FieldPad.jsx";
import "./place_value.css";
import "./coins.css";
import "./group_ten.css";
import "./table.css";

// «Плюс и минус через десяток» on the «Таблица»: the step right before the
// column («Сложение и вычитание в столбик»). The example stands in place-value
// columns with their headings; the child works the school way, ones first:
//  + «8 + 4 = 12» → 2 goes under the ones, the 1 goes up over the tens;
//  − «2 − 4: единиц хватает?» → «Не хватает» → a ten is borrowed (the tens
//    digit is crossed out, 12 appears over the ones) → «12 − 4 = 8»;
// then the tens. In «Обучение» each step is asked as a small equation and a
// mistake on the ones brings the scheme (dots) back for that sum; in
// «Проверка» the child only writes the result.
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

export function exchangeSteps(task) {
  const plus = task.op === "get";
  const t = task.start.tens, o = task.start.ones;
  const kT = Math.floor(task.k / 10), kO = task.k % 10;
  if (plus) {
    const sum = o + kO, carry = sum >= 10 ? 1 : 0;
    const tensParts = [t, ...(kT ? [kT] : []), ...(carry ? [1] : [])];
    return {
      carry, borrow: 0, onesResult: sum % 10, tensResult: t + kT + carry,
      steps: [
        { key: "ones", label: "Единицы", text: `${o} + ${kO} =`, expected: sum },
        { key: "tens", label: "Десятки", text: tensParts.length > 1 ? `${tensParts.join(" + ")} =` : "не меняются:", expected: t + kT + carry },
      ],
    };
  }
  const borrow = o < kO ? 1 : 0;
  const tensParts = [t, ...(borrow ? [1] : []), ...(kT ? [kT] : [])];
  return {
    carry: 0, borrow, onesResult: o + 10 * borrow - kO, tensResult: t - borrow - kT,
    steps: [
      { key: "enough", label: "Единицы", text: `${o} − ${kO}: единиц хватает?`, expected: !borrow, choice: true },
      { key: "ones", label: "Единицы", text: `${borrow ? 10 + o : o} − ${kO} =`, expected: o + 10 * borrow - kO },
      { key: "tens", label: "Десятки", text: tensParts.length > 1 ? `${tensParts.join(" − ")} =` : "не меняются:", expected: t - borrow - kT },
    ],
  };
}

export default function ExchangeTable({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const plus = task.op === "get";
  const sign = plus ? "+" : "−";
  const t = task.start.tens, o = task.start.ones;
  const kT = Math.floor(task.k / 10), kO = task.k % 10;
  const plan = exchangeSteps(task);
  const steps = teaching ? plan.steps : [{ key: "total", label: plus ? "Сколько стало?" : "Сколько осталось?", text: "", expected: task.result }];
  const [ref, mode] = useScreenMode();
  const typed = useTypedAnswer(2);
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  // The exchange shown: "split" — a ten into ten ones with the scheme's
  // pieces; "carry" — the sum's ten flies up over the tens as a digit.
  // The table catches up after it.
  const [flight, setFlight] = useState(null);
  // «Хватает?» answered wrong → «Что больше?» first; then the result stays shown.
  const [comparing, setComparing] = useState(false);
  const [compared, setCompared] = useState(false);
  const boardRef = useRef(null), tRef = useRef(null), oRef = useRef(null), overTRef = useRef(null), resORef = useRef(null);
  const solved = step >= steps.length;
  const current = steps[step];
  const passed = (key) => steps.findIndex((s) => s.key === key) < step && steps.some((s) => s.key === key);

  function fail(message) {
    setNote(message);
    // The typed digits are still there when a submitted guess fails.
    onMistake?.(task.conceptId, task.cardId, typed.digits ? { field: current.key === "total" ? null : current.label, given: typed.digits, expected: String(current.expected) } : undefined); onFlashIncorrect?.();
  }
  function submit(guess) {
    if (solved) return false;
    if (guess === current.expected) {
      setNote(""); setStep(step + 1);
      if (current.key === "ones" && plan.carry) setFlight("carry");
      return true;
    }
    if (!teaching) fail("Проверь число ещё раз.");
    else if (current.key === "ones") { fail(`Посчитай ещё раз: ${current.text.replace(" =", "")}.`); setSupport(true); }
    else if (current.key === "tens" && plan.carry && guess === t + kT) fail("Не забудь десяток, который пришёл из единиц.");
    else if (current.key === "tens" && plan.borrow && guess === t - kT) fail("Один десяток мы отдали единицам.");
    else fail(`Посчитай десятки: ${current.text.replace(" =", "")}.`);
    return false;
  }
  function choose(enough) {
    if (enough === current.expected) {
      setNote(""); setStep(step + 1);
      if (!enough) setFlight("split");
      return;
    }
    // No ready answer: the child compares the two numbers first.
    fail("Сначала сравни числа единиц.");
    setComparing(true);
  }
  function compare(right) {
    if (right) { setComparing(false); setCompared(true); setNote(""); return; }
    setNote("Посмотри на числа в таблице ещё раз."); onFlashIncorrect?.();
  }
  const typing = !solved && !current.choice;
  useAutoCheck(typed, { auto: typing && teaching, expected: typing ? current.expected : "", submit });
  function enter() {
    if (!typed.digits || !typing || teaching) return;
    if (submit(Number(typed.digits))) typed.reset(); else typed.fail();
  }

  // What the table shows so far.
  const borrowed = plan.borrow && passed("enough") && flight !== "split";
  const onesDone = teaching ? passed("ones") : solved;
  const tensDone = teaching ? passed("tens") : solved;
  const digit = (v, kind, extra = "", ref = undefined) => <span ref={ref} className={`xb-cell tb-digit--${kind}${extra}`}>{v}</span>;
  const lit = comparing ? " xb-cell--compare" : "";

  const dots = (n, kind) => <span className={`xb-dots xb-dots--${kind}`}>{Array.from({ length: n }, (_, i) => <SchemeOne key={i} />)}</span>;
  const status = solved ? null
    : note ? <span className="sg-status-note">{note}</span> : null;

  return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} tb-screen xb-screen`} style={{ "--sg-answer-w": "340px" }}>
    <div className="sg-inner">
      <h2 className="sg-title xt-example">{task.number} <span className={`xt-sign xt-sign--${task.op}`}>{sign}</span> {task.k} = <span className="xt-q">{solved ? task.result : "?"}</span></h2>
      <div className="sg-board">
        <section ref={boardRef} className="sg-card xb-table" aria-label="Пример по разрядам">
          <span />
          <h3 className="sg-head sg-head--tens">Десятки</h3>
          <h3 className="sg-head sg-head--ones">Единицы</h3>

          <span />
          <span ref={overTRef} className="xb-over xb-over--tens">{plan.carry && onesDone && flight !== "carry" ? <span className="xb-carry">1</span> : borrowed && tensDone ? <span className="xb-carry">{t - 1}</span> : null}</span>
          <span className="xb-over xb-over--ones">{borrowed ? <span className="xb-carry xb-carry--ones">{10 + o}</span> : null}</span>

          <span />
          {digit(t, "tens", borrowed ? " xb-crossed" : "", tRef)}
          {digit(o, "ones", (borrowed ? " xb-crossed" : "") + lit, oRef)}

          <span className={`xb-sign xt-sign--${task.op}`}>{sign}</span>
          {digit(kT || "", "tens")}
          {digit(kO, "ones", lit)}

          <span className="xb-rule" />

          <span />
          {digit(tensDone ? plan.tensResult : "", "tens", " xb-result")}
          {digit(onesDone ? plan.onesResult : "", "ones", " xb-result", resORef)}
          {flight === "split" && <ExchangeFlight boardRef={boardRef} Big={SchemeTen} Small={SchemeOne}
            bigRef={tRef} smallRef={oRef} overRef={overTRef} bigCount={t} smallCount={o} onDone={() => setFlight(null)} />}
          {flight === "carry" && <CarryDigit boardRef={boardRef} fromRef={resORef} toRef={overTRef} digit={1} place="tens" onDone={() => setFlight(null)} />}
        </section>
        {support && teaching && !onesDone && <div className="xb-support" aria-hidden="true">
          {plus ? <>{dots(o, "a")}<b>+</b>{dots(kO, "b")}</> : <>{dots(borrowed ? 10 + o : o, "a")}<b>−</b>{dots(kO, "b")}</>}
        </div>}
      </div>
      <div className="sg-answer">
        {!solved && teaching && <div className={`xb-step${current.choice ? " xb-step--choice" : ""}`}>
          {/* Two lines: which place, big, then the sum to do in it. */}
          <span className={`xb-step-head xb-step-head--${current.tone ?? (current.key === "tens" ? "tens" : "ones")}`}>{current.label}</span>
          <div className="xb-step-line">
            <span className="xb-step-text">{current.text}</span>
            {!current.choice && <AnswerField label={current.label} tone={current.tone ?? (current.key === "tens" ? "tens" : "ones")} bare active wrong={typed.wrong} value={typed.digits} />}
          </div>
        </div>}
        {!teaching && <div className="sg-num">
          <AnswerField label={steps[0].label} tone="total" big ok={solved} active={!solved} wrong={typed.wrong} value={solved ? task.result : typed.digits} />
        </div>}
        <div className="sg-status" role="status">{status}</div>
        {/* While the pieces fly, the answer waits: look first, then write. */}
        <div className={`sg-slot${flight ? " xf-wait" : ""}`}>
          {solved ? <Button disabled={Boolean(flight)} onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : current.choice ? <EnoughChoice top={o} bottom={kO} compared={compared} comparing={comparing} onChoose={choose} onCompare={compare} />
              : <Keypad typed={typed} onEnter={enter} grid={mode !== "phone"} canEnter={!teaching} />}
        </div>
      </div>
    </div>
  </div>;
}
