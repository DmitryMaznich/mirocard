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
  mashina: {
    singular: ["машина", "машины", "машине", "машину", "машиной", "машин"],
    plural:   ["машины", "машин", "машинам", "машинами", "машинах", "машина"],
  },
  yabloko: {
    singular: ["яблоко", "яблока", "яблоку", "яблоком", "яблоке", "яблок"],
    plural:   ["яблоки", "яблок", "яблокам", "яблоками", "яблоках", "яблоко"],
  },
};

function buildCaseAgreementTasks(cards) {
  return shuffle(
    cards
      .filter((c) => c.skill === "case_agreement")
      .map((card) => ({
        type: "case_agreement",
        card,
        options: FORMS_BY_WORD[card.word]?.[card.optionSet] ?? [],
      }))
  );
}

// verb_number cards carry their own two-option pool directly (card.options:
// [singular verb, plural verb]) since it's specific to that one sentence,
// not a reusable per-word paradigm like case_agreement's noun forms.
function buildVerbNumberTasks(cards) {
  return shuffle(
    cards
      .filter((c) => c.skill === "verb_number_agreement")
      .map((card) => ({
        type: "verb_number",
        card,
        options: card.options ?? [],
      }))
  );
}

export function generateTasks(mode, cards) {
  const modeType = mode?.type ?? mode?.id;
  if (modeType === "case_agreement") {
    return buildCaseAgreementTasks(cards);
  }
  if (modeType === "verb_number_agreement") {
    return buildVerbNumberTasks(cards);
  }
  // Placeholder modes (verb gender, adjective agreement, etc.) aren't built
  // yet — a single task is enough for the renderer to show "Скоро".
  return [{ type: modeType }];
}
