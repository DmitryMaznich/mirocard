import "./phonetic_analysis.css";
import SoundMatchView    from "./SoundMatchView";
import SoundPositionView from "./SoundPositionView";

export default function PhoneticAnalysisRenderer({ task, topicId, onAdvance, onCorrect, onMistake }) {
  if (!task) return null;
  switch (task.type) {
    case "first_sound":
    case "last_sound":
    case "missing_letter":
      return (
        <SoundMatchView
          key={task.taskId}
          task={task}
          topicId={topicId}
          onAdvance={onAdvance}
          onCorrect={onCorrect}
          onMistake={onMistake}
        />
      );
    case "sound_position":
      return (
        <SoundPositionView
          key={task.taskId}
          task={task}
          topicId={topicId}
          onAdvance={onAdvance}
          onCorrect={onCorrect}
          onMistake={onMistake}
        />
      );
    default:
      return <div style={{ padding: 24, color: "#aaa" }}>Неизвестный тип задания: {task.type}</div>;
  }
}
