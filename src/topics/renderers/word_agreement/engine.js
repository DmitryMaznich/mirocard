import { shuffle } from "@/shared/utils/shuffle";

// Fixed 6-word option pools per lexical set, keyed by word id + grammatical
// number. Each case_agreement card names its word (card.word) and which pool
// applies (card.optionSet: "singular" | "plural").
export const FORMS_BY_WORD = {
  myach: {
    singular: ["мяч", "мяча", "мячу", "мячом", "мяче", "мячей"],
    plural:   ["мячи", "мячей", "мячам", "мячами", "мячах", "мяч"],
  },
  karandash: {
    singular: ["карандаш", "карандаша", "карандашу", "карандашом", "карандаше", "карандашей"],
    plural:   ["карандаши", "карандашей", "карандашам", "карандашами", "карандашах", "карандаш"],
  },
  mashinka: {
    singular: ["машинка", "машинки", "машинке", "машинку", "машинкой", "машинок"],
    plural:   ["машинки", "машинок", "машинкам", "машинками", "машинках", "машинка"],
  },
  yabloko: {
    singular: ["яблоко", "яблока", "яблоку", "яблоком", "яблоке", "яблок"],
    plural:   ["яблоки", "яблок", "яблокам", "яблоками", "яблоках", "яблоко"],
  },
};

function buildCaseAgreementTasks(cards) {
  return shuffle(cards.map((card) => ({
    type: "case_agreement",
    card,
    options: FORMS_BY_WORD[card.word]?.[card.optionSet] ?? [],
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
