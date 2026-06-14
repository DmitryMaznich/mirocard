import MatchTask from "./MatchTask";

export default function PhraseMatchRenderer({ task, topicId, onAdvance, onCorrect, onIncorrect, onMistake }) {
  if (task?.type === "match") {
    return (
      <MatchTask
        task={task}
        topicId={topicId}
        onCorrect={onCorrect}
        onIncorrect={onIncorrect}
      />
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
      Неизвестный тип: {task?.type}
    </div>
  );
}
