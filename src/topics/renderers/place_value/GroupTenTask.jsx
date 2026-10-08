import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { useCoinExchange } from "./useCoinExchange.js";
import { numberWords } from "./placeValueLabels.js";
import { AnswerField, Keypad, useTypedAnswer } from "./FieldPad.jsx";
import TenFrame from "./TenFrame.jsx";
import "./place_value.css";
import "./coins.css";
import "./exchange.css";
import "./group_ten.css";

// «Сложи по десять» — the topic's way in. A heap of loose coins and no number:
// the child moves coins into the ten-frame one by one, taps each full frame to
// turn it into a stack, and answers how many tens, how many ones, what number.
// The answer fields switch on by themselves once fewer than ten loose coins
// are left: with a single frame the child can't stop half way, so there is no
// «done» button and no «could you make another stack?» check. The point is to discover that 2 stacks and 3 coins are
// easier to count than 23 coins. All on one screen, zones of fixed size.
// See docs/place-value-methodology.md, режим 1.

const HINT_DELAY_MS = 6000;
const WIDE_ANSWER = 420; // px, the answer column on a landscape tablet (group_ten.css)
const PILE_LIMIT = 15;

function seededRandom(seed) {
  let value = seed % 233280;
  return () => { value = (value * 9301 + 49297) % 233280; return value / 233280; };
}

// Scattered, but never overlapping: each coin gets its own cell of an even
// grid (cells shuffled, so the heap has no visible rows) and a random offset
// inside that cell — a cell is never smaller than a coin, so coins can't touch.
function scatter(ids, cols, rows, seed) {
  const random = seededRandom(seed || 1);
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push([x, y]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const coins = ids.map((id, i) => ({ id, col: cells[i][0], row: cells[i][1], jx: random(), jy: random() }));
  return { cols, rows, coins };
}

// The heap is one grid for the whole task (never re-laid out): 9 columns up
// to 49 (a small number just leaves more empty space), 13 denser columns for
// 50–99.
export function heapLayout(count, seed) {
  const cols = count <= 49 ? 9 : 13;
  const rows = Math.max(5, Math.ceil((count * (count <= 49 ? 1.2 : 1.05)) / cols));
  return scatter(Array.from({ length: count }, (_, i) => `h${i}`), cols, rows, seed);
}

const FIELDS = [
  { key: "tens", label: "Десятков", tone: "tens" },
  { key: "ones", label: "Единиц", tone: "ones" },
  { key: "total", label: "Какое это число?", tone: "total" },
];

export default function GroupTenTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const slots = task.showFrame !== false;
  const layout = useMemo(() => heapLayout(task.number, task.seed), [task.number, task.seed]);
  const [model, setModel] = useState(() => ({ heap: layout.coins.map((c) => c.id), frame: [], tens: [], serial: 0 }));
  const [phase, setPhase] = useState("group");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [note, setNote] = useState("");
  const [hint, setHint] = useState(null);
  const typed = useTypedAnswer();
  const [coinSize, setCoinSize] = useState(32);
  const [mode, setMode] = useState("phone");
  const appliedSize = useRef(32);
  appliedSize.current = coinSize;
  const screenRef = useRef(null);
  const innerRef = useRef(null);
  const boardRef = useRef(null);
  const penalized = useRef(false);
  const exchange = useCoinExchange(boardRef);
  const position = useMemo(() => Object.fromEntries(layout.coins.map((c) => [c.id, c])), [layout]);

  // The stack store mirrors the frame: up to five in a row, a second row for 6–9.
  const maxStacks = Math.max(1, Math.floor(task.number / 10));
  const stackCols = Math.min(5, maxStacks), stackRows = Math.ceil(maxStacks / 5);

  // One coin size per task, from the screen alone. Every element has its place
  // reserved from the start (answer fields, number, keypad are only invisible
  // until needed), so nothing on the screen moves or resizes while the child
  // works. Width gives an upper bound; the height is fitted by trying sizes on
  // the real layout (it is reserved, so the content doesn't affect it).
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
      const byWidth = Math.min((bw - 28) / (layout.cols * 1.12), (bw - 52) / (stackCols * 1.3 + 6.8));
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
  }, [mode, layout.cols, layout.rows, stackCols, stackRows, slots]);

  // «Обучение» only, and only after a pause: how to start, or that a full
  // frame is waiting to be closed. The decisions themselves are never hinted.
  const idleReason = phase !== "group" || !teaching ? null
    : model.frame.length === 0 && model.tens.length === 0 ? "start"
      : slots && model.frame.length === 10 ? "full"
        : null;
  useEffect(() => {
    if (!idleReason) { setHint(null); return undefined; }
    const timer = setTimeout(() => setHint(idleReason), HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [idleReason, model]);

  function change(update, nextNote = "") {
    if (phase !== "group" || exchange.busy) return;
    setModel(update(model));
    setNote(nextNote);
    setHint(null);
  }
  function mistake(message) {
    setNote(message);
    if (!penalized.current) { penalized.current = true; onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.(); }
  }
  function takeCoin(id) {
    const limit = slots ? 10 : PILE_LIMIT;
    if (model.frame.length >= limit) return;
    change((m) => ({ ...m, heap: m.heap.filter((x) => x !== id), frame: [...m.frame, id] }));
  }
  function returnCoin(id) {
    change((m) => ({ ...m, frame: m.frame.filter((x) => x !== id), heap: [...m.heap, id] }));
  }
  function closeFrame() {
    if (phase !== "group" || exchange.busy || !model.frame.length) return;
    if (model.frame.length !== 10) {
      // Only reachable without the frame: the child counted the stack wrong.
      // The pile is the button, so it can't also take coins back: the coins
      // return to the heap and the child counts ten again.
      change((m) => ({ ...m, heap: [...m.heap, ...m.frame], frame: [] }));
      mistake(teaching ? "В стопке должно быть ровно десять монет. Посчитай ещё раз." : "Проверь, сколько монет в стопке.");
      return;
    }
    const stackId = `s${model.serial}`;
    const coinIds = model.frame;
    const apply = (m) => ({ ...m, frame: [], tens: [...m.tens, stackId], serial: m.serial + 1 });
    const started = exchange.start({ direction: "group", stackId, coinIds, commit: () => {
      setModel(apply);
      setNote("");
      setHint(null);
    } });
    if (!started) change(apply);
  }
  const ones = model.heap.length + model.frame.length, tens = model.tens.length;
  const expected = { tens, ones, total: task.number };
  const canAnswer = ones < 10;
  const done = phase === "done";
  function answer(key, guess) {
    if (phase !== "group" || exchange.busy || !canAnswer) return false;
    if (guess === expected[key]) {
      setAnswers((a) => ({ ...a, [key]: guess }));
      setNote("");
      setHint(null);
      if (step === FIELDS.length - 1) setPhase("done"); else setStep(step + 1);
      return true;
    }
    const messages = {
      tens: "Посчитай стопки ещё раз — каждая стопка это десяток.",
      ones: "Единицы — монеты, которые не сложились в стопку. Посчитай их ещё раз.",
      total: teaching
        ? `Стопок ${tens} — это ${numberWords(tens * 10)}. И ещё ${ones} ${ones === 1 ? "монета" : ones >= 2 && ones <= 4 ? "монеты" : "монет"}.`
        : "Проверь число ещё раз.",
    };
    setHint(null);
    setNote(messages[key]);
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    return false;
  }

  function enter() {
    if (!typed.digits) return;
    if (answer(FIELDS[step].key, Number(typed.digits))) typed.reset(); else typed.fail();
  }
  const field = (i, big) => {
    const f = FIELDS[i], ok = answers[f.key] !== undefined, active = !done && canAnswer && i === step;
    return <AnswerField label={f.label} tone={f.tone} big={big} ok={ok} active={active} wrong={typed.wrong}
      value={ok ? answers[f.key] : active ? typed.digits : ""} />;
  };

  const hintText = {
    start: "Нажимай на монеты — они перейдут в рамку.",
    full: "В рамке десять монет — нажми на рамку, и они сложатся в стопку.",
  }[hint];
  const stackList = model.tens.map((id) => <div key={id} data-stack-id={id} className={`px-stack-wrap${exchange.pendingStack === id ? " px-pending" : ""}`}>
    <TenStack />
  </div>);
  const status = done ? null : hintText ? <span className="sg-status-hint">{hintText}</span>
    : note ? <span className="sg-status-note">{note}</span> : null;
  const show = canAnswer ? " sg-show" : "";

  return <div ref={screenRef} className={`pv-screen sg-screen sg-screen--${mode}`}
    style={{ "--coin-size": `${coinSize}px`, "--sg-cols": layout.cols, "--sg-stack-cols": stackCols, "--sg-stack-rows": stackRows, "--sg-answer-w": `${WIDE_ANSWER}px` }}>
    <div className="sg-inner" ref={innerRef}>
      <h2 className="sg-title">Сколько здесь монет?</h2>
      <div className="sg-board" ref={boardRef}>
        <section className="sg-card sg-heap">
          <div className="sg-heapbox" style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)`, gridTemplateRows: `repeat(${layout.rows}, calc(var(--coin-size) * 1.12))` }}>
            {model.heap.map((id) => <span key={id} className="sg-cell" style={{ gridColumn: position[id].col + 1, gridRow: position[id].row + 1 }}>
              <button type="button" className="px-coin sg-heap-coin" aria-label="Монета из россыпи"
                style={{ left: `calc((100% - var(--coin-size)) * ${position[id].jx.toFixed(3)})`, top: `calc((100% - var(--coin-size)) * ${position[id].jy.toFixed(3)})` }}
                disabled={exchange.busy || done} onClick={() => takeCoin(id)}><Coin /></button>
            </span>)}
          </div>
        </section>
        {/* Tens left, ones right — the order of the digits: the stacks, then the
            frame they come out of, each with its answer field under it. */}
        <section className="sg-card sg-bench">
          <div className="sg-stacks">{stackList}</div>
          <div className="sg-frame">
            <TenFrame coinIds={model.frame} onReturn={returnCoin} onClose={closeFrame} slots={slots} tapToClose
              disabled={exchange.busy || done} glow={hint === "full"} />
          </div>
          <div className={`sg-reveal${show}`}>{field(0)}</div>
          <div className={`sg-reveal${show}`}>{field(1)}</div>
        </section>
      </div>
      <div className="sg-answer">
        <div className={`sg-reveal${show}`}>{field(2, true)}</div>
        <div className="sg-status" role="status">{status}</div>
        <div className="sg-slot">
          {done ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
            : <div className={`sg-reveal${show}`}><Keypad off={!canAnswer || exchange.busy} typed={typed} onEnter={enter} /></div>}
        </div>
      </div>
    </div>
  </div>;
}
