import FillBlankTask from "./FillBlankTask";
import PlaceholderTask from "./PlaceholderTask";
import PrepositionTask from "./PrepositionTask";
import "./WordAgreement.css";

// case_agreement, verb_number, verb_gender, numeral_agreement,
// adjective_agreement and possessive_agreement are all plain "sentence with
// a blank, pick the matching word form" tasks — same component, the
// difference is entirely in the card data.
const FILL_BLANK_TYPES = new Set(["case_agreement", "verb_number", "verb_gender", "numeral_agreement", "adjective_agreement", "possessive_agreement"]);
const PREPOSITION_TYPES = new Set(["preposition_recognize", "preposition_place", "preposition_phrase"]);

export default function WordAgreementRenderer({ task, topicId, playTopicFile, onCorrect, onMistake, onAdvance, onCardShown, onTap }) {
  if (PREPOSITION_TYPES.has(task?.type)) {
    return (
      <PrepositionTask
        key={task.card.id}
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
