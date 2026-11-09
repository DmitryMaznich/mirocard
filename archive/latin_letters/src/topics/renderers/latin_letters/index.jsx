import "./latin_letters.css";
import LatinLettersApp from "./LatinLettersApp";

// «Латиница» (latin_letters): the notebook constructor for Latin handwriting — styles and languages
// are data (styles.js, languages.js), docs/latin-letters.md. A full screen of its own, like
// print_letters (src/features/printLetters/PrintLettersScreen.jsx). `accountKv` keeps the notebooks
// in the account; `makePdf` is the app's vector PDF maker — both absent in an older app.
export default function LatinLettersRenderer({ task, onBack, accountKv, makePdf }) {
  if (!task) return null;
  return <LatinLettersApp onBack={onBack} accountKv={accountKv} makePdf={makePdf} />;
}
