import "./propis.css";
import PropisPracticeView from "./PropisPracticeView";
import PropisShowView from "./PropisShowView";
import WriteWordsView from "./WriteWordsView";
import WriteTextView from "./WriteTextView";

export default function PropisRenderer({ task, onAdvance, onClose }) {
  if (!task) return null;

  switch (task.type) {
    case "practice":
      return <PropisPracticeView task={task} onAdvance={onAdvance} onClose={onClose} />;
    case "show":
      return <PropisShowView task={task} onAdvance={onAdvance} onClose={onClose} />;
    case "write_words":
      return <WriteWordsView task={task} onClose={onClose} />;
    case "write_text":
      return <WriteTextView task={task} onClose={onClose} />;
    default:
      return <PropisPracticeView task={task} onAdvance={onAdvance} onClose={onClose} />;
  }
}
