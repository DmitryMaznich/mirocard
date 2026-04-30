import { generateTasks as flashcardsEngine } from "./flashcards/engine";
import { generateTasks as comparisonEngine  } from "./comparison/engine";
import { generateTasks as mathHousesEngine  } from "./math_houses/engine";

export const ENGINE_REGISTRY = {
  flashcards:  flashcardsEngine,
  comparison:  comparisonEngine,
  math_houses: mathHousesEngine,
};
