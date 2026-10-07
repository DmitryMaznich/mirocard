import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import Button from "@/shared/components/Button";
import { placeValuePhrase } from "./placeValueLabels.js";
import "./place_value.css";
import "./exchange.css";

// «Обмен десятка». The task gives a reason to exchange: «Отдай k» when there
// may not be enough loose cubes (break a ten — the column's заём), «Получи k»
// when loose cubes may reach ten (build a ten — the column's перенос). The
// app never exchanges on its own and never hints before the child is stuck;
// about half of the tasks need no exchange at all (see generateExchangeTask).
// See docs/place-value-methodology.md, режим 4.

const HINT_DELAY_MS = 4000;

function initialModel(task) {
  return {
    tens: task.start.tens,
    ones: task.start.ones,
    moved: 0,          // give: cubes already given; get: cubes already taken from the tray
    mould: 0,          // loose cubes put into the empty-ten form
    broke: false,      // a ten was broken at least once (column: crossed tens digit)
    grouped: false,    // a ten was built at least once (column: carried 1)
    fresh: null,       // { kind: "break" | "group", at } — drives the enter animation only
  };
}

function Rod({ index, onBreak, disabled, glow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `rod-${index}`, disabled, data: { kind: "rod" } });
  return <button type="button" ref={setNodeRef} className={`px-rod${glow ? " px-glow" : ""}`} aria-label={`Десяток ${index + 1}`}
    style={{ opacity: isDragging ? 0.35 : undefined }} disabled={disabled}
    {...attributes} {...listeners} onClick={() => { if (!isDragging) onBreak(); }}>
    {Array.from({ length: 10 }, (_, i) => <i key={i} />)}
  </button>;
}

function OnesZone({ children, onEmptyTap, highlight }) {
  const { setNodeRef, isOver } = useDroppable({ id: "px-ones" });
  return <section ref={setNodeRef} className={`px-zone px-zone--ones${isOver ? " px-zone--drag-over" : ""}${highlight ? " px-zone--glow" : ""}`}
    onClick={(event) => { if (event.target === event.currentTarget || event.target.classList.contains("px-cubes")) onEmptyTap?.(); }}>
    <h3><span className="px-chip" />Единицы</h3>
    <div className="px-cubes">{children}</div>
  </section>;
}

// Compact answer row: the number frame, then two rows of five digit keys —
// the cubes above must stay readable while the child counts them.
function NumberAnswer({ onSubmit }) {
  const [digits, setDigits] = useState("");
  const [wrong, setWrong] = useState(false);
  return <div className="px-numanswer">
    <output aria-label="Ответ" className={`px-frame${wrong ? " px-frame--wrong" : ""}`}>{digits || "?"}</output>
    <div className="px-keys">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => <button type="button" key={d} className="px-key"
        onClick={() => { if (digits.length < 2) { setDigits((v) => v + d); setWrong(false); } }}>{d}</button>)}
    </div>
    <div className="px-answer-actions">
      <button type="button" className="px-key px-key--erase" aria-label="Стереть цифру" disabled={!digits.length}
        onClick={() => { setDigits((v) => v.slice(0, -1)); setWrong(false); }}>⌫</button>
      <Button disabled={!digits.length} onClick={() => setWrong(!onSubmit(Number(digits)))}>Проверить</Button>
    </div>
  </div>;
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
  const [unit, setUnit] = useState(36);
  const boardRef = useRef(null);
  const penalized = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));

  const actionDone = model.moved === task.k;
  const ready = actionDone && model.ones <= 9 && model.mould === 0;
  const stuck = phase !== "act" ? null
    : give && !actionDone && model.ones === 0 ? "noOnes"
      : actionDone && model.ones + model.mould >= 10 && model.mould < 10 ? "tooMany"
        : null;

  useEffect(() => { if (phase === "act" && ready) setPhase("answer"); }, [phase, ready]);

  // Hints only in «Обучение» and only once the child is actually stuck:
  // first a question, then the place to look at glows.
  useEffect(() => {
    setHintLevel(0);
    if (!teaching || !stuck) return undefined;
    const first = setTimeout(() => setHintLevel(1), HINT_DELAY_MS);
    const second = setTimeout(() => setHintLevel(2), HINT_DELAY_MS * 2);
    return () => { clearTimeout(first); clearTimeout(second); };
  }, [stuck, teaching, history.length]);

  const maxRodSlots = Math.min(9, task.start.tens + 1) + (task.start.tens < 9 ? 1 : 0);
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return undefined;
    const measure = () => {
      const { width, height } = board.getBoundingClientRect();
      if (!width || !height) return;
      const byHeight = (height - 64) / 10.6;
      const byWidth = (width - 64) / (maxRodSlots * 1.32 + 5 * 1.26 + 1.6);
      setUnit(Math.max(16, Math.min(46, byHeight, byWidth)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, [maxRodSlots]);

  function change(update, nextNote = "") {
    if (phase !== "act") return;
    const next = update(model);
    setHistory((h) => [...h, model]);
    setModel({ ...next, fresh: next.fresh ?? null });
    setNote(nextNote);
  }
  function undo() {
    if (!history.length || phase !== "act") return;
    setModel(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setNote("");
  }
  function tapCube() {
    if (give && !actionDone) {
      if (model.ones > 0) change((m) => ({ ...m, ones: m.ones - 1, moved: m.moved + 1 }));
      return;
    }
    if (model.ones > 0 && model.mould < 10 && model.tens < 9) change((m) => ({ ...m, ones: m.ones - 1, mould: m.mould + 1 }));
  }
  function takeFromTray() {
    if (!give && !actionDone) change((m) => ({ ...m, ones: m.ones + 1, moved: m.moved + 1 }));
  }
  function tapMould() {
    if (model.mould === 10) change((m) => ({ ...m, tens: m.tens + 1, mould: 0, grouped: true, fresh: { kind: "group", at: m.tens } }));
    else if (model.mould > 0) change((m) => ({ ...m, ones: m.ones + 1, mould: m.mould - 1 }));
  }
  function breakRod() {
    if (phase !== "act" || model.tens === 0) return;
    const needed = give && !actionDone && model.ones < task.k - model.moved;
    let nextNote = "";
    if (!needed && teaching) {
      nextNote = give
        ? "Можно было отдать без размена — отдельных кубиков хватало."
        : "Здесь размен не нужен: кубики только прибавляются.";
    } else if (!needed && !penalized.current) {
      penalized.current = true;
      onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    }
    change((m) => ({ ...m, tens: m.tens - 1, ones: m.ones + 10, broke: true, fresh: { kind: "break", at: m.ones } }), nextNote);
  }
  function answer(guess) {
    if (guess === task.result) { setPhase("done"); setNote(""); return true; }
    setNote(teaching ? "Посчитай бруски и отдельные кубики ещё раз." : "Проверь число ещё раз.");
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    return false;
  }

  const glowRods = hintLevel >= 2 && stuck === "noOnes";
  const glowMould = hintLevel >= 2 && stuck === "tooMany";
  const hintText = stuck === "noOnes"
    ? (hintLevel >= 2 ? "Брусок — это 10 кубиков. Его можно разобрать." : "Отдельных кубиков больше нет. Где ещё есть кубики?")
    : "Отдельных кубиков больше девяти. Что можно из них сложить?";
  const showMould = model.tens < 9 || model.mould > 0;
  const sign = give ? "−" : "+";

  return <DndContext sensors={sensors} onDragEnd={({ active, over }) => { if (over?.id === "px-ones" && active.data.current?.kind === "rod") breakRod(); }}>
    <div className="pv-screen px-screen" style={{ "--u": `${unit}px` }}>
      <header className="px-task">
        <span>Было</span><span className="px-num">{task.number}</span>
        <span className={`px-verb px-verb--${task.op}`}>{give ? "Отдай" : "Получи"} {task.k}</span>
      </header>
      <div className="px-main">
        <div className="px-board" ref={boardRef}>
          <section className="px-zone px-zone--tens">
            <h3><span className="px-chip" />Десятки</h3>
            <div className="px-rods">
              {Array.from({ length: model.tens }, (_, i) => <div key={i} className={model.fresh?.kind === "group" && model.fresh.at === i ? "px-rod-wrap px-new" : "px-rod-wrap"}>
                <Rod index={i} onBreak={breakRod} disabled={phase !== "act"} glow={glowRods} />
              </div>)}
              {showMould && phase === "act" && <button type="button" className={`px-mould${model.mould === 10 ? " px-mould--full" : ""}${glowMould ? " px-glow" : ""}`}
                aria-label={model.mould === 10 ? "Сложить брусок" : "Форма для десятка"} onClick={tapMould}>
                {Array.from({ length: 10 }, (_, i) => <i key={i} className={i >= 10 - model.mould ? "px-filled" : ""} />)}
              </button>}
            </div>
            {model.mould === 10 && phase === "act" && <p className="px-mould-caption">Нажми — получится брусок</p>}
          </section>
          <OnesZone highlight={false} onEmptyTap={() => { if (teaching && stuck === "noOnes") setHintLevel((l) => Math.max(l, 1)); }}>
            {/* Blocks of ten (two rows of five), so 13 reads as 10 + 3 at a glance. */}
            {Array.from({ length: Math.ceil(model.ones / 10) }, (_, block) => <div key={block} className="px-cube-block">
              {Array.from({ length: Math.min(10, model.ones - block * 10) }, (_, j) => {
                const i = block * 10 + j;
                const fresh = model.fresh?.kind === "break" && i >= model.fresh.at && i < model.fresh.at + 10;
                return <button type="button" key={i} className={`px-cube${fresh ? " px-new" : ""}`} aria-label={`Кубик ${i + 1}`}
                  style={fresh ? { animationDelay: `${(i - model.fresh.at) * 35}ms` } : undefined}
                  disabled={phase !== "act"} onClick={tapCube} />;
              })}
            </div>)}
          </OnesZone>
        </div>
        <aside className="px-side">
          <div className={`px-tray px-tray--${task.op}`}>
            <h3>{give ? "Отдать" : "Получи"} {task.k}</h3>
            <div className="px-slots">
              {Array.from({ length: task.k }, (_, i) => {
                const filled = give ? i < model.moved : i >= model.moved;
                return filled
                  ? <button type="button" key={i} className="px-cube" aria-label={give ? `Отдан кубик ${i + 1}` : `Взять кубик ${i + 1}`}
                    disabled={give || phase !== "act"} onClick={takeFromTray} />
                  : <span key={i} className="px-slot" />;
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
          {teaching && <button type="button" className="px-undo" disabled={!history.length} onClick={undo}>↶ Отменить</button>}
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
  </DndContext>;
}
