import "./propis.css";
import "./letters/letters.css";
import PropisPracticeView from "./PropisPracticeView";
import PropisShowView from "./PropisShowView";
import WriteWordsView from "./WriteWordsView";
import WriteTextView from "./WriteTextView";
import ReadTextView from "./ReadTextView";
import PrintPageView from "./PrintPageView";
import PrintMaterialsView from "./PrintMaterialsView";
import DictationView from "./DictationView";
import { LetterGlyphProvider } from "./letters/LetterGlyph";
import MatchView from "./letters/MatchView";
import MatchPairView from "./letters/MatchPairView";
import SortCaseView from "./letters/SortCaseView";
import AlphabetPairsView from "./letters/AlphabetPairsView";

// Letter-recognition views (merged in from "Письменные буквы", 2026-09-29) draw their letters
// from this topic's own captured ink -- the provider hands them topicRecord.cards.
function renderLettersView(task, { onAdvance, onCorrect, onMistake }) {
  switch (task.type) {
    case "sort_case":
      return <SortCaseView key={task.sessionKey + task.letter + task.letterCase} task={task} onAdvance={onAdvance} onCorrect={onCorrect} onMistake={onMistake} />;
    case "match_print_to_written":
    case "match_written_to_print":
      return <MatchView task={task} onAdvance={onAdvance} onCorrect={onCorrect} onMistake={onMistake} />;
    case "match_pair":
      return <MatchPairView key={task.stimulus?.letter} task={task} onAdvance={onAdvance} onCorrect={onCorrect} onMistake={onMistake} />;
    case "alphabet_pairs":
      return <AlphabetPairsView key="alphabet_pairs" task={task} />;
    default:
      return null;
  }
}

export default function PropisRenderer({ task, topicRecord, onAdvance, onClose, onCorrect, onMistake }) {
  if (!task) return null;

  const lettersView = renderLettersView(task, { onAdvance, onCorrect, onMistake });
  if (lettersView) {
    return <LetterGlyphProvider cards={topicRecord?.cards}>{lettersView}</LetterGlyphProvider>;
  }

  switch (task.type) {
    case "practice":
      return <PropisPracticeView task={task} onAdvance={onAdvance} onClose={onClose} />;
    case "show":
      return <PropisShowView task={task} onAdvance={onAdvance} onClose={onClose} />;
    case "write_words":
      return <WriteWordsView task={task} onClose={onClose} />;
    case "write_text":
      return <WriteTextView task={task} onClose={onClose} />;
    case "read_text":
      return <ReadTextView task={task} onClose={onClose} />;
    case "print_page":
      return <PrintPageView task={task} onClose={onClose} />;
    case "browse":
      return <PrintMaterialsView topicRecord={topicRecord} />;
    case "dictation":
      return <DictationView task={task} onClose={onClose} />;
    default:
      return <PropisPracticeView task={task} onAdvance={onAdvance} onClose={onClose} />;
  }
}
