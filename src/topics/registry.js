import FlashcardsRenderer from "./renderers/flashcards/index.jsx";
import ComparisonRenderer from "./renderers/comparison/index.jsx";
import MathHousesRenderer from "./renderers/math_houses/index.jsx";

export const RENDERER_REGISTRY = {
  flashcards:  FlashcardsRenderer,
  comparison:  ComparisonRenderer,
  math_houses: MathHousesRenderer,
};
