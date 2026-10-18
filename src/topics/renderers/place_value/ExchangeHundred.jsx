import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { SchemeHundred, SchemeOne, SchemeTen } from "./CoinBlocks.jsx";
import { useCoinExchange } from "./useCoinExchange.js";
import { AnswerField, Keypad, useAutoCheck, useTypedAnswer } from "./FieldPad.jsx";
import TenFrame from "./TenFrame.jsx";
import ExchangeFlight, { CarryDigit, EnoughChoice } from "./ExchangeFlight.jsx";
import "./place_value.css";
import "./coins.css";
import "./exchange.css";
import "./group_ten.css";
import "./exchange_ten.css";
import "./table.css";
import "./hundreds.css";

// «Плюс и минус через десяток», «Числа: до 1000»: one crossing of a hundred
// (190 + 20, 210 − 30) — the second number is always round tens. The same
// mechanics one place up: on the «Схема» the ten-frame holds sticks (tens),
// a hundred square opens into ten sticks, a full frame of sticks folds into a
// square; the ones (dots) lie aside untouched. On the «Таблица» it's the
// column with three places. No coins: five plates plus a frame of stacks
// don't fit a phone. Borrowing through a zero (305 − 7) is left to the
// «Столбик» topic. See docs/place-value-methodology.md, «Сотни».

const SIZES = { phone: 18, tablet: 28, wide: 32 };
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
const head = (key, name) => <h3 className={`sg-head sg-head--${key}`}>{name}</h3>;

export function ExchangeHundredScheme({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const give = task.op === "give";
  const teaching = task.supportMode !== "independent";
  const sign = give ? "−" : "+";
  const kT = task.k / 10;
  const [model, setModel] = useState(() => ({
    hundreds: Array.from({ length: task.start.hundreds }, (_, i) => `h${i}`),
    frame: Array.from({ length: task.start.tens }, (_, i) => `t${i}`),
    tray: give ? [] : Array.from({ length: kT }, (_, i) => `g${i}`),
    moved: 0, serial: 0,
  }));
  const [phase, setPhase] = useState("act");
  const [note, setNote] = useState("");
  const typed = useTypedAnswer(4);
  const [ref, mode] = useScreenMode();
  const boardRef = useRef(null);
  const exchange = useCoinExchange(boardRef);
  const left = kT - model.moved;
  const frameFull = model.frame.length === 10;
  const done = phase === "done";
  const acting = phase === "act" && !exchange.busy;

  function change(update) { if (!acting) return; setModel(update); setNote(""); }
  const takeOut = (id) => { if (give && left > 0) change((m) => ({ ...m, frame: m.frame.filter((x) => x !== id), moved: m.moved + 1 })); };
  const bringIn = () => { if (!give && left > 0 && !frameFull) change((m) => ({ ...m, tray: m.tray.slice(1), frame: [...m.frame, m.tray[0]], moved: m.moved + 1 })); };
  function breakHundred(id) {
    if (!give || !acting || left === 0 || model.frame.length) return;
    const ids = Array.from({ length: 10 }, (_, i) => `b${model.serial}-${i}`);
    const apply = (m) => ({ ...m, hundreds: m.hundreds.filter((x) => x !== id), frame: ids, serial: m.serial + 1 });
    if (!exchange.start({ direction: "ungroup", stackId: id, coinIds: ids, commit: () => setModel(apply) })) change(apply);
  }
  function closeFrame() {
    if (give || !acting || !frameFull) return;
    const id = `n${model.serial}`;
    const apply = (m) => ({ ...m, frame: [], hundreds: [...m.hundreds, id], serial: m.serial + 1 });
    if (!exchange.start({ direction: "group", stackId: id, coinIds: model.frame, commit: () => setModel(apply) })) change(apply);
  }
  useEffect(() => { if (phase === "act" && left === 0 && !frameFull && !exchange.busy) setPhase("answer"); }, [phase, left, frameFull, exchange.busy]);

  function enter() {
    if (!typed.digits || phase !== "answer") return;
    if (Number(typed.digits) === task.result) { typed.reset(); setPhase("done"); setNote(""); return; }
    typed.fail();
    setNote(teaching ? "Посчитай сотни, десятки и единицы ещё раз." : "Проверь число ещё раз.");
    onMistake?.(task.conceptId, task.cardId, { given: typed.digits, expected: String(task.result) }); onFlashIncorrect?.();
  }
  const hint = !teaching || phase !== "act" ? null
    : give ? (left > 0 ? (model.frame.length ? "Убери десяток из рамки — нажми на палочку." : "В рамке пусто, а убрать нужно ещё. Нажми на сотню — она рассыпется в десять десятков.") : null)
      : frameFull ? "Рамка полная — нажми на неё, и десять десятков станут сотней." : left > 0 ? "Перенеси десяток в рамку — нажми на него." : null;
  const canBreak = give && acting && left > 0 && !model.frame.length;
  const answering = phase !== "act";

  return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} xt-screen hd-screen hd-scheme`}
    style={{ "--coin-size": mode === "phone" ? "min(18px, calc((100vw - 40px) / 22))" : `${SIZES[mode]}px`, "--sg-answer-w": "320px" }}>
    <div className="sg-inner">
      <h2 className="sg-title xt-example">{task.number} <span className={`xt-sign xt-sign--${task.op}`}>{sign}</span> {task.k} = <span className="xt-q">{done ? task.result : "?"}</span></h2>
      <div className="sg-board hd-board xh-board" ref={boardRef}>
        <section className="sg-card hd-bench">
          <div className="hd-headcell">{head("hundreds", "Сотни")}</div>
          <div className="hd-headcell">{head("tens", "Десятки")}</div>
          <div className="hd-headcell">{head("ones", "Единицы")}</div>
          <div className="hd-zone hd-zone--hundreds">
            {model.hundreds.map((id, i) => <button type="button" key={id} data-stack-id={id} className={`hd-piece${exchange.pendingStack === id ? " px-pending" : ""}`}
              aria-label={`Сотня ${i + 1}`} disabled={!canBreak} onClick={() => breakHundred(id)}><SchemeHundred /></button>)}
          </div>
          <div className="xh-frame">
            <TenFrame One={SchemeTen} oneName="Десяток" closeLabel="Сложить сотню" tall coinIds={model.frame} pendingIds={exchange.pendingCoins}
              onReturn={takeOut} onClose={closeFrame} tapToClose closable={!give} disabled={!acting || (give ? left === 0 : !frameFull)} glow={!give && frameFull} />
          </div>
          <div className="hd-zone hd-zone--ones"><div className="px-coin-block">{Array.from({ length: task.start.ones }, (_, i) => <span key={i} className="hd-piece"><SchemeOne /></span>)}</div></div>
        </section>
        <section className={`sg-card xt-tray xt-tray--${task.op}${answering ? " xt-tray--gone" : ""}`} aria-hidden={answering}>
          <span className="xt-tray-label">{sign}{task.k}</span>
          <div className="xh-tray">
            {Array.from({ length: kT }, (_, i) => {
              if (give) return i < model.moved ? <span key={i} className="xt-gone hd-piece"><SchemeTen /></span> : <span key={i} className="xh-slot" />;
              const id = model.tray[i - model.moved];
              return i < model.moved ? <span key={i} className="xh-slot" />
                : <button type="button" key={id} className="hd-piece" aria-label="Десяток из лотка" disabled={!acting || frameFull} onClick={bringIn}><SchemeTen /></button>;
            })}
          </div>
        </section>
      </div>
      <div className="sg-answer">
        <div className={`sg-num sg-reveal${answering ? " sg-show" : ""}`}>
          <AnswerField label={give ? "Сколько осталось?" : "Сколько стало?"} tone="total" big ok={done} active={phase === "answer"} wrong={typed.wrong}
            value={done ? task.result : phase === "answer" ? typed.digits : ""} />
        </div>
        <div className="sg-status" role="status">
          {done ? null : note ? <span className="sg-status-note">{note}</span> : hint ? <span className="sg-status-hint">{hint}</span> : null}
        </div>
        <div className="sg-slot">
          {done ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : <div className={`sg-reveal${answering ? " sg-show" : ""}`}><Keypad off={phase !== "answer"} typed={typed} onEnter={enter} grid={mode !== "phone"} /></div>}
        </div>
      </div>
    </div>
  </div>;
}

// The column plan, ones first; the second number is round tens. Borrowing
// adds two steps of its own, written over the crossed digits: what is left of
// the hundreds (7 − 1) and how many tens there are now (10 + 1).
export function hundredSteps(task) {
  const { hundreds: h, tens: t, ones: o } = task.start;
  const kT = task.k / 10;
  if (task.op === "get") {
    const sum = t + kT, carry = sum >= 10 ? 1 : 0;
    return {
      carry, borrow: 0, result: { hundreds: h + carry, tens: sum % 10, ones: o },
      steps: [
        { key: "ones", label: "Единицы", text: `${o} + 0 =`, expected: o },
        { key: "tens", label: "Десятки", text: `${t} + ${kT} =`, expected: sum },
        { key: "hundreds", label: "Сотни", text: carry ? `${h} + 1 =` : "не меняются:", expected: h + carry },
      ],
    };
  }
  const borrow = t < kT ? 1 : 0;
  return {
    carry: 0, borrow, result: { hundreds: h - borrow, tens: t + 10 * borrow - kT, ones: o },
    steps: [
      { key: "ones", label: "Единицы", text: `${o} − 0 =`, expected: o },
      { key: "enough", label: "Десятки", text: `${t} − ${kT}: десятков хватает?`, expected: !borrow, choice: true },
      ...(borrow ? [
        { key: "overH", label: "Сотни", tone: "hundreds", text: `${h} − 1 =`, expected: h - 1 },
        { key: "overT", label: "Десятки", tone: "tens", text: `10 + ${t} =`, expected: 10 + t },
      ] : []),
      { key: "tens", label: "Десятки", text: `${borrow ? 10 + t : t} − ${kT} =`, expected: t + 10 * borrow - kT },
      { key: "hundreds", label: "Сотни", text: "не меняются:", expected: h - borrow },
    ],
  };
}

export function ExchangeHundredTable({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const plus = task.op === "get";
  const sign = plus ? "+" : "−";
  const { hundreds: h, tens: t, ones: o } = task.start;
  const kT = task.k / 10;
  const plan = hundredSteps(task);
  const steps = teaching ? plan.steps : [{ key: "total", label: plus ? "Сколько стало?" : "Сколько осталось?", expected: task.result }];
  const [ref, mode] = useScreenMode();
  const typed = useTypedAnswer(4);
  const [step, setStep] = useState(0);
  const [note, setNote] = useState("");
  const [support, setSupport] = useState(false);
  // The exchange shown: "split" — a hundred into ten tens with the scheme's
  // pieces; "carry" — the sum's ten flies up over the hundreds as a digit.
  // The table catches up after it.
  const [flight, setFlight] = useState(null);
  // «Хватает?» answered wrong → «Что больше?» first; then the result stays shown.
  const [comparing, setComparing] = useState(false);
  const [compared, setCompared] = useState(false);
  const boardRef = useRef(null), hRef = useRef(null), tRef = useRef(null), overHRef = useRef(null), resTRef = useRef(null);
  const solved = step >= steps.length;
  const current = steps[step];
  const passed = (key) => { const i = steps.findIndex((s) => s.key === key); return i >= 0 && i < step; };
  // The typed digits are still there when a submitted guess fails.
  const fail = (message) => { setNote(message); onMistake?.(task.conceptId, task.cardId, typed.digits ? { field: current.key === "total" ? null : current.label, given: typed.digits, expected: String(current.expected) } : undefined); onFlashIncorrect?.(); };

  function submit(guess) {
    if (solved) return false;
    if (guess === current.expected) {
      setNote(""); setStep(step + 1);
      if (current.key === "tens" && plan.carry) setFlight("carry");
      return true;
    }
    if (!teaching) fail("Проверь число ещё раз.");
    else if (current.key === "tens") { fail(`Посчитай ещё раз: ${current.text.replace(" =", "")}.`); setSupport(true); }
    else if (current.key === "hundreds" && plan.carry && guess === h) fail("Не забудь сотню, которая пришла из десятков.");
    else if (current.key === "overH") fail("Одну сотню отдали десяткам. Сколько сотен осталось?");
    else if (current.key === "overT") fail("Сотня — это 10 десятков. Сколько десятков стало?");
    else if (current.key === "hundreds" && plan.borrow && guess === h) fail("Одну сотню мы отдали десяткам.");
    else fail(current.key === "ones" ? "Единицы не меняются: мы прибавляем и вычитаем только десятки." : `Посчитай сотни: ${current.text.replace(" =", "")}.`);
    return false;
  }
  function choose(enough) {
    if (enough === current.expected) {
      setNote(""); setStep(step + 1);
      if (!enough) setFlight("split");
      return;
    }
    // No ready answer: the child compares the two numbers first.
    fail("Сначала сравни числа десятков.");
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

  const borrowed = plan.borrow && passed("enough") && flight !== "split";
  const done = (key) => (teaching ? passed(key) : solved);
  const cell = (v, kind, extra = "", ref = undefined) => <span ref={ref} className={`xb-cell tb-digit--${kind}${extra}`}>{v}</span>;
  const lit = comparing ? " xb-cell--compare" : "";
  // Over a crossed digit: nothing until its own step, the child's digits while
  // he types them there, his answer after.
  const over = (key, value) => (passed(key) ? <span className="xb-carry">{value}</span>
    : current?.key === key ? <span className="xb-carry xb-carry--live">{typed.digits || "?"}</span> : null);
  const sticks = (n) => <span className="xh-dots">{Array.from({ length: n }, (_, i) => <SchemeTen key={i} />)}</span>;

  return <div ref={ref} className={`pv-screen sg-screen sg-screen--${mode} tb-screen xb-screen`} style={{ "--sg-answer-w": "340px" }}>
    <div className="sg-inner">
      <h2 className="sg-title xt-example">{task.number} <span className={`xt-sign xt-sign--${task.op}`}>{sign}</span> {task.k} = <span className="xt-q">{solved ? task.result : "?"}</span></h2>
      <div className="sg-board">
        <section ref={boardRef} className="sg-card xb-table xh-table" aria-label="Пример по разрядам">
          <span />{head("hundreds", "Сотни")}{head("tens", "Десятки")}{head("ones", "Единицы")}
          <span />
          <span ref={overHRef} className="xb-over xb-over--hundreds">{plan.carry && done("tens") && flight !== "carry" ? <span className="xb-carry">1</span> : borrowed ? over("overH", h - 1) : null}</span>
          <span className="xb-over xb-over--tens">{borrowed ? over("overT", 10 + t) : null}</span>
          <span />
          <span />
          {cell(h, "hundreds", borrowed ? " xb-crossed" : "", hRef)}
          {cell(t, "tens", (borrowed ? " xb-crossed" : "") + lit, tRef)}
          {cell(o, "ones")}
          <span className={`xb-sign xt-sign--${task.op}`}>{sign}</span>
          {cell("", "hundreds")}
          {cell(kT, "tens", lit)}
          {cell(0, "ones")}
          <span className="xb-rule" />
          <span />
          {cell(done("hundreds") ? plan.result.hundreds : "", "hundreds", " xb-result")}
          {cell(done("tens") ? plan.result.tens : "", "tens", " xb-result", resTRef)}
          {cell(done("ones") ? plan.result.ones : "", "ones", " xb-result")}
          {flight === "split" && <ExchangeFlight boardRef={boardRef} Big={SchemeHundred} Small={SchemeTen}
            bigRef={hRef} smallRef={tRef} overRef={overHRef} bigCount={h} smallCount={t} onDone={() => setFlight(null)} />}
          {flight === "carry" && <CarryDigit boardRef={boardRef} fromRef={resTRef} toRef={overHRef} digit={1} place="hundreds" onDone={() => setFlight(null)} />}
        </section>
        {support && teaching && !done("tens") && <div className="xb-support xh-support" aria-hidden="true">
          {sticks(borrowed ? 10 + t : t)}<b>{sign}</b>{sticks(kT)}
        </div>}
      </div>
      <div className="sg-answer">
        {!solved && teaching && <div className={`xb-step${current.choice ? " xb-step--choice" : ""}`}>
          {/* Two lines: which place, big, then the sum to do in it. */}
          <span className={`xb-step-head xb-step-head--${current.tone ?? (current.key === "enough" ? "tens" : current.key)}`}>{current.label}</span>
          <div className="xb-step-line">
            <span className="xb-step-text">{current.text}</span>
            {!current.choice && <AnswerField label={current.label} tone={current.tone ?? current.key} bare active wrong={typed.wrong} value={typed.digits} />}
          </div>
        </div>}
        {!teaching && <div className="sg-num">
          <AnswerField label={steps[0].label} tone="total" big ok={solved} active={!solved} wrong={typed.wrong} value={solved ? task.result : typed.digits} />
        </div>}
        <div className="sg-status" role="status">
          {solved ? null : note ? <span className="sg-status-note">{note}</span> : null}
        </div>
        {/* While the pieces fly, the answer waits: look first, then write. */}
        <div className={`sg-slot${flight ? " xf-wait" : ""}`}>
          {solved ? <Button disabled={Boolean(flight)} onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : current.choice ? <EnoughChoice top={t} bottom={kT} compared={compared} comparing={comparing} onChoose={choose} onCompare={compare} />
              : <Keypad typed={typed} onEnter={enter} grid={mode !== "phone"} canEnter={!teaching} />}
        </div>
      </div>
    </div>
  </div>;
}
