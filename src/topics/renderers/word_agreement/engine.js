import { shuffle } from "@/shared/utils/shuffle";

// Fixed grammatical forms for each lexical set. The exercise starts with two
// variants and can gradually introduce up to the full six-form set.
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

const OPTION_COUNTS = new Set([2, 3, 4, 6]);

function getOptionCount(params) {
  const value = Number(params?.optionCount);
  return OPTION_COUNTS.has(value) ? value : 2;
}

function limitedOptions(pool, answer, count) {
  const distractors = shuffle(pool.filter((word) => word !== answer));
  return shuffle([answer, ...distractors.slice(0, count - 1)]);
}

function buildCaseAgreementTasks(cards, params) {
  const optionCount = getOptionCount(params);
  const includeAdvancedCards = params?.includeAdvancedCards === true;

  return shuffle(
    cards
      .filter((card) => card.skill === "case_agreement")
      .filter((card) => includeAdvancedCards || card.difficulty !== "advanced")
      .map((card) => ({
        type: "case_agreement",
        card,
        options: limitedOptions(FORMS_BY_WORD[card.word]?.[card.optionSet] ?? [], card.answer, optionCount),
      }))
  );
}

// Full present-tense conjugation is retained as source data, but the child is
// only offered third-person forms. This keeps the stated goal focused on number
// rather than introducing irrelevant first- and second-person endings.
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

function buildVerbOptions(card, count) {
  const forms = VERB_FORMS[card.verb] ?? [];
  const isPlural = card.answer === forms[5];
  const otherNumber = forms[isPlural ? 2 : 5];
  const sameNumberOtherVerbs = Object.entries(VERB_FORMS)
    .filter(([verb]) => verb !== card.verb)
    .map(([, verbForms]) => verbForms[isPlural ? 5 : 2]);

  return limitedOptions([otherNumber, ...sameNumberOtherVerbs], card.answer, count);
}

function buildVerbNumberTasks(cards, params) {
  const optionCount = getOptionCount(params);
  return shuffle(
    cards
      .filter((card) => card.skill === "verb_number_agreement")
      .map((card) => ({
        type: "verb_number",
        card,
        options: buildVerbOptions(card, optionCount),
      }))
  );
}

// Past-tense forms for the verb_gender_agreement mode: masc/fem/neut are
// spelled differently, plural is shared across genders. Distractors mix the
// same verb's other genders (the actual skill being tested) with the same
// gender's forms of other verbs (used to fill out larger option counts).
const VERB_GENDER_FORMS = {
  poyti:      { masc: "пошёл",     fem: "пошла",     neut: "пошло",     plural: "пошли" },
  priti:      { masc: "пришёл",    fem: "пришла",    neut: "пришло",    plural: "пришли" },
  upast:      { masc: "упал",      fem: "упала",      neut: "упало",     plural: "упали" },
  lezhat:     { masc: "лежал",     fem: "лежала",     neut: "лежало",    plural: "лежали" },
  stoyat:     { masc: "стоял",     fem: "стояла",     neut: "стояло",    plural: "стояли" },
  pokatitsya: { masc: "покатился", fem: "покатилась", neut: "покатилось", plural: "покатились" },
};

const GENDERS = ["masc", "fem", "neut", "plural"];

function buildVerbGenderOptions(card, count) {
  const forms = VERB_GENDER_FORMS[card.verb] ?? {};
  const answerGender = GENDERS.find((gender) => forms[gender] === card.answer);
  const sameVerbOtherGenders = GENDERS.filter((gender) => gender !== answerGender).map((gender) => forms[gender]);
  const sameGenderOtherVerbs = Object.entries(VERB_GENDER_FORMS)
    .filter(([verb]) => verb !== card.verb)
    .map(([, verbForms]) => verbForms[answerGender]);

  return limitedOptions([...sameVerbOtherGenders, ...sameGenderOtherVerbs], card.answer, count);
}

function buildVerbGenderTasks(cards, params) {
  const optionCount = getOptionCount(params);
  return shuffle(
    cards
      .filter((card) => card.skill === "verb_gender_agreement")
      .map((card) => ({
        type: "verb_gender",
        card,
        options: buildVerbGenderOptions(card, optionCount),
      }))
  );
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  const modeType = mode?.type ?? mode?.id;
  if (modeType === "case_agreement") return buildCaseAgreementTasks(cards, params);
  if (modeType === "verb_number_agreement") return buildVerbNumberTasks(cards, params);
  if (modeType === "verb_gender_agreement") return buildVerbGenderTasks(cards, params);
  return [{ type: modeType }];
}
