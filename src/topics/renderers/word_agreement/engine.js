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

// Full present-tense conjugation (я/ты/он/мы/вы/они) per verb — six options,
// same size as the case_agreement pools, so a wrong pick can't be narrowed
// down to "the other button" by elimination. The child still only needs to
// look at the subject's number; the other four forms are wrong on person,
// not just number, but that's fine — nothing in the sentence is 1st/2nd
// person, so they're never a plausible fit either way.
const VERB_FORMS = {
  lezhat:    ["лежу",   "лежишь",   "лежит",   "лежим",   "лежите",   "лежат"],
  katitsya:  ["качусь", "катишься", "катится", "катимся", "катитесь", "катятся"],
  padat:     ["падаю",  "падаешь",  "падает",  "падаем",  "падаете",  "падают"],
  stoyat:    ["стою",   "стоишь",   "стоит",   "стоим",   "стоите",   "стоят"],
  ekhat:     ["еду",    "едешь",    "едет",    "едем",    "едете",    "едут"],
  viset:     ["вишу",   "висишь",   "висит",   "висим",   "висите",   "висят"],
  igrat:     ["играю",  "играешь",  "играет",  "играем",  "играете",  "играют"],
  risovat:   ["рисую",  "рисуешь",  "рисует",  "рисуем",  "рисуете",  "рисуют"],
  idti:      ["иду",    "идёшь",    "идёт",    "идём",    "идёте",    "идут"],
  gulyat:    ["гуляю",  "гуляешь",  "гуляет",  "гуляем",  "гуляете",  "гуляют"],
};

function buildVerbNumberTasks(cards) {
  return shuffle(
    cards
      .filter((c) => c.skill === "verb_number_agreement")
      .map((card) => ({
        type: "verb_number",
        card,
        options: VERB_FORMS[card.verb] ?? [],
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
