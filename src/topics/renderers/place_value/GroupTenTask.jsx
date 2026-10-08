import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Button from "@/shared/components/Button";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { useCoinExchange } from "./useCoinExchange.js";
import { placeValuePhrase, numberWords } from "./placeValueLabels.js";
import NumberAnswer from "./NumberAnswer.jsx";
import TenFrame from "./TenFrame.jsx";
import "./place_value.css";
import "./coins.css";
import "./exchange.css";
import "./group.css";

// «Сложи по десять» — the topic's way in. A heap of loose coins and no number:
// the child moves coins into the ten-frame one by one, closes each full frame
// into a stack themselves, decides when no more stacks can be made, and then
// answers how many stacks, how many loose coins, how many altogether. The point
// is to discover that 2 stacks and 3 coins are easier to count than 23 coins.
// See docs/place-value-methodology.md, режим 1.

const HINT_DELAY_MS = 6000;
const PILE_LIMIT = 15;

function seededRandom(seed) {
  let value = seed % 233280;
  return () => { value = (value * 9301 + 49297) % 233280; return value / 233280; };
}

// Scattered, but never overlapping: each coin gets its own cell of an even
// grid (cells shuffled, so the heap has no visible rows) and a random offset
// inside that cell — a cell is never smaller than a coin, so coins can't touch.
export function heapLayout(count, seed) {
  const cols = count <= 19 ? 6 : 9;
  const rows = Math.max(3, Math.ceil((count * 1.35) / cols));
  const random = seededRandom(seed || 1);
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push([x, y]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const coins = cells.slice(0, count).map(([x, y], i) => ({ id: `h${i}`, col: x, row: y, jx: random(), jy: random() }));
  return { cols, rows, coins };
}

const QUESTIONS = [
  { key: "tens", label: "Сколько стопок?", tone: "tens" },
  { key: "ones", label: "Сколько отдельных монет?", tone: "ones" },
  { key: "total", label: "Сколько всего монет?", tone: "total" },
];

export default function GroupTenTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const teaching = task.supportMode !== "independent";
  const slots = task.showFrame !== false;
  const layout = useMemo(() => heapLayout(task.number, task.seed), [task.number, task.seed]);
  const [model, setModel] = useState(() => ({ heap: layout.coins.map((c) => c.id), frame: [], tens: [], serial: 0 }));
  const [history, setHistory] = useState([]);
  const [phase, setPhase] = useState("group");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [note, setNote] = useState("");
  const [hint, setHint] = useState(null);
  const [coinSize, setCoinSize] = useState(44);
  const [narrow, setNarrow] = useState(false);
  const mainRef = useRef(null);
  const penalized = useRef(false);
  const exchange = useCoinExchange(mainRef);
  const position = useMemo(() => Object.fromEntries(layout.coins.map((c) => [c.id, c])), [layout]);

  // Coin size from the board's own box. While grouping, every heap cell must
  // be clearly wider than a coin (no touching coins); once sorted, only two
  // short zones are left, so the coins may grow.
  const grouping = phase === "group";
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return undefined;
    const measure = () => {
      const { width, height } = main.getBoundingClientRect();
      if (!width || !height) return;
      const isNarrow = width < 600;
      let size;
      if (!grouping) size = isNarrow ? Math.min(((width - 12) / 2 - 24) / 6.3, (height - 52) / 2.4, 40) : Math.min((width - 120) / 13.2, 56);
      else if (isNarrow) size = Math.min((width - 40) / (layout.cols * 1.15), (width - 60) / 6.4, (height - 240) / (layout.rows * 1.15 + 4.7), 44);
      else size = Math.min((width - 110) / (6.6 + layout.cols * 1.15), (height - 70) / (layout.rows * 1.15), (height - 190) / 4.8, 56);
      setNarrow(isNarrow);
      setCoinSize(Math.max(20, size));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    return () => observer.disconnect();
  }, [layout, grouping]);

  // «Обучение» only, and only after a pause: how to start, or that a full
  // frame is waiting to be closed. The decisions themselves are never hinted.
  const idleReason = phase !== "group" || !teaching ? null
    : model.frame.length === 0 && model.tens.length === 0 ? "start"
      : slots && model.frame.length === 10 ? "full"
        : null;
  useEffect(() => {
    if (!idleReason) { setHint((h) => (h === "early" ? h : null)); return undefined; }
    const timer = setTimeout(() => setHint(idleReason), HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [idleReason, history.length]);

  function change(update, nextNote = "") {
    if (phase !== "group" || exchange.busy) return;
    setHistory((h) => [...h, model]);
    setModel(update(model));
    setNote(nextNote);
    setHint(null);
  }
  function undo() {
    if (!history.length || phase !== "group" || exchange.busy) return;
    setModel(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setNote("");
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
      mistake(teaching ? "В стопке должно быть ровно десять монет. Посчитай ещё раз." : "Проверь, сколько монет в стопке.");
      return;
    }
    const stackId = `s${model.serial}`;
    const coinIds = model.frame;
    const snapshot = model;
    const apply = (m) => ({ ...m, frame: [], tens: [...m.tens, stackId], serial: m.serial + 1 });
    const started = exchange.start({ direction: "group", stackId, coinIds, commit: () => {
      setHistory((h) => [...h, snapshot]);
      setModel(apply);
      setNote("");
      setHint(null);
    } });
    if (!started) change(apply);
  }
  function finishGrouping() {
    if (phase !== "group" || exchange.busy) return;
    const loose = model.heap.length + model.frame.length;
    if (loose >= 10) {
      if (teaching) { setHint("early"); setNote(""); }
      else mistake("Посмотри ещё раз: можно сложить ещё одну стопку?");
      return;
    }
    setHistory([]);
    setModel((m) => ({ ...m, heap: [...m.heap, ...m.frame], frame: [] }));
    setNote("");
    setHint(null);
    setPhase("ask");
  }

  const ones = model.heap.length, tens = model.tens.length;
  const expected = { tens, ones, total: task.number };
  function answer(guess) {
    const q = QUESTIONS[step];
    if (guess === expected[q.key]) {
      setAnswers((a) => ({ ...a, [q.key]: guess }));
      setNote("");
      if (step === 2) setPhase("done"); else setStep(step + 1);
      return true;
    }
    const messages = {
      tens: "Посчитай стопки ещё раз.",
      ones: "Посчитай отдельные монеты ещё раз.",
      total: teaching
        ? `Стопок ${tens} — это ${numberWords(tens * 10)}. И ещё ${ones} ${ones === 1 ? "монета" : ones >= 2 && ones <= 4 ? "монеты" : "монет"}.`
        : "Проверь число ещё раз.",
    };
    setNote(messages[q.key]);
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    return false;
  }

  const hintText = {
    start: "Нажимай на монеты — они перейдут в рамку.",
    full: "В рамке десять монет — нажми «Сложить в стопку».",
    early: "Посмотри на россыпь: можно сложить ещё одну стопку?",
  }[hint];
  const stacks = <section className="px-zone px-zone--tens gt-tens">
    <h3><span className="px-chip" />Десятки</h3>
    <div className="px-stacks">
      {model.tens.map((id) => <div key={id} data-stack-id={id} className={`px-stack-wrap${exchange.pendingStack === id ? " px-pending" : ""}`}>
        <TenStack />
      </div>)}
    </div>
  </section>;

  return <div className={`pv-screen px-screen gt-screen${narrow ? " gt-screen--narrow" : ""}`} style={{ "--coin-size": `${coinSize}px` }}>
    <header className="gt-task">
      <b>Сколько здесь монет?</b>
      {grouping && <span>Сложи их стопками по десять — так считать легче</span>}
    </header>
    <div className={`gt-main${grouping ? "" : " gt-main--sorted"}`} ref={mainRef}>
      {grouping ? <>
        <section className={`px-zone gt-heap${hint === "early" ? " px-glow" : ""}`}>
          <h3>Россыпь</h3>
          <div className="gt-heapbox" style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)`, gridTemplateRows: `repeat(${layout.rows}, 1fr)` }}>
            {model.heap.map((id) => <span key={id} className="gt-heap-cell" style={{ gridColumn: position[id].col + 1, gridRow: position[id].row + 1 }}>
              <button type="button" className="px-coin gt-heap-coin" aria-label="Монета из россыпи"
                style={{ left: `calc((100% - var(--coin-size)) * ${position[id].jx.toFixed(3)})`, top: `calc((100% - var(--coin-size)) * ${position[id].jy.toFixed(3)})` }}
                disabled={exchange.busy} onClick={() => takeCoin(id)}><Coin /></button>
            </span>)}
          </div>
        </section>
        <div className="gt-side">
          <section className="px-zone gt-framecard">
            <TenFrame coinIds={model.frame} onReturn={returnCoin} onClose={closeFrame} slots={slots}
              onPileTap={() => model.frame.length && returnCoin(model.frame[model.frame.length - 1])}
              disabled={exchange.busy} glow={hint === "full"} />
          </section>
          {stacks}
        </div>
      </> : <>
        {stacks}
        <section className="px-zone px-zone--ones gt-ones">
          <h3><span className="px-chip" />Единицы <small>— то, что не сложилось в стопку</small></h3>
          <div className="px-coin-block">{model.heap.map((id) => <span key={id} className="px-coin px-coin--static"><Coin /></span>)}</div>
        </section>
      </>}
    </div>
    <div className="px-bottom">
      {grouping && <>
        {hintText && <div className="px-hint" role="status"><small>Подсказка</small>{hintText}</div>}
        {note && <div className="px-note" role="status">{note}</div>}
        {teaching && <button type="button" className="px-undo" disabled={!history.length || exchange.busy} onClick={undo}>↶ Отменить</button>}
        <button type="button" className="px-undo gt-finish" disabled={exchange.busy} onClick={finishGrouping}>Больше не сложить</button>
      </>}
      {phase === "ask" && <div className="gt-ask">
        <div className="gt-questions">
          {QUESTIONS.map((q, i) => <div key={q.key} className={`gt-q gt-q--${q.tone}${i === step ? " gt-q--active" : ""}${answers[q.key] !== undefined ? " gt-q--ok" : ""}`}>
            <span>{q.label}</span><span className="gt-q-value">{answers[q.key] ?? (i === step ? "?" : "")}</span>
          </div>)}
        </div>
        <NumberAnswer key={step} onSubmit={answer} />
        {note && <div className="px-note" role="status">{note}</div>}
      </div>}
      {phase === "done" && <div className="px-done" role="status">
        <span className="gt-number">{task.number}</span>
        <div className="px-say">{placeValuePhrase(task.number)}</div>
        <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
      </div>}
    </div>
  </div>;
}
