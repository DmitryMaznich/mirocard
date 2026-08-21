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
  stol: {
    singular: ["стол", "стола", "столу", "столом", "столе", "столов"],
    plural:   ["столы", "столов", "столам", "столами", "столах", "стол"],
  },
  kniga: {
    singular: ["книга", "книги", "книге", "книгу", "книгой", "книг"],
    plural:   ["книги", "книг", "книгам", "книгами", "книгах", "книга"],
  },
  kukla: {
    singular: ["кукла", "куклы", "кукле", "куклу", "куклой", "кукол"],
    plural:   ["куклы", "кукол", "куклам", "куклами", "куклах", "кукла"],
  },
  okno: {
    singular: ["окно", "окна", "окну", "окном", "окне", "окон"],
    plural:   ["окна", "окон", "окнам", "окнами", "окнах", "окно"],
  },
  yaytso: {
    singular: ["яйцо", "яйца", "яйцу", "яйцом", "яйце", "яиц"],
    plural:   ["яйца", "яиц", "яйцам", "яйцами", "яйцах", "яйцо"],
  },
  // kot is the deck's only animate noun. Unlike the inanimate masc./neuter
  // words above (where accusative = nominative, so no separate slot is
  // needed), an animate masc. noun's accusative instead equals its
  // genitive — "кота" at index 1 already covers both roles, so this table
  // needs no extra slot either, just for the opposite reason.
  kot: {
    singular: ["кот", "кота", "коту", "котом", "коте", "котов"],
  },
  // The four characters' own names, declined for the first time — every
  // card above puts Иван/Алина/мама/папа only in the nominative (the one
  // doing the action). These let a name itself be the answer, e.g. as the
  // recipient of a gift ("подарил {кому}"). Only 5 forms each (no genitive-
  // plural bonus slot like the common nouns get) — a name has no natural
  // plural in this world, so that 6th distractor doesn't apply here.
  ivan:  { singular: ["Иван", "Ивана", "Ивану", "Иваном", "Иване"] },
  alina: { singular: ["Алина", "Алины", "Алине", "Алиной", "Алине"] },
  mama:  { singular: ["мама", "мамы", "маме", "мамой", "маме"] },
  papa:  { singular: ["папа", "папы", "папе", "папой", "папе"] },
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

// numeral_agreement reuses the exact same word/optionSet/FORMS_BY_WORD pool
// as case_agreement — 2-4 need genitive singular, 5+ need genitive plural,
// both already present in that table — only the trigger (a numeral instead
// of a preposition) and the card set differ.
function buildNumeralAgreementTasks(cards, params) {
  const optionCount = getOptionCount(params);
  return shuffle(
    cards
      .filter((card) => card.skill === "numeral_agreement")
      .map((card) => ({
        type: "numeral_agreement",
        card,
        options: limitedOptions(FORMS_BY_WORD[card.word]?.[card.optionSet] ?? [], card.answer, optionCount),
      }))
  );
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

// All choices remain forms of the same verb. The basic level isolates
// singular/plural in the third person; higher levels progressively add the
// first- and second-person forms, so a correct answer cannot be a coin flip.
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

function buildVerbOptions(card, optionCount) {
  const forms = VERB_FORMS[card.verb] ?? [];
  if (optionCount === 2) return shuffle([forms[2], forms[5]].filter(Boolean));
  if (optionCount === 4) return shuffle([forms[0], forms[2], forms[3], forms[5]].filter(Boolean));
  return shuffle(forms);
}

function buildVerbNumberTasks(cards, params) {
  const optionCount = [2, 4, 6].includes(Number(params?.optionCount))
    ? Number(params.optionCount)
    : 2;
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
// spelled differently, plural is shared across genders. Distractors are
// strictly the same verb's other genders — the skill this mode tests is
// picking the right ending for THIS verb, not telling verbs apart. An
// earlier version also mixed in the same gender's forms of other verbs to
// fill out larger option counts, but those often fit the sentence just as
// well semantically (different root, same ending), which let a child pick
// the "wrong" verb and still land on something that reads correctly —
// undermining the actual skill being tested.
const VERB_GENDER_FORMS = {
  poyti:      { masc: "пошёл",     fem: "пошла",     neut: "пошло",     plural: "пошли" },
  priti:      { masc: "пришёл",    fem: "пришла",    neut: "пришло",    plural: "пришли" },
  upast:      { masc: "упал",      fem: "упала",      neut: "упало",     plural: "упали" },
  lezhat:     { masc: "лежал",     fem: "лежала",     neut: "лежало",    plural: "лежали" },
  stoyat:     { masc: "стоял",     fem: "стояла",     neut: "стояло",    plural: "стояли" },
  pokatitsya: { masc: "покатился", fem: "покатилась", neut: "покатилось", plural: "покатились" },
  otkrytsya:  { masc: "открылся",  fem: "открылась",  neut: "открылось",  plural: "открылись" },
};

const GENDERS = ["masc", "fem", "neut", "plural"];

function buildVerbGenderOptions(card, count) {
  const forms = VERB_GENDER_FORMS[card.verb] ?? {};
  const answerGender = GENDERS.find((gender) => forms[gender] === card.answer);
  const sameVerbOtherGenders = GENDERS.filter((gender) => gender !== answerGender).map((gender) => forms[gender]);

  return limitedOptions(sameVerbOtherGenders, card.answer, count);
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

// adjective_agreement: same masc/fem/neut/plural shape as verb gender, and
// the same fix applies — distractors are strictly the same adjective's
// other genders. An earlier version also mixed in the same gender's forms
// of other adjectives (e.g. offering "новая"/"большая" alongside the
// correct "маленькая"), which just as often read as a perfectly
// grammatical, plausible-sounding sentence with a different adjective —
// letting a child pick the wrong word and still land on something that
// sounds right, same failure mode as the verb_gender fix above.
const ADJECTIVE_FORMS = {
  malenkiy: { masc: "маленький", fem: "маленькая", neut: "маленькое", plural: "маленькие" },
  novy:     { masc: "новый",     fem: "новая",     neut: "новое",     plural: "новые" },
  bolshoy:  { masc: "большой",   fem: "большая",   neut: "большое",   plural: "большие" },
};

function buildAdjectiveOptions(card, count) {
  const forms = ADJECTIVE_FORMS[card.adjective] ?? {};
  const answerGender = GENDERS.find((gender) => forms[gender] === card.answer);
  const sameAdjectiveOtherGenders = GENDERS.filter((gender) => gender !== answerGender).map((gender) => forms[gender]);

  return limitedOptions(sameAdjectiveOtherGenders, card.answer, count);
}

function buildAdjectiveAgreementTasks(cards, params) {
  const optionCount = getOptionCount(params);
  return shuffle(
    cards
      .filter((card) => card.skill === "adjective_agreement")
      .map((card) => ({
        type: "adjective_agreement",
        card,
        options: buildAdjectiveOptions(card, optionCount),
      }))
  );
}

// possessive_agreement: свой/мой/твой/наш all agree with the possessed
// noun's gender/number, same shape as adjectives. свой is tested as a direct
// object ("нашёл свой мяч") so its forms are the accusative ones — masc/
// neut/plural are spelled the same as nominative for inanimate nouns, only
// fem differs (своя -> свою). мой/твой/наш are tested as a predicate
// ("Это мой мяч") so those stay nominative.
const POSSESSIVE_FORMS = {
  svoy: { masc: "свой", fem: "свою", neut: "своё", plural: "свои" },
  moy:  { masc: "мой",  fem: "моя",  neut: "моё",  plural: "мои" },
  tvoy: { masc: "твой", fem: "твоя", neut: "твоё", plural: "твои" },
  nash: { masc: "наш",  fem: "наша", neut: "наше", plural: "наши" },
};

function buildPossessiveOptions(card, count) {
  const forms = POSSESSIVE_FORMS[card.possessive] ?? {};
  const answerGender = GENDERS.find((gender) => forms[gender] === card.answer);
  const samePossessiveOtherGenders = GENDERS.filter((gender) => gender !== answerGender).map((gender) => forms[gender]);
  const sameGenderOtherPossessives = Object.entries(POSSESSIVE_FORMS)
    .filter(([possessive]) => possessive !== card.possessive)
    .map(([, possForms]) => possForms[answerGender]);

  return limitedOptions([...samePossessiveOtherGenders, ...sameGenderOtherPossessives], card.answer, count);
}

function buildPossessiveAgreementTasks(cards, params) {
  const optionCount = getOptionCount(params);
  return shuffle(
    cards
      .filter((card) => card.skill === "possessive_agreement")
      .map((card) => ({
        type: "possessive_agreement",
        card,
        options: buildPossessiveOptions(card, optionCount),
      }))
  );
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  const modeType = mode?.type ?? mode?.id;
  if (modeType === "case_agreement") return buildCaseAgreementTasks(cards, params);
  if (modeType === "verb_number_agreement") return buildVerbNumberTasks(cards, params);
  if (modeType === "verb_gender_agreement") return buildVerbGenderTasks(cards, params);
  if (modeType === "numeral_agreement") return buildNumeralAgreementTasks(cards, params);
  if (modeType === "adjective_agreement") return buildAdjectiveAgreementTasks(cards, params);
  if (modeType === "possessive_agreement") return buildPossessiveAgreementTasks(cards, params);
  return [{ type: modeType }];
}
