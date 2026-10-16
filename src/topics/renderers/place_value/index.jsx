import { useRef, useState } from "react";
import BuildNumberTask from "./BuildNumberTask.jsx";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";
import ExchangeTenTask from "./ExchangeTenTask.jsx";
import GroupTenTask from "./GroupTenTask.jsx";
import PlacePartsTask from "./PlacePartsTask.jsx";
import NumberNamesTask from "./NumberNamesTask.jsx";
import CountTensTask from "./CountTensTask.jsx";

const TASKS = {
  group_ten: GroupTenTask,
  build_number: BuildNumberTask,
  identify_number: IdentifyNumberTask,
  exchange_ten: ExchangeTenTask,
  place_parts: PlacePartsTask,
  number_names: NumberNamesTask,
  count_tens: CountTensTask,
};

// How long a wrong answer stays red in a check before the next task.
export const CHECK_MISTAKE_MS = 1000;

// A wrong answer here is one step inside a multi-step task (questions already
// answered, a model half built), so with strict stars it goes through
// onStreakReset: the mistake and the lost streak are recorded, but taskRetry
// isn't bumped and SessionScreen doesn't remount the task and wipe that work.
export default function PlaceValueRenderer({ task, sessionParams, onCorrect, onIncorrect, onStreakReset, onFlashIncorrect }) {
  const Task = TASKS[task?.type];
  if (!Task) return <div className="pv-screen" style={{ color: "#666", fontSize: 18 }}>Нет задания</div>;
  if (task.check) return <CheckTask key={task.cardId} Task={Task} task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} onFlashIncorrect={onFlashIncorrect} />;
  return (
    <Task
      key={`${task.cardId}-${task.number}`}
      task={task}
      onCorrect={onCorrect}
      onMistake={sessionParams?.strictStars ? onStreakReset : undefined}
      onFlashIncorrect={onFlashIncorrect}
    />
  );
}

// A task of a check («Проверка: до 100»): the mode's own screen without hints;
// the first mistake leaves the answer red for a moment (no explanation, no
// right answer shown), then the next task — taps wait meanwhile.
function CheckTask({ Task, task, onCorrect, onIncorrect, onFlashIncorrect }) {
  const [frozen, setFrozen] = useState(false);
  const done = useRef(false);
  function mistake(conceptId, cardId) {
    if (done.current) return;
    done.current = true;
    setFrozen(true);
    setTimeout(() => onIncorrect?.(conceptId, cardId), CHECK_MISTAKE_MS);
  }
  return (
    <div className="pv-check">
      <Task task={task} onCorrect={(...args) => { if (!done.current) { done.current = true; onCorrect(...args); } }} onMistake={mistake} onFlashIncorrect={onFlashIncorrect} />
      {frozen && <div className="pv-check-freeze" aria-hidden="true" />}
    </div>
  );
}
