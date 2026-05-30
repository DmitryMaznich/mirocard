import PairComparisonTask from "./PairComparisonTask";
import ChooseTwoTask      from "./ChooseTwoTask";
import FindAllTask        from "./FindAllTask";
import SortTask           from "./SortTask";

export default function OppositeRenderer({ task, topicId, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "pair_comparison": return <PairComparisonTask task={task} topicId={topicId} onAdvance={onAdvance} />;
    case "choose_two":      return <ChooseTwoTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "find_all":        return <FindAllTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "sort":            return <SortTask task={task} topicId={topicId} onCorrect={onCorrect} onMistake={onMistake} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
          Неизвестный тип: {task?.type}
        </div>
      );
  }
}
