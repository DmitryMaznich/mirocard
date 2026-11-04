import "./propis2-style.css";
import "./print_letters.css";
import "./screenWrite/screen_write.css";
import PrintLettersHome from "./PrintLettersHome";
import ScreenWriteView from "./screenWrite/ScreenWriteView";

// «Печатные буквы»: «Мои тетради» and the notebook editor (PrintLettersHome), a full screen of its
// own (src/features/printLetters/PrintLettersScreen.jsx, routed from App like propis2's home).
// `accountKv` is the app's bridge to the account's documents (src/topics/accountKv.js) — absent in
// an older app: the notebooks then stay on this device only.
// `makePdf` makes the notebook's PDF (the app's printLettersPdf.js) — absent in an older app: then
// «PDF» falls back to the browser's print.
// «Пишу на экране» (task type pl_screen_write) runs in the ordinary session: one copy of one
// letter per task (screenWrite/ScreenWriteView.jsx, docs/print-letters-screen-writing.md).
export default function PrintLettersRenderer({ task, onBack, onAdvance, onCorrect, accountKv, makePdf }) {
  if (!task) return null;
  if (task.type === "pl_screen_write") return <ScreenWriteView task={task} onCorrect={onCorrect} onAdvance={onAdvance} />;
  return <PrintLettersHome task={task} onBack={onBack} onAdvance={onAdvance} accountKv={accountKv} makePdf={makePdf} />;
}
