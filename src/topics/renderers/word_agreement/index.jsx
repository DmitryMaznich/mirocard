import FillBlankTask from "./FillBlankTask";
import PlaceholderTask from "./PlaceholderTask";
import "./WordAgreement.css";

// case_agreement (noun form) and verb_number (verb form) are both plain
// "sentence with a blank, pick the matching word form" tasks — same
// component, the difference is entirely in the card data.
const FILL_BLANK_TYPES = new Set(["case_agreement", "verb_number"]);

export default function WordAgreementRenderer({ task, topicId, playTopicFile, onCorrect, onMistake, onAdvance, onCardShown, onTap }) {
  if (FILL_BLANK_TYPES.has(task?.type)) {
    return (
      <FillBlankTask
        task={task}
        topicId={topicId}
        playTopicFile={playTopicFile}
        onCorrect={onCorrect}
        onMistake={onMistake}
        onAdvance={onAdvance}
        onCardShown={onCardShown}
        onTap={onTap}
      />
    );
  }
  return <PlaceholderTask />;
}
