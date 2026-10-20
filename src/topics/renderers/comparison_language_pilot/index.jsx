import "./comparison.css";
import CompareVisual from "./CompareVisual.jsx";
import CompareSign from "./CompareSign.jsx";

export default function ComparisonLanguagePilot(props) {
  function onIncorrect(...args) {
    props.onIncorrect(...args);
    if (props.soundEnabled && props.task.retryAudio) props.playTopicFile?.(props.topicId, props.task.retryAudio);
  }
  if (props.mode.type === "compare_visual") return <CompareVisual {...props} onIncorrect={onIncorrect} />;
  if (props.mode.type === "compare_sign") return <CompareSign {...props} onIncorrect={onIncorrect} />;
  throw new Error("Unsupported comparison pilot mode");
}
