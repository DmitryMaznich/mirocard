import "./propis2-style.css";
import "./print_letters.css";
import PrintLettersHome from "./PrintLettersHome";

// «Печатные буквы»: «Мои тетради» and the notebook editor (PrintLettersHome), a full screen of its
// own (src/features/printLetters/PrintLettersScreen.jsx, routed from App like propis2's home).
// `accountKv` is the app's bridge to the account's documents (src/topics/accountKv.js) — absent in
// an older app: the notebooks then stay on this device only.
export default function PrintLettersRenderer({ task, onBack, onAdvance, accountKv }) {
  if (!task) return null;
  return <PrintLettersHome task={task} onBack={onBack} onAdvance={onAdvance} accountKv={accountKv} />;
}
