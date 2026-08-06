import "./propis.css";
import PropisShowView from "./PropisShowView";

export default function PropisRenderer({ task, onAdvance, onClose }) {
  if (!task) return null;

  switch (task.type) {
    case "show":
      return <PropisShowView task={task} onAdvance={onAdvance} onClose={onClose} />;
    default:
      return <PropisShowView task={task} onAdvance={onAdvance} onClose={onClose} />;
  }
}
