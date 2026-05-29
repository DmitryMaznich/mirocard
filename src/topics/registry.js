import FlashcardsRenderer          from "./renderers/flashcards/index.jsx";
import OppositeRenderer            from "./renderers/opposites/index.jsx";
import ComparisonRenderer          from "./renderers/comparison/index.jsx";
import MathHousesRenderer          from "./renderers/math_houses/index.jsx";
import AdditionSubtractionRenderer from "./renderers/addition_subtraction/index.jsx";
import ReadingRenderer             from "./renderers/reading/index.jsx";
import FunctionCardsRenderer       from "./renderers/function_cards/index.jsx";
import VowelConsonantRenderer      from "./renderers/vowel_consonant/index.jsx";
import NarrativeRenderer           from "./renderers/narrative/index.jsx";

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
};
