// Shared content for the "Языковой тренажёр" (word_agreement) topic.
// Used by both build-word-agreement-deck.mjs (packages the deck) and
// generate-word-agreement-audio.mjs (synthesizes one .wav per card's full
// sentence via Gemini TTS). Keeping the sentences in one place avoids the
// two scripts drifting apart.

// Full spoken text for a card (context + sentence with the blank filled in)
// — matches FillBlankTask's fillSentence() at runtime. Used both for the
// summary screen's mistake list and as the text fed to TTS synthesis, so it
// must include the context line or generated audio would skip it.
function fullLabel(card) {
  const sentence = card.sentence.replace("{blank}", card.answer);
  return card.context ? `${card.context} ${sentence}` : sentence;
}

// Four lexical sets for the case_agreement mode. Each card targets a form
// that's actually distinct from a form already covered elsewhere in the same
// set — for inanimate masc./neuter nouns (мяч, карандаш, яблоко) accusative
// is spelled identically to nominative, so no separate accusative card is
// needed there; машина (fem.) gets one, since its accusative genuinely
// differs from nominative (машина → машину).
// See src/topics/renderers/word_agreement/engine.js: FORMS_BY_WORD.
export const CASE_AGREEMENT_CARDS = [
  // Иван и мяч
  { id: "myach_01", word: "myach", sentence: "У Ивана один {blank}.",                                answer: "мяч",    optionSet: "singular" },
  { id: "myach_02", word: "myach", context: "Иван потерял мяч.",   sentence: "Теперь у него нет {blank}.",   answer: "мяча",   optionSet: "singular", marker: "нет" },
  { id: "myach_03", word: "myach", sentence: "Иван хотел играть во дворе, но пришёл без {blank}.",               answer: "мяча",   optionSet: "singular", marker: "без" },
  { id: "myach_04", word: "myach", context: "На полу лежит мяч.", sentence: "Иван подошёл к {blank}.",      answer: "мячу",   optionSet: "singular", marker: "к" },
  { id: "myach_05", word: "myach", context: "Иван вышел во двор.", sentence: "Он играет с {blank}.",        answer: "мячом",  optionSet: "singular", marker: "с" },
  { id: "myach_06", word: "myach", context: "Иван посмотрел на мяч.", sentence: "На {blank} было пятно.",   answer: "мяче",   optionSet: "singular", marker: "на" },
  { id: "myach_07", word: "myach", sentence: "Папа купил Ивану новые {blank}.",                       answer: "мячи",   optionSet: "plural" },
  { id: "myach_08", word: "myach", sentence: "У Ивана много {blank}.",                                answer: "мячей",  optionSet: "plural", marker: "много" },
  { id: "myach_09", word: "myach", context: "Во дворе лежат мячи.", sentence: "Иван подошёл к {blank}, чтобы выбрать один.",      answer: "мячам",  optionSet: "plural", marker: "к" },
  { id: "myach_10", word: "myach", context: "В коробке лежат мячи.", sentence: "Иван играет с {blank}.",    answer: "мячами", optionSet: "plural", marker: "с" },
  { id: "myach_11", word: "myach", context: "В комнате лежат разные мячи.", sentence: "Иван думает о {blank}.", answer: "мячах", optionSet: "plural", marker: "о", difficulty: "advanced" },

  // Алина и карандаш
  { id: "karandash_01", word: "karandash", sentence: "У Алины один {blank}.",                              answer: "карандаш",    optionSet: "singular" },
  { id: "karandash_02", word: "karandash", context: "Алина потеряла карандаш.", sentence: "Теперь у неё нет {blank}.", answer: "карандаша",   optionSet: "singular", marker: "нет" },
  { id: "karandash_03", word: "karandash", sentence: "Алина пришла в школу без своего {blank}.",           answer: "карандаша",   optionSet: "singular", marker: "без" },
  { id: "karandash_04", word: "karandash", sentence: "Папа приклеил к {blank} наклейку с именем Алины.", answer: "карандашу",   optionSet: "singular", marker: "к" },
  { id: "karandash_05", word: "karandash", context: "Алина села за стол.", sentence: "Она рисует {blank}.",         answer: "карандашом",  optionSet: "singular" },
  { id: "karandash_06", word: "karandash", context: "Алина посмотрела на карандаш.", sentence: "На {blank} было пятно.", answer: "карандаше", optionSet: "singular", marker: "на" },
  { id: "karandash_07", word: "karandash", sentence: "Папа купил Алине новые {blank}.",                    answer: "карандаши",   optionSet: "plural" },
  { id: "karandash_08", word: "karandash", sentence: "У Алины много {blank}.",                             answer: "карандашей",  optionSet: "plural", marker: "много" },
  { id: "karandash_09", word: "karandash", sentence: "Папа приклеил к {blank} наклейки с именами.", answer: "карандашам",  optionSet: "plural", marker: "к" },
  { id: "karandash_10", word: "karandash", context: "В коробке лежат карандаши.", sentence: "Алина рисует {blank}.",   answer: "карандашами", optionSet: "plural" },
  { id: "karandash_11", word: "karandash", context: "В шкафу лежат разные карандаши.", sentence: "Алина думает о {blank}.", answer: "карандашах", optionSet: "plural", marker: "о", difficulty: "advanced" },

  // Папа, Иван и машина (настоящая машина, не игрушка)
  { id: "mashina_01", word: "mashina", sentence: "У папы одна {blank}.",                                answer: "машина",   optionSet: "singular" },
  { id: "mashina_02", word: "mashina", sentence: "Папа моет свою {blank}.",                             answer: "машину",   optionSet: "singular" },
  { id: "mashina_03", word: "mashina", context: "Папа отвёз машину в ремонт.", sentence: "Сегодня он без {blank}.", answer: "машины", optionSet: "singular", marker: "без" },
  { id: "mashina_04", word: "mashina", sentence: "Папа пошёл на работу пешком, без своей {blank}.",     answer: "машины",   optionSet: "singular", marker: "без" },
  { id: "mashina_05", word: "mashina", context: "Машина стоит во дворе.", sentence: "Папа подошёл к {blank}.", answer: "машине",   optionSet: "singular", marker: "к" },
  { id: "mashina_06", word: "mashina", context: "Папа едет на работу.", sentence: "Он едет на {blank}.",      answer: "машине",   optionSet: "singular", marker: "на" },
  { id: "mashina_07", word: "mashina", context: "Папа купил новую машину.", sentence: "Иван стоит рядом с {blank}.", answer: "машиной", optionSet: "singular", marker: "с" },
  { id: "mashina_08", word: "mashina", sentence: "Во дворе стоят разные {blank}.",                      answer: "машины",   optionSet: "plural" },
  { id: "mashina_09", word: "mashina", sentence: "На парковке много {blank}.",                          answer: "машин",    optionSet: "plural", marker: "много" },
  { id: "mashina_10", word: "mashina", context: "На парковке стоят машины.", sentence: "Папа идёт к {blank}, чтобы найти свою.", answer: "машинам", optionSet: "plural", marker: "к" },
  { id: "mashina_11", word: "mashina", sentence: "Папа паркуется рядом с другими {blank}.",             answer: "машинами", optionSet: "plural", marker: "с" },
  { id: "mashina_12", word: "mashina", context: "Иван любит машины.", sentence: "Он думает о {blank}.", answer: "машинах",  optionSet: "plural", marker: "о", difficulty: "advanced" },

  // Мама, папа и яблоко
  { id: "yabloko_01", word: "yabloko", sentence: "У папы одно {blank}.",                               answer: "яблоко",   optionSet: "singular" },
  { id: "yabloko_02", word: "yabloko", context: "Папа уронил яблоко.", sentence: "Теперь у него нет {blank}.", answer: "яблока",   optionSet: "singular", marker: "нет" },
  { id: "yabloko_03", word: "yabloko", sentence: "Иван пришёл в школу без своего {blank}.",             answer: "яблока",   optionSet: "singular", marker: "без" },
  { id: "yabloko_04", word: "yabloko", context: "На столе лежит яблоко.", sentence: "Папа потянулся к {blank}.", answer: "яблоку",   optionSet: "singular", marker: "к" },
  { id: "yabloko_05", word: "yabloko", sentence: "Мама угостила папу {blank}.",      answer: "яблоком",  optionSet: "singular" },
  { id: "yabloko_06", word: "yabloko", context: "Мама посмотрела на яблоко.", sentence: "На {blank} было пятно.", answer: "яблоке", optionSet: "singular", marker: "на" },
  { id: "yabloko_07", word: "yabloko", sentence: "Мама купила детям {blank}.",                   answer: "яблоки",   optionSet: "plural" },
  { id: "yabloko_08", word: "yabloko", sentence: "У мамы много {blank}.",                              answer: "яблок",    optionSet: "plural", marker: "много" },
  { id: "yabloko_09", word: "yabloko", context: "В корзине лежат яблоки.", sentence: "Папа потянулся к {blank}, чтобы взять два.", answer: "яблокам",  optionSet: "plural", marker: "к" },
  { id: "yabloko_10", word: "yabloko", sentence: "Мама испекла пирог с {blank}.", answer: "яблоками", optionSet: "plural", marker: "с" },
  { id: "yabloko_11", word: "yabloko", context: "В саду растут разные яблоки.", sentence: "Мама думает о {blank}.", answer: "яблоках", optionSet: "plural", marker: "о", difficulty: "advanced" },
].map((c) => ({
  ...c,
  skill:   "case_agreement",
  context: c.context ?? null,
  marker:  c.marker ?? null,
  label:   fullLabel(c),
}));

// verb_number_agreement: subject noun is already spelled out in the
// sentence (singular or plural) — the child looks at it and picks the
// matching verb form. Each pair below expands into two cards (singular
// subject / plural subject); the marker highlighted after 2 wrong attempts
// is the subject itself, drawing attention to its ending.
const VERB_NUMBER_PAIRS = [
  // Предметы
  { word: "Мяч",      wordPl: "Мячи",      place: "на полу",      verb: "lezhat",   sing: "лежит",   pl: "лежат" },
  { word: "Мяч",      wordPl: "Мячи",      place: "по двору",     verb: "katitsya", sing: "катится", pl: "катятся" },
  { word: "Мяч",      wordPl: "Мячи",      place: "с полки",      verb: "padat",    sing: "падает",  pl: "падают" },
  { word: "Карандаш", wordPl: "Карандаши", place: "в коробке",    verb: "lezhat",   sing: "лежит",   pl: "лежат" },
  { word: "Карандаш", wordPl: "Карандаши", place: "со стола",     verb: "padat",    sing: "падает",  pl: "падают" },
  { word: "Машина",   wordPl: "Машины",    place: "во дворе",     verb: "stoyat",   sing: "стоит",   pl: "стоят" },
  { word: "Машина",   wordPl: "Машины",    place: "по дороге",    verb: "ekhat",    sing: "едет",    pl: "едут" },
  { word: "Яблоко",   wordPl: "Яблоки",    place: "в корзине",    verb: "lezhat",   sing: "лежит",   pl: "лежат" },
  { word: "Яблоко",   wordPl: "Яблоки",    place: "на дереве",    verb: "viset",    sing: "висит",   pl: "висят" },
  { word: "Яблоко",   wordPl: "Яблоки",    place: "с дерева",     verb: "padat",    sing: "падает",  pl: "падают" },
  // Люди (собирательное множественное — «дети», «родители»)
  { word: "Иван",  wordPl: "Дети",     place: "во дворе",  verb: "igrat",   sing: "играет", pl: "играют" },
  { word: "Алина", wordPl: "Дети",     place: "за столом", verb: "risovat", sing: "рисует", pl: "рисуют" },
  { word: "Мама",  wordPl: "Родители", place: "домой",     verb: "idti",    sing: "идёт",   pl: "идут" },
  { word: "Папа",  wordPl: "Родители", place: "в парке",   verb: "gulyat",  sing: "гуляет", pl: "гуляют" },
];

export const VERB_NUMBER_CARDS = VERB_NUMBER_PAIRS.flatMap((p, i) => {
  const n = String(i + 1).padStart(2, "0");
  return [
    {
      id: `verbnum_${n}_sing`, skill: "verb_number_agreement", verb: p.verb,
      sentence: `${p.word} {blank} ${p.place}.`, answer: p.sing, marker: p.word,
    },
    {
      id: `verbnum_${n}_pl`, skill: "verb_number_agreement", verb: p.verb,
      sentence: `${p.wordPl} {blank} ${p.place}.`, answer: p.pl, marker: p.wordPl,
    },
  ];
}).map((c) => ({
  ...c,
  context: null,
  label: fullLabel(c),
}));

// verb_gender_agreement: past-tense verbs agree with the subject's gender
// (and have a separate plural form). Six verbs across the established
// vocabulary (Иван/Алина/мама/папа/дети, мяч, карандаш, машина, яблоко)
// give 15 cards balanced across masc/fem/neut/plural (4/4/3/4) — neuter is
// one card lighter than the rest because яблоко is the only neuter noun in
// the vocabulary so far; a second neuter word would be needed to close it.
const VERB_GENDER_ITEMS = [
  { id: "verbgen_01", verb: "poyti",      subject: "Иван",         rest: "в школу",     answer: "пошёл" },
  { id: "verbgen_02", verb: "poyti",      subject: "Алина",        rest: "в школу",     answer: "пошла" },
  { id: "verbgen_03", verb: "poyti",      subject: "Мама и папа",  rest: "гулять",      answer: "пошли" },
  { id: "verbgen_04", verb: "priti",      subject: "Папа",         rest: "с работы",    answer: "пришёл" },
  { id: "verbgen_05", verb: "priti",      subject: "Мама",         rest: "с работы",    answer: "пришла" },
  { id: "verbgen_06", verb: "priti",      subject: "Дети",         rest: "из школы",    answer: "пришли" },
  { id: "verbgen_07", verb: "upast",      subject: "Мяч",          rest: "со стола",    answer: "упал" },
  // 08/10/12/15 use stative verbs (лежать/стоять), which read equally
  // naturally in present tense ("лежит"/"стоит") without any cue — unlike
  // the one-time events above (пошёл/упал/...), past tense here isn't
  // self-evident, so a "Вчера" anchor makes it explicit.
  { id: "verbgen_08", verb: "lezhat",     subject: "Карандаш",     rest: "на столе",    answer: "лежал",       lead: "Вчера" },
  { id: "verbgen_09", verb: "upast",      subject: "Алина",        rest: "на льду",     answer: "упала" },
  { id: "verbgen_10", verb: "stoyat",     subject: "Машина",       rest: "в гараже",    answer: "стояла",      lead: "Вчера" },
  { id: "verbgen_11", verb: "upast",      subject: "Яблоко",       rest: "с дерева",    answer: "упало" },
  { id: "verbgen_12", verb: "lezhat",     subject: "Яблоко",       rest: "в корзине",   answer: "лежало",      lead: "Вчера" },
  // покатилось implies an unstated cause (apples don't roll on their own) —
  // a one-line context supplies it instead of a temporal marker.
  { id: "verbgen_13", verb: "pokatitsya", subject: "Яблоко",       rest: "по столу",    answer: "покатилось", context: "Иван задел яблоко локтем." },
  { id: "verbgen_14", verb: "upast",      subject: "Карандаши",    rest: "со стола",    answer: "упали" },
  { id: "verbgen_15", verb: "lezhat",     subject: "Мячи",         rest: "в коробке",   answer: "лежали",      lead: "Вчера" },
];

export const VERB_GENDER_CARDS = VERB_GENDER_ITEMS.map((item) => {
  const leadSubject = item.lead ? item.subject.charAt(0).toLowerCase() + item.subject.slice(1) : item.subject;
  const sentence = item.lead
    ? `${item.lead} ${leadSubject} {blank} ${item.rest}.`
    : `${item.subject} {blank} ${item.rest}.`;
  return {
    id: item.id,
    skill: "verb_gender_agreement",
    verb: item.verb,
    sentence,
    answer: item.answer,
    marker: item.subject,
    context: item.context ?? null,
  };
}).map((c) => ({ ...c, label: fullLabel(c) }));

export const ALL_CARDS = [...CASE_AGREEMENT_CARDS, ...VERB_NUMBER_CARDS, ...VERB_GENDER_CARDS];
