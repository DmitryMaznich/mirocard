import IntroTask          from "./IntroTask";
import PairComparisonTask from "./PairComparisonTask";
import ChooseTwoTask      from "./ChooseTwoTask";
import FindAllTask        from "./FindAllTask";
import SortTask           from "./SortTask";

export default function OppositeRenderer({ task, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "intro":           return <IntroTask task={task} onAdvance={onAdvance} />;
    case "pair_comparison": return <PairComparisonTask task={task} onAdvance={onAdvance} />;
    case "choose_two":      return <ChooseTwoTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "find_all":        return <FindAllTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "sort":            return <SortTask task={task} onCorrect={onCorrect} onMistake={onMistake} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
          Неизвестный тип: {task?.type}
        </div>
      );
  }
}
