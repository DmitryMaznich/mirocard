import { useState } from "react";
import Button from "@/shared/components/Button";
import { CoinAnswer, CoinBoard, CoinLesson } from "./CoinLesson.jsx";
import { placeValueAnswerSentence } from "./placeValueLabels.js";

export default function IdentifyNumberTask({ task, onCorrect, onMistake, onFlashIncorrect }) {
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [counting, setCounting] = useState(false);
  const [counted, setCounted] = useState([]);
  function check(guess) {
    if (guess === task.number) { setSolved(true); setFeedback(""); return true; }
    setFeedback(task.supportMode === "independent" ? "Проверь число ещё раз" : "Посчитай стопки и отдельные монеты ещё раз");
    onMistake?.(task.conceptId, task.cardId); onFlashIncorrect?.();
    return false;
  }
  return <CoinLesson title={solved ? "Правильно!" : "Какое это число?"} solved={solved}
    feedback={solved ? placeValueAnswerSentence(task.model.tens, task.model.ones, task.number) : feedback}
    controls={solved ? <Button onClick={() => onCorrect(task.conceptId, task.cardId)}>Далее →</Button> : <CoinAnswer onSubmit={check} />}>
    <CoinBoard tens={Array.from({ length: task.model.tens }, (_, i) => "read-ten-" + i)}
      ones={Array.from({ length: task.model.ones }, (_, i) => "read-one-" + i)} counted={counted}
      onCount={counting && !solved ? (key) => setCounted((c) => c.includes(key) ? c.filter((id) => id !== key) : [...c, key]) : undefined} />
    {!solved && task.supportMode !== "independent" && <div className="cm-tools">
      <Button variant="secondary" onClick={() => { setCounting((c) => !c); setCounted([]); }}>{counting ? "Закончить счёт" : "Посчитать"}</Button>
      {counting && <span className="cm-caption">Нажимай на предметы, которые уже посчитал</span>}
    </div>}
  </CoinLesson>;
}
