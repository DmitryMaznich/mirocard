import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { modelPieces } from "./CoinBlocks.jsx";
import { IdentifyTableTask } from "./TableTasks.jsx";
import { numberWords, pluralTens, pluralOnes, placeValuePhrase } from "./placeValueLabels.js";
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
// Same composed, still screen as «Собери десяток» (group_ten.css): one coin
// size per task, every element's place reserved. See
// docs/place-value-methodology.md, режим 2.

const WIDE_ANSWER = 320; // px, the answer column on a landscape tablet
const COUNT_HINT_MS = 8000;
const FLY_MS = 800; // «Схема»: the tens and ones digits travel into the number

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

// «Таблица» has its own screen (TableTasks.jsx); coins and the scheme share this one.
export default function IdentifyNumberTask(props) {
  return props.task.view === "table" ? <IdentifyTableTask {...props} /> : <IdentifyNumberTaskModel {...props} />;
}

function IdentifyNumberTaskModel({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const layout = task.layout ?? "places";
  const scheme = task.view === "scheme";
  const { One, Ten } = modelPieces(task.view);
  const loose = scheme ? "точек" : "монет";
  // «Больше девяти» in «Обучение» teaches the exchange instead of testing it:
  // the full block of ten loose ones is framed, the child taps it, it turns
  // into one more ten, and only then the usual tens → ones → number steps run
  // on the regrouped model. In «Проверка» the model stays as given.
  const groupStep = teaching && layout === "over9";
  const [grouped, setGrouped] = useState(false);
  const [grouping, setGrouping] = useState(false);
  const extra = groupStep && grouped ? 1 : 0;
  const tens = task.model.tens + extra, ones = task.model.ones - extra * 10;
  const waitGroup = groupStep && !grouped;
  const questions = teaching
    ? [
      { key: "tens", label: "Десятки", tone: "tens", expected: tens },
      { key: "ones", label: "Единицы", tone: "ones", expected: ones },
      { key: "total", label: "Какое это число?", tone: "total", expected: task.number },
    ]
    : [{ key: "total", label: "Какое это число?", tone: "total", expected: task.number }];
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [solved, setSolved] = useState(false);
  const [note, setNote] = useState("");
  const [counted, setCounted] = useState([]);
  const [countHint, setCountHint] = useState(false);
  // «Схема» + «Обучение» (not «Больше девяти», where composing the number IS the
  // exchange): once tens and ones are written, the picture fades and the two
  // digits travel from their columns into the number, keeping their place
  // colour — the bridge from the picture to the digits
  // (docs/place-value-methodology.md, раздел 8, кадр 2).
  const bridge = scheme && teaching;
  const [bridging, setBridging] = useState(false);
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
    if (!teaching || waitGroup || solved || counted.length || typed.digits) { setCountHint(false); return undefined; }
    const timer = setTimeout(() => setCountHint(true), COUNT_HINT_MS);
    return () => clearTimeout(timer);
  }, [teaching, waitGroup, solved, counted.length, typed.digits, step]);

  function toggleCounted(key) {
    if (!teaching || solved) return;
    setCounted((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));
  }
  function totalHint(guess) {
    if (!teaching) return "Проверь число ещё раз.";
    if (layout === "over9" && String(guess) === `${tens}${ones}`) return `Единиц не может быть больше девяти. Что можно сложить из десяти ${loose}?`;
    if (tens !== ones && ones <= 9 && guess === ones * 10 + tens) return "Сколько десятков? Десятки пишут первыми.";
    if (tens && ones && ones <= 9 && guess === tens * 100 + ones) {
      const words = numberWords(task.number);
      return `${words[0].toUpperCase()}${words.slice(1)} — это ${tens} ${pluralTens(tens)} и ${ones} ${pluralOnes(ones)}. Сколько цифр нужно?`;
    }
    return `Посчитай десятки и отдельные ${scheme ? "точки" : "монеты"} ещё раз.`;
  }
  function answer(guess) {
    const q = questions[step];
    if (guess === q.expected) {
      setAnswers((a) => ({ ...a, [q.key]: guess }));
      setNote("");
      setCounted([]);
      if (step === questions.length - 1) setSolved(true); else setStep(step + 1);
      if (bridge && q.key === "ones") setBridging(true);
      return true;
    }
    setNote(q.key === "tens" ? "Посчитай десятки."
      : q.key === "ones" ? `Посчитай отдельные ${scheme ? "точки" : "монеты"}.` : totalHint(guess));
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    return false;
  }
  useEffect(() => {
    if (!bridging) return undefined;
    const finish = () => { setAnswers((a) => ({ ...a, total: task.number })); setSolved(true); setBridging(false); };
    const screen = screenRef.current;
    const from = ["tens", "ones"].map((k) => screen?.querySelector(`.fp-field--${k} .fp-value`));
    const to = screen?.querySelector(".fp-field--total .fp-value");
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (still || !to || from.some((el) => !el)) { finish(); return undefined; }
    const target = to.getBoundingClientRect(), size = getComputedStyle(to).fontSize;
    const ghosts = from.map((el, i) => {
      const r = el.getBoundingClientRect();
      const ghost = document.createElement("span");
      ghost.className = `id-fly id-dig--${i ? "ones" : "tens"}`;
      ghost.textContent = el.textContent;
      ghost.style.fontSize = size;
      document.body.append(ghost);
      const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
      const x1 = target.left + target.width * (i ? 0.64 : 0.36), y1 = target.top + target.height / 2;
      const animation = ghost.animate([
        { transform: `translate(${x0}px, ${y0}px) translate(-50%, -50%) scale(.6)` },
        { transform: `translate(${x1}px, ${y1}px) translate(-50%, -50%)` },
      ], { duration: FLY_MS, delay: 300, easing: "ease-in-out", fill: "both" });
      return { ghost, animation };
    });
    ghosts[1].animation.onfinish = () => { ghosts.forEach((g) => g.ghost.remove()); finish(); };
    return () => ghosts.forEach((g) => { g.animation.cancel(); g.ghost.remove(); });
  }, [bridging]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const q = questions[i], ok = answers[q.key] !== undefined, active = !solved && !bridging && !waitGroup && i === step;
    const value = !ok ? (active ? typed.digits : "")
      : bridge && q.key === "total" ? <span className="id-dig-pair"><span className="id-dig--tens">{tens}</span><span className="id-dig--ones">{ones}</span></span>
      : answers[q.key];
    return <AnswerField label={q.label} tone={q.tone} big={big} bare={!big} ok={ok} active={active}
      wrong={typed.wrong} value={value} />;
  };

  // A stack or a coin: in «Обучение» a tap ticks it as counted.
  const item = (key, kind) => {
    const content = kind === "stack" ? <Ten /> : <One />;
    const done = counted.includes(key);
    const cls = `${kind === "stack" ? "px-stack-wrap" : "px-coin"} id-item${done ? " id-item--counted" : ""}`;
    return teaching
      ? <button type="button" key={key} className={cls} aria-label={kind === "stack" ? "Десяток" : scheme ? "Точка" : "Монета"} aria-pressed={done}
        disabled={solved} onClick={() => toggleCounted(key)}>{content}</button>
      : <span key={key} className={cls}>{content}</span>;
  };
  function group(e) {
    if (!waitGroup || grouping) return;
    setGrouping(true);
    const done = () => { setGrouped(true); setGrouping(false); setCounted([]); };
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (still || !e.currentTarget.animate) { done(); return; }
    e.currentTarget.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(0.2)", opacity: 0 }],
      { duration: 450, easing: "ease-in", fill: "forwards" }).onfinish = done;
  }
  const coinBlocks = (count) => Array.from({ length: Math.ceil(count / 10) }, (_, b) => waitGroup && b === 0
    ? <button type="button" key={b} className="px-coin-block id-group" aria-label="Собрать десяток" disabled={grouping} onClick={group}>
      {Array.from({ length: 10 }, (_, j) => <span key={j} className="px-coin id-item">{<One />}</span>)}
    </button>
    : <div key={b} className="px-coin-block">
    {Array.from({ length: Math.min(10, count - b * 10) }, (_, j) => item(`ones:${b * 10 + j}`, "coin"))}
  </div>);
  const heads = <>
    <h3 className="sg-head sg-head--tens">Десятки</h3>
    <h3 className="sg-head sg-head--ones">Единицы</h3>
  </>;

  const status = solved ? (bridge ? <span className="sg-status-say">{placeValuePhrase(task.number)}</span> : null)
    : waitGroup ? <span className="sg-status-hint">{`Здесь больше девяти ${loose}. Десять ${loose} — это десяток. Нажми на них.`}</span>
    : note ? <span className="sg-status-note">{note}</span>
      : countHint ? <span className="sg-status-hint">{`Можно отмечать посчитанное — нажимай на десятки и ${scheme ? "точки" : "монеты"}.`}</span> : null;

  return <div ref={screenRef} className={`pv-screen sg-screen sg-screen--${mode} id-screen`}
    style={{ "--coin-size": `${coinSize}px`, "--sg-stack-cols": stackCols, "--sg-stack-rows": stackRows, "--id-cols": cols, "--id-blocks": blocks, "--sg-answer-w": `${WIDE_ANSWER}px` }}>
    <div className="sg-inner" ref={innerRef}>
      <h2 className="sg-title">{scheme ? "Какое число на схеме?" : "Сколько здесь монет?"}</h2>
      <div className={`sg-board id-board${bridge && (bridging || solved) ? " id-board--faded" : ""}`}>
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
            <div className={`sg-stacks${extra ? " id-stacks--new" : ""}`}>{Array.from({ length: tens }, (_, i) => item(`tens:${i}`, "stack"))}</div>
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
            : <Keypad off={bridging || waitGroup} typed={typed} onEnter={enter} grid={mode !== "phone"} canEnter={!autoField} />}
        </div>
      </div>
    </div>
  </div>;
}
