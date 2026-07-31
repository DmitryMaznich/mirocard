import { shuffle } from "@/shared/utils/shuffle";

// Fixed 6-word option pools for the "мяч" lexical set, shared by every
// case_agreement card via card.optionSet. Prototype uses one word family;
// more families will get their own pools once this mode is validated.
export const OPTION_SETS = {
  singular: ["мяч", "мяча", "мячу", "мячом", "мяче", "мячей"],
  plural:   ["мячи", "мячей", "мячам", "мячами", "мячах", "мяч"],
};

function buildCaseAgreementTasks(cards) {
  return shuffle(cards.map((card) => ({
    type: "case_agreement",
    card,
    options: OPTION_SETS[card.optionSet] ?? OPTION_SETS.singular,
  })));
}

export function generateTasks(mode, cards) {
  const modeType = mode?.type ?? mode?.id;
  if (modeType === "case_agreement") {
    return buildCaseAgreementTasks(cards);
  }
  // Placeholder modes (verb agreement, adjective agreement, etc.) aren't
  // built yet — a single task is enough for the renderer to show "Скоро".
  return [{ type: modeType }];
}
