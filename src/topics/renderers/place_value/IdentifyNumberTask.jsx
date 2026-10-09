import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { numberWords, pluralTens, pluralOnes } from "./placeValueLabels.js";
import { AnswerField, Keypad, useAutoCheck, useTypedAnswer } from "./FieldPad.jsx";
import "./place_value.css";
import "./coins.css";
import "./exchange.css";
import "./group_ten.css";
import "./identify.css";

// «Какое это число?» — read a ready model. Three layouts (task.layout, see
// identifyLayout in engine.js): coins in their places, everything mixed in one
// zone (loose coins sit left of the stacks on purpose), or more than nine
// loose coins. «Обучение» asks in three steps — tens, ones, the number — and
// lets the child tick off what's been counted (a tap on a stack or coin; the
// ticks clear at the next question); «Проверка» asks for the number only.
// Same composed, still screen as «Сложи по десять» (group_ten.css): one coin
// size per task, every element's place reserved. See
// docs/place-value-methodology.md, режим 2.

const WIDE_ANSWER = 320; // px, the answer column on a landscape tablet
const COUNT_HINT_MS = 8000;

function seededRandom(seed) {
  let value = seed % 233280;
  return () => { value = (value * 9301 + 49297) % 233280; return value / 233280; };
}

// One shared zone: every item gets its own grid cell (stack-tall), cells are
// shuffled, then the leftmost cells go to the loose coins.
export function mixedLayout(tens, ones, seed, cols) {
  const total = tens + ones;
  const rows = Math.max(2, Math.ceil((total * 1.4) / cols));
  const random = seededRandom(seed || 1);
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push([x, y]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const chosen = cells.slice(0, total).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const items = chosen.map(([col, row], i) => ({
    key: i < ones ? `ones:${i}` : `tens:${i - ones}`,
    kind: i < ones ? "coin" : "stack",
    col, row,
    align: ["flex-start", "center", "flex-end"][Math.floor(random() * 3)],
  }));
  return { rows, items };
}

export default function IdentifyNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const layout = task.layout ?? "places";
  const { tens, ones } = task.model;
  const questions = teaching
    ? [
      { key: "tens", label: "Десятки", tone: "tens", expected: tens },
      { key: "ones", label: layout === "over9" ? "Отдельных монет" : "Единицы", tone: "ones", expected: ones },
      { key: "total", label: "Какое это число?", tone: "total", expected: task.number },
    ]
    : [{ key: "total", label: "Какое это число?", tone: "total", expected: task.number }];
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [solved, setSolved] = useState(false);
  const [note, setNote] = useState("");
  const [counted, setCounted] = useState([]);
  const [countHint, setCountHint] = useState(false);
  const typed = useTypedAnswer(3); // three digits on purpose: «214» and «304» are the mistakes to catch
  const [coinSize, setCoinSize] = useState(32);
  const [mode, setMode] = useState("phone");
  const appliedSize = useRef(32);
  appliedSize.current = coinSize;
  const screenRef = useRef(null);
  const innerRef = useRef(null);

  const cols = mode === "phone" ? 5 : 8;
  const mixed = useMemo(() => mixedLayout(tens, ones, task.seed, cols), [tens, ones, task.seed, cols]);
  const stackCols = Math.min(5, Math.max(1, tens)), stackRows = Math.max(1, Math.ceil(tens / 5));
  const blocks = Math.max(1, Math.ceil(ones / 10));

  // One coin size per task, fitted on the real layout (see GroupTenTask).
  useLayoutEffect(() => {
    const screen = screenRef.current, inner = innerRef.current;
    if (!screen || !inner) return undefined;
    const measure = () => {
      const W = screen.clientWidth, H = screen.clientHeight;
      if (!W || !H) return;
      const next = W >= 900 && W > H * 1.15 ? "wide" : W < 600 ? "phone" : "tablet";
      if (next !== mode) { setMode(next); return; }
      const cap = mode === "phone" ? 44 : 64;
      const cs = getComputedStyle(screen);
      const bw = W - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (mode === "wide" ? WIDE_ANSWER + 32 : 0);
      const byWidth = layout === "mixed" ? (bw - 32) / (cols * 1.35) : (bw - 56) / (stackCols * 1.3 + 7.4);
      const room = H - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const fits = (c) => { screen.style.setProperty("--coin-size", `${c}px`); return inner.offsetHeight <= room; };
      let lo = 14, hi = Math.max(14, Math.min(cap, byWidth));
      if (fits(hi)) lo = hi;
      else for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
      screen.style.setProperty("--coin-size", `${appliedSize.current}px`);
      setCoinSize(Math.floor(lo * 10) / 10);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(screen);
    return () => observer.disconnect();
  }, [mode, layout, cols, stackCols, stackRows, blocks, teaching, mixed.rows]);

  // «Обучение»: if nothing happens for a while, say that items can be ticked off.
  useEffect(() => {
    if (!teaching || solved || counted.length || typed.digits) { setCountHint(false); return undefined; }
    const timer = setTimeout(() => setCountHint(true), COUNT_HINT_MS);
    return () => clearTimeout(timer);
  }, [teaching, solved, counted.length, typed.digits, step]);

  function toggleCounted(key) {
    if (!teaching || solved) return;
    setCounted((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));
  }
  function totalHint(guess) {
    if (!teaching) return "Проверь число ещё раз.";
    if (layout === "over9" && String(guess) === `${tens}${ones}`) return "Единиц не может быть больше девяти. Что можно сложить из десяти монет?";
    if (tens !== ones && ones <= 9 && guess === ones * 10 + tens) return "Сколько стопок? Стопки — это десятки, их пишут первыми.";
    if (tens && ones && ones <= 9 && guess === tens * 100 + ones) {
      const words = numberWords(task.number);
      return `${words[0].toUpperCase()}${words.slice(1)} — это ${tens} ${pluralTens(tens)} и ${ones} ${pluralOnes(ones)}. Сколько цифр нужно?`;
    }
    return "Посчитай стопки и отдельные монеты ещё раз.";
  }
  function answer(guess) {
    const q = questions[step];
    if (guess === q.expected) {
      setAnswers((a) => ({ ...a, [q.key]: guess }));
      setNote("");
      setCounted([]);
      if (step === questions.length - 1) setSolved(true); else setStep(step + 1);
      return true;
    }
    setNote(q.key === "tens" ? "Посчитай стопки — каждая стопка это десяток."
      : q.key === "ones" ? "Посчитай отдельные монеты." : totalHint(guess));
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    return false;
  }
  function enter() {
    if (!typed.digits || solved) return;
    if (answer(Number(typed.digits))) typed.reset(); else typed.fail();
  }
  // Tens and ones check themselves; only the number is confirmed by hand.
  const autoField = !solved && questions[step].key !== "total";
  useAutoCheck(typed, { auto: autoField, expected: questions[step].expected, submit: answer });
  const field = (key, big) => {
    const i = questions.findIndex((q) => q.key === key);
    if (i < 0) return null;
    const q = questions[i], ok = answers[q.key] !== undefined, active = !solved && i === step;
    return <AnswerField label={q.label} tone={q.tone} big={big} bare={!big && q.label !== "Отдельных монет"} ok={ok} active={active}
      wrong={typed.wrong} value={ok ? answers[q.key] : active ? typed.digits : ""} />;
  };

  // A stack or a coin: in «Обучение» a tap ticks it as counted.
  const item = (key, kind) => {
    const content = kind === "stack" ? <TenStack /> : <Coin />;
    const done = counted.includes(key);
    const cls = `${kind === "stack" ? "px-stack-wrap" : "px-coin"} id-item${done ? " id-item--counted" : ""}`;
    return teaching
      ? <button type="button" key={key} className={cls} aria-label={kind === "stack" ? "Десяток" : "Монета"} aria-pressed={done}
        disabled={solved} onClick={() => toggleCounted(key)}>{content}</button>
      : <span key={key} className={cls}>{content}</span>;
  };
  const coinBlocks = (count) => Array.from({ length: Math.ceil(count / 10) }, (_, b) => <div key={b} className="px-coin-block">
    {Array.from({ length: Math.min(10, count - b * 10) }, (_, j) => item(`ones:${b * 10 + j}`, "coin"))}
  </div>);
  const heads = <>
    <h3 className="sg-head sg-head--tens"><span className="sg-chip" />Десятки</h3>
    <h3 className="sg-head sg-head--ones"><span className="sg-chip" />Единицы</h3>
  </>;

  const status = solved ? null
    : note ? <span className="sg-status-note">{note}</span>
      : countHint ? <span className="sg-status-hint">Можно отмечать посчитанное — нажимай на стопки и монеты.</span> : null;

  return <div ref={screenRef} className={`pv-screen sg-screen sg-screen--${mode} id-screen`}
    style={{ "--coin-size": `${coinSize}px`, "--sg-stack-cols": stackCols, "--sg-stack-rows": stackRows, "--id-cols": cols, "--id-blocks": blocks, "--sg-answer-w": `${WIDE_ANSWER}px` }}>
    <div className="sg-inner" ref={innerRef}>
      <h2 className="sg-title">Сколько здесь монет?</h2>
      <div className="sg-board id-board">
        {layout === "mixed"
          ? <>
            <section className="sg-card id-mixed">
              <div className="id-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${mixed.rows}, calc(var(--coin-size) * 2.3))` }}>
                {mixed.items.map((it) => <span key={it.key} className="id-cell" style={{ gridColumn: it.col + 1, gridRow: it.row + 1, justifyContent: it.align }}>
                  {item(it.key, it.kind)}
                </span>)}
              </div>
            </section>
            {teaching && <section className="sg-card sg-bench id-fields">{heads}{field("tens")}{field("ones")}</section>}
          </>
          : <section className="sg-card sg-bench">
            {heads}
            <div className="sg-stacks">{Array.from({ length: tens }, (_, i) => item(`tens:${i}`, "stack"))}</div>
            <div className="id-ones">{coinBlocks(ones)}</div>
            {teaching && field("tens")}
            {teaching && field("ones")}
          </section>}
      </div>
      <div className="sg-answer">
        <div className="sg-num">{field("total", true)}</div>
        <div className="sg-status" role="status">{status}</div>
        <div className="sg-slot">
          {solved ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : <Keypad typed={typed} onEnter={enter} grid={mode !== "phone"} canEnter={!autoField} />}
        </div>
      </div>
    </div>
  </div>;
}
