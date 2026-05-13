import SentencePuzzleBuilder from "./SentencePuzzleBuilder";
import ListenBuildView       from "./ListenBuildView";
import "./sentence_puzzle.css";

export default function SentencePuzzleRenderer(props) {
  if (props.mode?.type === "listen_build") {
    return (
      <ListenBuildView
        task={props.task}
        topicId={props.topicId}
        soundEnabled={props.soundEnabled}
        playTopicFile={props.playTopicFile}
        onCorrect={props.onCorrect}
        onIncorrect={props.onIncorrect}
      />
    );
  }
  return (
    <SentencePuzzleBuilder
      task={props.task}
      sessionParams={props.sessionParams}
      student={props.student}
      soundEnabled={props.soundEnabled}
    />
  );
}
