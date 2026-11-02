import "./print_letters.css";
import ConstructorView from "./ConstructorView";

export default function PrintLettersRenderer({ task, onAdvance }) {
  if (!task) return null;
  return <ConstructorView task={task} onAdvance={onAdvance} />;
}
