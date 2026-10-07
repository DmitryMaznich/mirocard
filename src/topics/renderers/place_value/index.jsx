import BuildNumberTask from "./BuildNumberTask.jsx";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";
import RegroupTenTask from "./RegroupTenTask.jsx";

const TASKS = {
  build_number: BuildNumberTask,
  identify_number: IdentifyNumberTask,
  regroup_ten: RegroupTenTask,
};

export default function PlaceValueRenderer({ task, sessionParams, onCorrect, onMistake, onFlashIncorrect }) {
  const Task = TASKS[task?.type];
  if (!Task) return <div className="pv-screen" style={{ color: "#666", fontSize: 18 }}>Нет задания</div>;
  return (
    <Task
      key={`${task.cardId}-${task.number}`}
      task={task}
      onCorrect={onCorrect}
      onMistake={sessionParams?.strictStars ? onMistake : undefined}
      onFlashIncorrect={onFlashIncorrect}
    />
  );
}
