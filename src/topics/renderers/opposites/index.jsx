import IntroTask          from "./IntroTask";
import PairComparisonTask from "./PairComparisonTask";

export default function OppositeRenderer({ task, onAdvance, onCorrect, onIncorrect, onMistake }) {
  switch (task?.type) {
    case "intro":           return <IntroTask task={task} onAdvance={onAdvance} />;
    case "pair_comparison": return <PairComparisonTask task={task} onAdvance={onAdvance} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: "1.2rem" }}>
          Режим в разработке: {task?.type}
        </div>
      );
  }
}
