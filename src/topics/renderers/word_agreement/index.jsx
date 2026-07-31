import CaseAgreementTask from "./CaseAgreementTask";
import PlaceholderTask from "./PlaceholderTask";
import "./WordAgreement.css";

export default function WordAgreementRenderer({ task, onCorrect, onMistake, onAdvance, onCardShown, onTap }) {
  switch (task?.type) {
    case "case_agreement":
      return (
        <CaseAgreementTask
          task={task}
          onCorrect={onCorrect}
          onMistake={onMistake}
          onAdvance={onAdvance}
          onCardShown={onCardShown}
          onTap={onTap}
        />
      );
    default:
      return <PlaceholderTask />;
  }
}
