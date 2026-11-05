import "./propis2-style.css";
import "./print_letters.css";
import "./screenWrite/screen_write.css";
import "./fixLetter/fix_letter.css";
import PrintLettersHome from "./PrintLettersHome";
import ScreenWriteView from "./screenWrite/ScreenWriteView";
import FixLetterView from "./fixLetter/FixLetterView";

// «Печатные буквы»: «Мои тетради» and the notebook editor (PrintLettersHome), a full screen of its
// own (src/features/printLetters/PrintLettersScreen.jsx, routed from App like propis2's home).
// `accountKv` is the app's bridge to the account's documents (src/topics/accountKv.js) — absent in
// an older app: the notebooks then stay on this device only.
// `makePdf` makes the notebook's PDF (the app's printLettersPdf.js) — absent in an older app: then
// «PDF» falls back to the browser's print.
// «Пишу на экране» (task type pl_screen_write) runs in the ordinary session: one copy of one
// letter per task (screenWrite/ScreenWriteView.jsx, docs/print-letters-screen-writing.md).
// «Почини букву» (task type pl_fix_letter) — a game of cards in the ordinary session: put the knocked-out
// strokes of a letter back (fixLetter/FixLetterView.jsx, docs/print-letters-fix-letter.md).
export default function PrintLettersRenderer({ task, onBack, onAdvance, onCorrect, onPrevious, accountKv, makePdf, soundEnabled }) {
  if (!task) return null;
  if (task.type === "pl_fix_letter") return <FixLetterView task={task} onCorrect={onCorrect} onAdvance={onAdvance} onPrevious={onPrevious} soundEnabled={soundEnabled} />;
  if (task.type === "pl_screen_write") return <ScreenWriteView task={task} onCorrect={onCorrect} onAdvance={onAdvance} onPrevious={onPrevious} />;
  return <PrintLettersHome task={task} onBack={onBack} onAdvance={onAdvance} accountKv={accountKv} makePdf={makePdf} />;
}
