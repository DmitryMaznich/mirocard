import "./propis.css";
import PropisPracticeView from "./PropisPracticeView";
import PropisShowView from "./PropisShowView";

export default function PropisRenderer({ task, onAdvance, onClose }) {
  if (!task) return null;

  switch (task.type) {
    case "practice":
      return <PropisPracticeView task={task} onAdvance={onAdvance} onClose={onClose} />;
    case "show":
      return <PropisShowView task={task} onAdvance={onAdvance} onClose={onClose} />;
    default:
      return <PropisPracticeView task={task} onAdvance={onAdvance} onClose={onClose} />;
  }
}
