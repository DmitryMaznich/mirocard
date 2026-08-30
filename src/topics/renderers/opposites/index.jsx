import IntroTask          from "./IntroTask";
import PairComparisonTask from "./PairComparisonTask";
import ChooseTwoTask      from "./ChooseTwoTask";
import FindAllTask        from "./FindAllTask";
import SortTask           from "./SortTask";
import FindOppositeTask   from "./FindOppositeTask";

export default function OppositeRenderer({ task, mode, topicId, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "intro":            return <IntroTask task={task} topicId={topicId} onAdvance={onAdvance} />;
    case "pair_comparison": return <PairComparisonTask task={task} topicId={topicId} onAdvance={onAdvance} />;
    case "choose_two":      return <ChooseTwoTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "find_all":        return <FindAllTask task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "sort":            return <SortTask task={task} topicId={topicId} onCorrect={onCorrect} onMistake={onMistake} />;
    case "find_opposite":   return <FindOppositeTask task={task} mode={mode} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
          Неизвестный тип: {task?.type}
        </div>
      );
  }
}
