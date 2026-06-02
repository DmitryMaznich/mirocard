import "./letter_writing.css";
import LetterDemoView   from "./LetterDemoView";
import LetterFollowView from "./LetterFollowView";
import LetterTraceView  from "./LetterTraceView";

export default function LetterWritingRenderer({ task, mode, onAdvance }) {
  if (!task) return null;

  switch (task.type) {
    case "letter_demo":
      return <LetterDemoView   task={task} onAdvance={onAdvance} />;
    case "letter_follow":
      return <LetterFollowView task={task} onAdvance={onAdvance} />;
    case "letter_trace":
      return <LetterTraceView  task={task} onAdvance={onAdvance} />;
    default:
      return <LetterDemoView   task={task} onAdvance={onAdvance} />;
  }
}
