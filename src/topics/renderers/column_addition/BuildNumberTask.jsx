import { useRef, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import Button from "@/shared/components/Button";
import { CoinAnswer, CoinBoard, CoinDragOverlay, CoinLesson, CoinSource } from "./CoinLesson.jsx";
import { useCoinExchange } from "./useCoinExchange.js";
import { placeValueSentence } from "./placeValueLabels.js";

export default function BuildNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const [phase, setPhase] = useState("build");
  const [placed, setPlaced] = useState({ tens: [], ones: [] });
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [focus, setFocus] = useState(null);
  const serial = useRef(0), boardRef = useRef(null);
  const exchange = useCoinExchange(boardRef);
  const ready = task.buildApproach === "ready", teaching = task.supportMode !== "independent";
  const editable = phase === "build" && !exchange.busy;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));
  const nextId = () => "build-" + serial.current++;
  function clearFeedback() { setFeedback(""); setFocus(null); setSelected(null); }
  function add(kind) {
    if (!editable || (kind === "ten" && !ready)) return;
    const side = kind === "ten" ? "tens" : "ones";
    if (placed[side].length >= (side === "tens" ? 11 : 19)) {
      setFeedback(side === "ones" ? "Собери десяток или убери лишние монеты" : "Убери лишние десятки");
      return;
    }
    clearFeedback();
    const id = nextId();
    setPlaced((p) => ({ ...p, [side]: [...p[side], id] }));
  }
  function group() {
    if (!editable || placed.ones.length < 10) return;
    if (placed.tens.length >= 11) { setFeedback("Убери лишние десятки"); return; }
    const coinIds = placed.ones.slice(0, 10), stackId = nextId();
    exchange.start({ direction: "group", stackId, coinIds, commit: () => {
      clearFeedback();
      setPlaced((p) => ({ tens: [...p.tens, stackId], ones: p.ones.slice(10) }));
    } });
  }
  function ungroup() {
    if (!editable || !selected?.startsWith("tens:") || placed.ones.length > 9) return;
    const stackId = selected.slice(5), coinIds = Array.from({ length: 10 }, nextId);
    exchange.start({ direction: "ungroup", stackId, coinIds, commit: () => {
      clearFeedback();
      setPlaced((p) => ({ tens: p.tens.filter((id) => id !== stackId), ones: [...p.ones, ...coinIds] }));
    } });
  }
  function remove() {
    if (!editable || !selected) return;
    const side = selected.startsWith("tens:") ? "tens" : "ones", id = selected.slice(5);
    setPlaced((p) => ({ ...p, [side]: p[side].filter((item) => item !== id) }));
    clearFeedback();
  }
  function mistake(message, side) {
    setFeedback(teaching ? message : "Проверь число ещё раз"); setFocus(teaching ? side : null);
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    return false;
  }
  function check() {
    if (!editable) return;
    if (placed.ones.length >= 10) { setFeedback("Собери десяток из десяти монет"); setFocus("ones"); return; }
    if (placed.tens.length !== task.target.tens) { mistake("Проверь десятки. Посчитай стопки", "tens"); return; }
    if (placed.ones.length !== task.target.ones) { mistake("Проверь единицы. Посчитай отдельные монеты", "ones"); return; }
    clearFeedback(); setPhase(task.askComposition ? "answerTens" : "done");
  }
  function answer(guess) {
    const side = phase === "answerTens" ? "tens" : "ones";
    if (guess !== task.target[side]) return mistake(side === "tens" ? "Посчитай стопки десятков" : "Посчитай отдельные монеты", side);
    clearFeedback(); setPhase(side === "tens" ? "answerOnes" : "done"); return true;
  }
  const title = phase === "done" ? "Правильно!" : phase === "answerTens" ? "Сколько десятков?" : phase === "answerOnes" ? "Сколько единиц?" : "Собери число";
  return <DndContext sensors={sensors} onDragEnd={({ active, over }) => {
    if (over?.id === "cm-ones" || over?.id === "cm-tens") add(active.data.current?.kind);
  }}>
    <CoinLesson className="cm-build" title={title} target={phase === "build" || phase === "done" ? task.number : undefined} solved={phase === "done"}
      feedback={feedback || (phase === "done" ? placeValueSentence(task.target.tens, task.target.ones, task.number) : "")}
      controls={phase.startsWith("answer") ? <CoinAnswer key={phase} maxDigits={1} onSubmit={answer} /> : phase === "done"
        ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
        : <div className="cm-build-controls"><div className="cm-supply"><div className="cm-sources">{ready && <CoinSource kind="ten" disabled={!editable} onAdd={add} />}<CoinSource kind="coin" disabled={!editable} onAdd={add} /></div>
          <Button variant="secondary" disabled={!editable || (!placed.tens.length && !placed.ones.length)} onClick={() => { setPlaced({ tens: [], ones: [] }); clearFeedback(); }}>Сначала</Button></div>
          <Button disabled={!editable} onClick={check}>Проверить</Button></div>}>
      <CoinBoard tens={placed.tens} ones={placed.ones} boardRef={boardRef} selected={selected}
        onSelect={phase === "build" ? (key) => setSelected(key === selected ? null : key) : undefined}
        disabled={!editable} dropZones pendingStack={exchange.pendingStack} pendingCoins={exchange.pendingCoins}
        groupable={editable && placed.ones.length >= 10} onGroup={group} focus={focus || (phase === "answerTens" ? "tens" : phase === "answerOnes" ? "ones" : null)} />
      {phase === "build" && selected && <div className="cm-tools">
        {selected && <Button variant="secondary" disabled={!editable} onClick={remove}>Убрать</Button>}
        {selected?.startsWith("tens:") && <Button variant="secondary" aria-label="Разложить десяток" disabled={!editable || placed.ones.length > 9} onClick={ungroup}>Разложить</Button>}
      </div>}
    </CoinLesson>
    <CoinDragOverlay />
  </DndContext>;
}
