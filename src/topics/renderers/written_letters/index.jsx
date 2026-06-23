import "./written_letters.css";
import MatchView    from "./MatchView";
import SortCaseView from "./SortCaseView";

export default function WrittenLettersRenderer({ task, onAdvance, onCorrect, onMistake }) {
  if (!task) return null;
  switch (task.type) {
    case "sort_case":
      return <SortCaseView key={task.sessionKey + task.letter + task.letterCase} task={task} onAdvance={onAdvance} onCorrect={onCorrect} onMistake={onMistake} />;
    case "match_print_to_written":
    case "match_written_to_print":
    case "match_pair":
      return <MatchView task={task} onAdvance={onAdvance} onCorrect={onCorrect} onMistake={onMistake} />;
    default:
      return <div style={{ padding: 24, color: "#aaa" }}>Неизвестный тип: {task.type}</div>;
  }
}
