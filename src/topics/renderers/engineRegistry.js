import { generateTasks as flashcardsEngine }          from "./flashcards/engine";
import { generateTasks as oppositeEngine }            from "./opposites/engine";
import { generateTasks as comparisonEngine }           from "./comparison/engine";
import { generateTasks as mathHousesEngine }           from "./math_houses/engine";
import { generateTasks as additionSubtractionEngine }  from "./addition_subtraction/engine";
import { generateTasks as readingEngine }              from "./reading/engine";
import { generateTasks as sentencePuzzleEngine }       from "./sentence_puzzle/engine";
import { generateTasks as functionCardsEngine }        from "./function_cards/engine";
import { generateTasks as magneticAlphabetEngine }     from "./magnetic_alphabet/engine";
import { generateTasks as vowelConsonantEngine }       from "./vowel_consonant/engine";
import { generateTasks as narrativeEngine }            from "./narrative/engine";
import { generateTasks as letterWritingEngine }        from "./letter_writing/engine";
import { generateTasks as streakTrackerEngine }        from "./streak_tracker/engine";
import { generateTasks as shoppingEngine }             from "./shopping/engine";

export const ENGINE_REGISTRY = {
  flashcards:            flashcardsEngine,
  comparison:            comparisonEngine,
  math_houses:           mathHousesEngine,
  addition_subtraction:  additionSubtractionEngine,
  reading:               readingEngine,
  sentence_puzzle:       sentencePuzzleEngine,
  function_cards:        functionCardsEngine,
  magnetic_alphabet:     magneticAlphabetEngine,
  vowel_consonant:       vowelConsonantEngine,
  opposites:             oppositeEngine,
  narrative:             narrativeEngine,
  letter_writing:        letterWritingEngine,
  streak_tracker:        streakTrackerEngine,
  shopping:              shoppingEngine,
};
