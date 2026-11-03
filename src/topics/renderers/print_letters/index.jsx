import "./print_letters.css";
import PrintLettersHome from "./PrintLettersHome";

// «Печатные буквы»: «Мои тетради» and the notebook editor (PrintLettersHome).
// `accountKv` is the app's bridge to the account's documents (SessionScreen,
// src/topics/accountKv.js) — absent in an older app: the notebooks then stay
// on this device only.
export default function PrintLettersRenderer({ task, onAdvance, accountKv }) {
  if (!task) return null;
  return <PrintLettersHome task={task} onAdvance={onAdvance} accountKv={accountKv} />;
}
