import BuildNumberTask from "./BuildNumberTask.jsx";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";
import ExchangeTenTask from "./ExchangeTenTask.jsx";
import GroupTenTask from "./GroupTenTask.jsx";

const TASKS = {
  group_ten: GroupTenTask,
  build_number: BuildNumberTask,
  identify_number: IdentifyNumberTask,
  exchange_ten: ExchangeTenTask,
};

// A wrong answer here is one step inside a multi-step task (questions already
// answered, a model half built), so with strict stars it goes through
// onStreakReset: the mistake and the lost streak are recorded, but taskRetry
// isn't bumped and SessionScreen doesn't remount the task and wipe that work.
export default function PlaceValueRenderer({ task, sessionParams, onCorrect, onStreakReset, onFlashIncorrect }) {
  const Task = TASKS[task?.type];
  if (!Task) return <div className="pv-screen" style={{ color: "#666", fontSize: 18 }}>Нет задания</div>;
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
