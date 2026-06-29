import PairIntroTask   from "./PairIntroTask";
import FormItTask      from "./FormItTask";
import YesNoTask       from "./YesNoTask";
import QuestionAskTask from "./QuestionAskTask";
import "./WordFormation.css";

export default function WordFormationRenderer({ task, topicId, onAdvance, onCorrect, onIncorrect }) {
  switch (task?.type) {
    case "pair_intro":   return <PairIntroTask   task={task} topicId={topicId} onAdvance={onAdvance} />;
    case "form_it":      return <FormItTask      task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "yes_no":       return <YesNoTask       task={task} topicId={topicId} onCorrect={onCorrect} onIncorrect={onIncorrect} />;
    case "question_ask": return <QuestionAskTask task={task} topicId={topicId} onAdvance={onAdvance} onCorrect={onCorrect} />;
    default:
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa" }}>
          Неизвестный тип задания: {task?.type}
        </div>
      );
  }
}
