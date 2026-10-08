import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { placeValuePhrase, numberWords, pluralTens, pluralOnes } from "./placeValueLabels.js";
import NumberAnswer from "./NumberAnswer.jsx";
import "./place_value.css";
import "./coins.css";
import "./exchange.css";
import "./group.css";
import "./identify.css";

// «Какое это число?» — read a ready model. Three layouts (task.layout, see
// identifyLayout in engine.js): coins in their places, everything mixed in one
// zone (loose coins sit left of the stacks on purpose), or more than nine
// loose coins. «Обучение» asks in three steps — tens, ones, the number — and
// offers «Посчитать» (tick off what's been counted); «Проверка» asks for the
// number only. See docs/place-value-methodology.md, режим 2.

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
      { key: "tens", label: "Сколько десятков?", tone: "tens", expected: tens },
      { key: "ones", label: layout === "over9" ? "Сколько отдельных монет?" : "Сколько единиц?", tone: "ones", expected: ones },
      { key: "total", label: "Какое это число?", tone: "total", expected: task.number },
    ]
    : [{ key: "total", label: "Какое это число?", tone: "total", expected: task.number }];
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [solved, setSolved] = useState(false);
  const [note, setNote] = useState("");
  const [counting, setCounting] = useState(false);
  const [counted, setCounted] = useState([]);
  const [coinSize, setCoinSize] = useState(44);
  const [narrow, setNarrow] = useState(false);
  const mainRef = useRef(null);
  const cols = narrow ? 5 : 8;
  const mixed = useMemo(() => mixedLayout(tens, ones, task.seed, cols), [tens, ones, task.seed, cols]);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return undefined;
    const measure = () => {
      const { width, height } = main.getBoundingClientRect();
      if (!width || !height) return;
      const isNarrow = width < 600;
      const c = isNarrow ? 5 : 8;
      const size = layout === "mixed"
        ? Math.min((width - 40) / (c * 1.3), (height - 50) / (Math.max(2, Math.ceil(((tens + ones) * 1.4) / c)) * 2.4), 52)
        : isNarrow
          // Phones: two zones side by side; tall enough for two rows of stacks or two blocks of coins.
          ? Math.min(((width - 12) / 2 - 24) / 6.3, (height - 52) / Math.max(tens > 5 ? 4.8 : 2.4, ones > 10 ? 5 : 2.4), 40)
          : Math.min((width - 120) / 13.2, (height - 60) / 5.4, 56);
      setNarrow(isNarrow);
      setCoinSize(Math.max(20, size));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    return () => observer.disconnect();
  }, [layout, tens, ones]);

  function toggleCounted(key) {
    if (!counting || solved) return;
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
      if (step === questions.length - 1) { setSolved(true); setCounting(false); } else setStep(step + 1);
      return true;
    }
    setNote(q.key === "tens" ? "Посчитай стопки — каждая стопка это десяток."
      : q.key === "ones" ? "Посчитай отдельные монеты." : totalHint(guess));
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    return false;
  }

  const item = (key, kind) => {
    const content = kind === "stack" ? <TenStack /> : <Coin />;
    const done = counted.includes(key);
    const label = kind === "stack" ? "Десяток" : "Монета";
    return counting
      ? <button type="button" key={key} className={`${kind === "stack" ? "px-stack" : "px-coin"} id-item${done ? " id-item--counted" : ""}`}
        aria-label={label} aria-pressed={done} onClick={() => toggleCounted(key)}>{content}</button>
      : <span key={key} className={`${kind === "stack" ? "px-stack-wrap" : "px-coin px-coin--static"} id-item${done ? " id-item--counted" : ""}`}>{content}</span>;
  };
  const coinBlocks = (count, prefix) => Array.from({ length: Math.ceil(count / 10) }, (_, b) => <div key={b} className="px-coin-block">
    {Array.from({ length: Math.min(10, count - b * 10) }, (_, j) => item(`${prefix}:${b * 10 + j}`, "coin"))}
  </div>);

  const countButton = teaching && <button type="button" className={`px-undo id-count${counting ? " id-count--on" : ""}`}
    onClick={() => { setCounting((c) => !c); setCounted([]); }}>{counting ? "Закончить счёт" : "Посчитать"}</button>;

  return <div className={`pv-screen px-screen gt-screen id-screen${narrow ? " gt-screen--narrow" : ""}`} style={{ "--coin-size": `${coinSize}px` }}>
    <header className="gt-task"><b>Какое это число?</b></header>
    <div className="gt-main gt-main--sorted id-main" ref={mainRef}>
      {layout === "mixed"
        ? <section className="px-zone id-mixed">
          <h3>Монеты</h3>
          <div className="id-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${mixed.rows}, calc(var(--coin-size) * 2.3))` }}>
            {mixed.items.map((it) => <span key={it.key} className="id-cell" style={{ gridColumn: it.col + 1, gridRow: it.row + 1, justifyContent: it.align }}>
              {item(it.key, it.kind)}
            </span>)}
          </div>
        </section>
        : <>
          <section className="px-zone px-zone--tens">
            <h3><span className="px-chip" />Десятки</h3>
            <div className="px-stacks">{Array.from({ length: tens }, (_, i) => item(`tens:${i}`, "stack"))}</div>
          </section>
          <section className="px-zone px-zone--ones">
            <h3><span className="px-chip" />Единицы</h3>
            <div className="px-coins">{coinBlocks(ones, "ones")}</div>
          </section>
        </>}
    </div>
    <div className="px-bottom">
      {!solved ? <div className="gt-ask">
        <div className="gt-questions">
          {questions.map((q, i) => <div key={q.key} className={`gt-q gt-q--${q.tone}${i === step ? " gt-q--active" : ""}${answers[q.key] !== undefined ? " gt-q--ok" : ""}`}>
            <span>{q.label}</span><span className="gt-q-value">{answers[q.key] ?? (i === step ? "?" : "")}</span>
          </div>)}
        </div>
        {/* Three digits allowed on purpose: «214» and «203» are the mistakes to catch. */}
        <NumberAnswer key={step} onSubmit={answer} maxDigits={3} extra={narrow && countButton} />
        {!narrow && countButton}
        {note && <div className="px-note" role="status">{note}</div>}
        {counting && <p className="id-caption">Нажимай на то, что уже посчитал</p>}
      </div>
        : <div className="px-done" role="status">
          <span className="gt-number">{task.number}</span>
          <div className="px-say">{placeValuePhrase(task.number)}</div>
          <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
        </div>}
    </div>
  </div>;
}
