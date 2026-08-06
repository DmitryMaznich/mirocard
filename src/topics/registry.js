import FlashcardsRenderer          from "./renderers/flashcards/index.jsx";
import OppositeRenderer            from "./renderers/opposites/index.jsx";
import ComparisonRenderer          from "./renderers/comparison/index.jsx";
import MathHousesRenderer          from "./renderers/math_houses/index.jsx";
import AdditionSubtractionRenderer from "./renderers/addition_subtraction/index.jsx";
import ReadingRenderer             from "./renderers/reading/index.jsx";
import FunctionCardsRenderer       from "./renderers/function_cards/index.jsx";
import VowelConsonantRenderer      from "./renderers/vowel_consonant/index.jsx";
import NarrativeRenderer           from "./renderers/narrative/index.jsx";
import LetterWritingRenderer       from "./renderers/letter_writing/index.jsx";
import StreakTrackerRenderer        from "./renderers/streak_tracker/index.jsx";
import PhraseMatchRenderer          from "./renderers/phrase_match/index.jsx";
import ColumnAdditionRenderer       from "./renderers/column_addition/index.jsx";
import WrittenLettersRenderer       from "./renderers/written_letters/index.jsx";
import PrintMaterialsRenderer       from "./renderers/print_materials/index.jsx";
import WordFormationRenderer        from "./renderers/word_formation/index.jsx";
import PhoneticAnalysisRenderer      from "./renderers/phonetic_analysis/index.jsx";
import WordAgreementRenderer        from "./renderers/word_agreement/index.jsx";
import PropisRenderer               from "./renderers/propis/index.jsx";

export const RENDERER_REGISTRY = {
  flashcards:            FlashcardsRenderer,
  comparison:            ComparisonRenderer,
  math_houses:           MathHousesRenderer,
  addition_subtraction:  AdditionSubtractionRenderer,
  reading:               ReadingRenderer,
  function_cards:        FunctionCardsRenderer,
  vowel_consonant:       VowelConsonantRenderer,
  opposites:             OppositeRenderer,
  narrative:             NarrativeRenderer,
  letter_writing:        LetterWritingRenderer,
  streak_tracker:        StreakTrackerRenderer,
  phrase_match:          PhraseMatchRenderer,
  column_addition:       ColumnAdditionRenderer,
  written_letters:       WrittenLettersRenderer,
  print_materials:       PrintMaterialsRenderer,
  word_formation:        WordFormationRenderer,
  phonetic_analysis:     PhoneticAnalysisRenderer,
  word_agreement:        WordAgreementRenderer,
  propis:                PropisRenderer,
};
