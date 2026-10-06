import { useRef, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import Button from "@/shared/components/Button";
import { CoinAnswer, CoinBoard, CoinLesson } from "./CoinLesson.jsx";
import { useCoinExchange } from "./useCoinExchange.js";
import { pluralTens, pluralOnes } from "./placeValueLabels.js";

export default function RegroupTenTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const initialTens = Array.from({ length: task.initial.tens }, (_, i) => "exchange-ten-" + i);
  const initialOnes = Array.from({ length: task.initial.ones }, (_, i) => "exchange-one-" + i);
  const newOnes = Array.from({ length: 10 }, (_, i) => "exchanged-one-" + i);
  const [placed, setPlaced] = useState({ tens: initialTens, ones: initialOnes });
  const [phase, setPhase] = useState("exchange");
  const [selected, setSelected] = useState(null);
  const [exchangedStack, setExchangedStack] = useState(null);
  const [feedback, setFeedback] = useState("");
  const boardRef = useRef(null), exchange = useCoinExchange(boardRef);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }));
  const teaching = task.supportMode !== "independent";
  function ungroup(stackId) {
    if (phase !== "exchange" || exchange.busy || !placed.tens.includes(stackId)) return;
    exchange.start({ direction: "ungroup", stackId, coinIds: newOnes, commit: () => {
      setPlaced((p) => ({ tens: p.tens.filter((id) => id !== stackId), ones: [...p.ones, ...newOnes] }));
      setExchangedStack(stackId); setSelected(null); setFeedback(""); setPhase("answer");
    } });
  }
  function groupBack() {
    if (exchange.busy || !exchangedStack) return;
    exchange.start({ direction: "group", stackId: exchangedStack, coinIds: newOnes, commit: () => {
      setPlaced({ tens: initialTens, ones: initialOnes }); setFeedback(""); setPhase("exchange"); setExchangedStack(null);
    } });
  }
  function check(guess) {
    if (exchange.busy) return false;
    if (guess === task.after.ones) { setPhase("done"); setFeedback(""); return true; }
    setFeedback(teaching ? "Посчитай все отдельные монеты после размена" : "Проверь число единиц ещё раз");
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.(); return false;
  }
  return <DndContext sensors={sensors} onDragEnd={({ active, over }) => {
    if (over?.id === "cm-ones" && active.data.current?.kind === "ten") ungroup(String(active.id).slice(6));
  }}>
    <CoinLesson title={phase === "exchange" ? "Разложи один десяток" : phase === "done" ? "Количество сохранилось" : "Сколько теперь единиц?"}
      solved={phase === "done"} className="cm-regroup" feedback={feedback}
      controls={phase === "answer" ? <CoinAnswer disabled={exchange.busy} onSubmit={check} label="Число единиц" />
        : phase === "done" ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button>
          : <Button disabled={!selected || exchange.busy} onClick={() => ungroup(selected)}>Разложить десяток</Button>}>
      <div className="cm-total">Число <strong>{task.number}</strong></div>
      <CoinBoard boardRef={boardRef} tens={placed.tens} ones={placed.ones} wideOnes dropZones dragStacks={phase === "exchange"}
        disabled={exchange.busy} selected={selected ? "tens:" + selected : null} onStackClick={(id) => setSelected(id === selected ? null : id)}
        pendingStack={exchange.pendingStack} pendingCoins={exchange.pendingCoins} />
      {phase === "exchange" && <p className="cm-caption">Выбери стопку или перетащи её к единицам</p>}
      {phase !== "exchange" && !exchange.busy && <p className="cm-caption">Один десяток разложили на 10 монет</p>}
      {phase === "done" && <div className="pv-regroup-compare">
        {[[ "Было", task.initial ], [ "Стало", task.after ]].map(([label, value]) => <div key={label} className="pv-regroup-step">
          <span className="pv-regroup-step-label">{label}</span>
          <span className="pv-regroup-step-eq">{value.tens} {pluralTens(value.tens)} и {value.ones} {pluralOnes(value.ones)} = <b>{task.number}</b></span>
        </div>)}
      </div>}
      {phase !== "exchange" && teaching && task.allowReverse !== false && <div className="cm-tools">
        <Button variant="secondary" disabled={exchange.busy} onClick={groupBack}>Собрать обратно</Button>
      </div>}
    </CoinLesson>
  </DndContext>;
}
