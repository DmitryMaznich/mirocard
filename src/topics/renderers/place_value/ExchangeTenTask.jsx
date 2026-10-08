import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import Button from "@/shared/components/Button";
import { Coin, TenStack } from "./CoinBlocks.jsx";
import { CoinDragOverlay } from "./CoinDragOverlay.jsx";
import { useCoinExchange } from "./useCoinExchange.js";
import NumberAnswer from "./NumberAnswer.jsx";
import TenFrame from "./TenFrame.jsx";
import { placeValuePhrase } from "./placeValueLabels.js";
import "./place_value.css";
import "./coins.css";
import "./exchange.css";

// «Обмен десятка». The task gives a reason to exchange: «Отдай k» when there
// may not be enough loose coins (break a stack of ten — the column's заём),
// «Получи k» when loose coins may reach ten (build a new stack — перенос).
// The app never exchanges on its own and never hints before the child is
// stuck; about half of the tasks need no exchange at all (generateExchangeTask).
// Same coins and stacks as the rest of the topic — the topic later leads on to
// money — and the same ten-frame as «Сложи по десять» for building a ten.
// See docs/place-value-methodology.md, режим 4.

const HINT_DELAY_MS = 4000;

function initialModel(task) {
  return {
    tens: Array.from({ length: task.start.tens }, (_, i) => `t${i}`),
    ones: Array.from({ length: task.start.ones }, (_, i) => `o${i}`),
    tray: task.op === "get" ? Array.from({ length: task.k }, (_, i) => `g${i}`) : [],
    moved: 0,          // give: coins already given; get: coins already taken from the tray
    frame: [],         // loose coins put into the ten-frame («Собери десяток»)
    broke: false,      // a ten was broken at least once (column: crossed tens digit)
    grouped: false,    // a ten was built at least once (column: carried 1)
    serial: 0,
  };
}

function Stack({ id, index, onBreak, disabled, glow, coinSize }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `stack-${id}`, disabled, data: { kind: "ten", stackId: id, coinSize } });
  return <button type="button" ref={setNodeRef} className={`px-stack${glow ? " px-glow" : ""}`} aria-label={`Десяток ${index + 1}`}
    style={{ opacity: isDragging ? 0.35 : undefined }} disabled={disabled}
    {...attributes} {...listeners} onClick={() => { if (!isDragging) onBreak(id); }}>
    <TenStack />
  </button>;
}

function OnesZone({ children, onEmptyTap }) {
  const { setNodeRef, isOver } = useDroppable({ id: "px-ones" });
  return <section ref={setNodeRef} className={`px-zone px-zone--ones${isOver ? " px-zone--drag-over" : ""}`}
    onClick={(event) => { if (event.target === event.currentTarget || event.target.classList.contains("px-coins")) onEmptyTap?.(); }}>
    <h3><span className="px-chip" />Единицы</h3>
    <div className="px-coins">{children}</div>
  </section>;
}

function Column({ task, model, solved }) {
  const { tens, ones } = task.start;
  const give = task.op === "give";
  const resultTens = Math.floor(task.result / 10), resultOnes = task.result % 10;
  return <div className="px-col">
    <h3>Так это пишут в столбике</h3>
    <div className="px-nb">
      <span className="px-nb-aux" style={{ gridColumn: 2, gridRow: 1 }}>{!give && model.grouped ? "1" : ""}</span>
      <span className={`px-nb-d${give && model.broke ? " px-nb-d--gone" : ""}`} style={{ gridColumn: 2, gridRow: 2 }}>
        {tens}{give && model.broke && <span className="px-nb-corner">{tens - 1}</span>}
      </span>
      <span className="px-nb-d" style={{ gridColumn: 3, gridRow: 2 }}>
        {ones}{give && model.broke && <span className="px-nb-corner">1</span>}
      </span>
      <span className={`px-nb-d px-nb-sign px-nb-sign--${task.op}`} style={{ gridColumn: 1, gridRow: 3 }}>{give ? "−" : "+"}</span>
      <span className="px-nb-d" style={{ gridColumn: 3, gridRow: 3 }}>{task.k}</span>
      <span className="px-nb-line" style={{ gridColumn: "1 / 4", gridRow: 4 }} />
      <span className="px-nb-d" style={{ gridColumn: 2, gridRow: 5 }}>{solved && resultTens ? resultTens : ""}</span>
      <span className="px-nb-d" style={{ gridColumn: 3, gridRow: 5 }}>{solved ? resultOnes : ""}</span>
    </div>
  </div>;
}

export default function ExchangeTenTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const give = task.op === "give";
  const teaching = task.supportMode !== "independent";
  const [model, setModel] = useState(() => initialModel(task));
  const [history, setHistory] = useState([]);
  const [phase, setPhase] = useState("act");
  const [note, setNote] = useState("");
  const [hintLevel, setHintLevel] = useState(0);
  const [coinSize, setCoinSize] = useState(40);
  const [stacked, setStacked] = useState(false);
  const boardRef = useRef(null);
  const penalized = useRef(false);
  const exchange = useCoinExchange(boardRef);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));

  const actionDone = model.moved === task.k;
  const ready = actionDone && model.ones.length <= 9 && model.frame.length === 0 && !exchange.busy;
  const stuck = phase !== "act" ? null
    : give && !actionDone && model.ones.length === 0 ? "noOnes"
      : actionDone && model.ones.length + model.frame.length >= 10 && model.frame.length < 10 ? "tooMany"
        : null;

  useEffect(() => { if (phase === "act" && ready) setPhase("answer"); }, [phase, ready]);

  // Hints only in «Обучение» and only once the child is actually stuck:
  // first a question, then the place to look at glows. Any action restarts it.
  useEffect(() => {
    setHintLevel(0);
    if (!teaching || !stuck) return undefined;
    const first = setTimeout(() => setHintLevel(1), HINT_DELAY_MS);
    const second = setTimeout(() => setHintLevel(2), HINT_DELAY_MS * 2);
    return () => { clearTimeout(first); clearTimeout(second); };
  }, [stuck, teaching, history.length]);

  // Coin size from the board's own box. Wide: tens and ones side by side;
  // narrow (phones): one above the other, which leaves the coins larger.
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return undefined;
    const measure = () => {
      const { width, height } = board.getBoundingClientRect();
      if (!width || !height) return;
      const narrow = width < 560;
      const size = narrow
        ? Math.min((width - 48) / 6.4, (height - 200) / 12)
        : Math.min((width - 84) / 13, (height - 160) / 7);
      setStacked(narrow);
      setCoinSize(Math.max(20, Math.min(56, size)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  function change(update, nextNote = "") {
    if (phase !== "act" || exchange.busy) return;
    const next = update(model);
    setHistory((h) => [...h, model]);
    setModel(next);
    setNote(nextNote);
  }
  function undo() {
    if (!history.length || phase !== "act" || exchange.busy) return;
    setModel(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setNote("");
  }
  function tapCoin(id) {
    if (give && !actionDone) {
      change((m) => ({ ...m, ones: m.ones.filter((x) => x !== id), moved: m.moved + 1 }));
      return;
    }
    if (model.frame.length < 10 && model.tens.length < 9) change((m) => ({ ...m, ones: m.ones.filter((x) => x !== id), frame: [...m.frame, id] }));
  }
  function takeFromTray() {
    if (give || !model.tray.length) return;
    change((m) => ({ ...m, ones: [...m.ones, m.tray[0]], tray: m.tray.slice(1), moved: m.moved + 1 }));
  }
  function returnFromFrame(id) {
    change((m) => ({ ...m, frame: m.frame.filter((x) => x !== id), ones: [...m.ones, id] }));
  }
  function closeFrame() {
    if (model.frame.length !== 10 || phase !== "act" || exchange.busy) return;
    const stackId = `n${model.serial}`;
    const coinIds = model.frame;
    const snapshot = model;
    const apply = (m) => ({ ...m, tens: [...m.tens, stackId], frame: [], grouped: true, serial: m.serial + 1 });
    // Ten coins fly from the frame into the new stack (same flight as the
    // other coin lessons); the stack stays hidden until they land.
    const started = exchange.start({ direction: "group", stackId, coinIds, commit: () => {
      setHistory((h) => [...h, snapshot]);
      setModel(apply);
      setNote("");
    } });
    if (!started) change(apply);
  }
  function breakStack(stackId) {
    if (phase !== "act" || exchange.busy || !model.tens.includes(stackId)) return;
    const needed = give && !actionDone && model.ones.length < task.k - model.moved;
    let nextNote = "";
    if (!needed && teaching) {
      nextNote = give
        ? "Можно было отдать без размена — отдельных монет хватало."
        : "Здесь размен не нужен: монеты только прибавляются.";
    } else if (!needed && !penalized.current) {
      penalized.current = true;
      onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    }
    const coinIds = Array.from({ length: 10 }, (_, i) => `b${model.serial}-${i}`);
    const snapshot = model;
    const apply = (m) => ({ ...m, tens: m.tens.filter((x) => x !== stackId), ones: [...m.ones, ...coinIds], broke: true, serial: m.serial + 1 });
    // The same ten-coins flight as the other coin lessons; the new coins stay
    // hidden (px-pending) until their flying copies land on them.
    const started = exchange.start({ direction: "ungroup", stackId, coinIds, commit: () => {
      setHistory((h) => [...h, snapshot]);
      setModel(apply);
      setNote(nextNote);
    } });
    if (!started) change(apply, nextNote);
  }
  function answer(guess) {
    if (guess === task.result) { setPhase("done"); setNote(""); return true; }
    setNote(teaching ? "Посчитай стопки и отдельные монеты ещё раз." : "Проверь число ещё раз.");
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    return false;
  }

  const glowStacks = hintLevel >= 2 && stuck === "noOnes";
  const glowFrame = hintLevel >= 2 && stuck === "tooMany";
  const hintText = stuck === "noOnes"
    ? (hintLevel >= 2 ? "Стопка — это 10 монет. Её можно разложить." : "Отдельных монет больше нет. Где ещё есть монеты?")
    : (hintLevel >= 2 ? "Сложи десять монет в рамку — получится стопка." : "Отдельных монет больше девяти. Что можно из них сложить?");
  const showFrame = phase === "act" && (model.tens.length < 9 || model.frame.length > 0);
  const sign = give ? "−" : "+";
  const blocks = Math.ceil(model.ones.length / 10);

  return <DndContext sensors={sensors} onDragEnd={({ active, over }) => {
    if (over?.id === "px-ones" && active.data.current?.kind === "ten") breakStack(active.data.current.stackId);
  }}>
    <div className={`pv-screen px-screen${stacked ? " px-screen--stacked" : ""}`} style={{ "--coin-size": `${coinSize}px` }}>
      <header className="px-task">
        <span>Было</span><span className="px-num">{task.number}</span>
        <span className={`px-verb px-verb--${task.op}`}>{give ? "Отдай" : "Получи"} {task.k}</span>
      </header>
      <div className="px-main">
        <div className="px-board" ref={boardRef}>
          <section className="px-zone px-zone--tens">
            <h3><span className="px-chip" />Десятки</h3>
            <div className="px-stacks">
              {model.tens.map((id, i) => <div key={id} data-stack-id={id}
                className={`px-stack-wrap${exchange.pendingStack === id ? " px-pending" : ""}`}>
                <Stack id={id} index={i} onBreak={breakStack} disabled={phase !== "act" || exchange.busy} glow={glowStacks} coinSize={coinSize} />
              </div>)}
            </div>
            {showFrame && <TenFrame coinIds={model.frame} pendingIds={exchange.pendingCoins} onReturn={returnFromFrame} onClose={closeFrame}
              disabled={phase !== "act" || exchange.busy} glow={glowFrame} />}
          </section>
          <OnesZone onEmptyTap={() => { if (teaching && stuck === "noOnes") setHintLevel((l) => Math.max(l, 1)); }}>
            {/* Blocks of ten (two rows of five), so 13 reads as 10 + 3 at a glance. */}
            {Array.from({ length: blocks }, (_, block) => <div key={block} className="px-coin-block">
              {model.ones.slice(block * 10, block * 10 + 10).map((id, j) => <button type="button" key={id} data-coin-id={id}
                className={`px-coin${exchange.pendingCoins.includes(id) ? " px-pending" : ""}`} aria-label={`Монета ${block * 10 + j + 1}`}
                disabled={phase !== "act" || exchange.busy} onClick={() => tapCoin(id)}><Coin /></button>)}
            </div>)}
          </OnesZone>
        </div>
        <aside className="px-side">
          <div className={`px-tray px-tray--${task.op}`}>
            <h3>{give ? "Отдать" : "Получи"} {task.k}</h3>
            <div className="px-slots">
              {Array.from({ length: task.k }, (_, i) => {
                const filled = give ? i < model.moved : i < model.tray.length;
                if (!filled) return <span key={i} className="px-slot" />;
                return give
                  ? <span key={i} className="px-coin px-coin--static" aria-label={`Отдана монета ${i + 1}`}><Coin /></span>
                  : <button type="button" key={i} className="px-coin" aria-label={`Взять монету ${i + 1}`}
                    disabled={phase !== "act" || exchange.busy} onClick={takeFromTray}><Coin /></button>;
              })}
            </div>
            <p className="px-count">{give ? "отдано" : "получено"} {model.moved} из {task.k}</p>
          </div>
          {task.showColumn && <Column task={task} model={model} solved={phase === "done"} />}
        </aside>
      </div>
      <div className="px-bottom">
        {phase === "act" && <>
          {teaching && stuck && hintLevel >= 1 && <div className="px-hint" role="status"><small>Подсказка</small>{hintText}</div>}
          {note && <div className="px-note" role="status">{note}</div>}
          {teaching && <button type="button" className="px-undo" disabled={!history.length || exchange.busy} onClick={undo}>↶ Отменить</button>}
        </>}
        {phase === "answer" && <div className="px-answer">
          <span className="px-answer-q">Сколько стало?</span>
          <NumberAnswer onSubmit={answer} />
          {note && <div className="px-note" role="status">{note}</div>}
        </div>}
        {phase === "done" && <div className="px-done" role="status">
          <div className="px-eq">{task.number} <span className={`px-eq-sign px-eq-sign--${task.op}`}>{sign}</span> {task.k} = {task.result}</div>
          <div className="px-say">{placeValuePhrase(task.result)}</div>
          <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
        </div>}
      </div>
    </div>
    <CoinDragOverlay />
  </DndContext>;
}
