import SentencePuzzleBuilder from "./SentencePuzzleBuilder";
import ListenBuildView       from "./ListenBuildView";
import ListenBuildHintView   from "./ListenBuildHintView";
import LetterWriteView       from "./LetterWriteView";
import "./sentence_puzzle.css";

export default function SentencePuzzleRenderer(props) {
  if (props.mode?.type === "listen_write_letters") {
    return (
      <LetterWriteView
        task={props.task}
        sessionParams={props.sessionParams}
        topicId={props.topicId}
        soundEnabled={props.soundEnabled}
        playTopicFile={props.playTopicFile}
        playFeedback={props.playFeedback}
        onCorrect={props.onCorrect}
        onAdvance={props.onAdvance}
      />
    );
  }
  if (props.mode?.type === "listen_build") {
    return (
      <ListenBuildView
        task={props.task}
        topicId={props.topicId}
        soundEnabled={props.soundEnabled}
        playTopicFile={props.playTopicFile}
        playFeedback={props.playFeedback}
        onCorrect={props.onCorrect}
        onIncorrect={props.onIncorrect}
        onMistake={props.onMistake}
      />
    );
  }
  if (props.mode?.type === "listen_build_mono") {
    return (
      <ListenBuildHintView
        task={props.task}
        topicId={props.topicId}
        soundEnabled={props.soundEnabled}
        playTopicFile={props.playTopicFile}
        playFeedback={props.playFeedback}
        onCorrect={props.onCorrect}
        onIncorrect={props.onIncorrect}
        onMistake={props.onMistake}
      />
    );
  }
  return (
    <SentencePuzzleBuilder
      task={props.task}
      sessionParams={props.sessionParams}
      student={props.student}
      soundEnabled={props.soundEnabled}
      playFeedback={props.playFeedback}
    />
  );
}
