import IntroTask          from "./IntroTask";
import PairComparisonTask from "./PairComparisonTask";
import ChooseTwoTask      from "./ChooseTwoTask";

export default function OppositeRenderer({ task, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "intro":           return <IntroTask task={task} onAdvance={onAdvance} />;
    case "pair_comparison": return <PairComparisonTask task={task} onAdvance={onAdvance} />;
    case "choose_two":      return <ChooseTwoTask task={task} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
          Режим в разработке: {task?.type}
        </div>
      );
  }
}
