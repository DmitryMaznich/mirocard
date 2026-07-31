import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";

const TOPIC_ID = "word_agreement_ru";
const VERSION  = "1.0.0";
const ZIP_PATH = `public/decks/${TOPIC_ID}_v${VERSION}.zip`;

// "Иван и мяч" — lexical set for the case_agreement mode prototype.
// Cards 1-13 use the singular option pool, 14-20 use the plural pool
// (see src/topics/renderers/word_agreement/engine.js: OPTION_SETS).
const CARDS = [
  { id: "01", sentence: "У Ивана один {blank}.",                                    answer: "мяч",     optionSet: "singular" },
  { id: "02", sentence: "Иван нашёл свой {blank}.",                                  answer: "мяч",     optionSet: "singular" },
  { id: "03", sentence: "Иван держит в руках {blank}.",                              answer: "мяч",     optionSet: "singular" },
  { id: "04", context: "Иван потерял мяч.",       sentence: "Теперь у него нет {blank}.",       answer: "мяча",    optionSet: "singular", marker: "нет" },
  { id: "05", context: "Мяч укатился.",           sentence: "Иван ищет {blank}.",                answer: "мяч",     optionSet: "singular" },
  { id: "06", sentence: "Иван пришёл во двор без {blank}.",                          answer: "мяча",    optionSet: "singular", marker: "без" },
  { id: "07", context: "На полу лежит мяч.",      sentence: "Иван подошёл к {blank}.",           answer: "мячу",    optionSet: "singular", marker: "к" },
  { id: "08", context: "Мяч лежал рядом.",        sentence: "Иван прикоснулся к {blank}.",       answer: "мячу",    optionSet: "singular", marker: "к" },
  { id: "09", context: "Иван вышел во двор.",     sentence: "Он играет с {blank}.",              answer: "мячом",   optionSet: "singular", marker: "с" },
  { id: "10", context: "Иван сел на ковёр.",      sentence: "Он катает {blank}.",                answer: "мяч",     optionSet: "singular" },
  { id: "11", context: "Мяч лежит перед Иваном.", sentence: "Иван ударил по {blank}.",           answer: "мячу",    optionSet: "singular", marker: "по" },
  { id: "12", context: "Иван хочет играть.",      sentence: "Он думает о {blank}.",              answer: "мяче",    optionSet: "singular", marker: "о" },
  { id: "13", context: "Иван посмотрел на мяч.",  sentence: "На {blank} было пятно.",            answer: "мяче",    optionSet: "singular", marker: "на" },
  { id: "14", sentence: "Папа купил Ивану новые {blank}.",                           answer: "мячи",    optionSet: "plural" },
  { id: "15", sentence: "У Ивана много {blank}.",                                    answer: "мячей",   optionSet: "plural", marker: "много" },
  { id: "16", sentence: "В коробке лежит пять {blank}.",                             answer: "мячей",   optionSet: "plural" },
  { id: "17", context: "В углу лежат мячи.",      sentence: "Иван подошёл к {blank}.",           answer: "мячам",   optionSet: "plural", marker: "к" },
  { id: "18", context: "В коробке лежат мячи.",   sentence: "Иван играет с {blank}.",            answer: "мячами",  optionSet: "plural", marker: "с" },
  { id: "19", context: "На полу лежат красные мячи.", sentence: "Иван видит красные {blank}.",   answer: "мячи",    optionSet: "plural" },
  { id: "20", context: "В комнате лежат разные мячи.", sentence: "Иван рассказывает о {blank}.", answer: "мячах",   optionSet: "plural", marker: "о" },
].map((c) => ({
  ...c,
  context: c.context ?? null,
  marker:  c.marker ?? null,
  label:   c.sentence.replace("{blank}", c.answer),
}));

const PLACEHOLDER_MODES = [
  { id: "verb_number_agreement",  title: "Число глагола (скоро)" },
  { id: "verb_gender_agreement",  title: "Род глагола в прошедшем времени (скоро)" },
  { id: "adjective_agreement",    title: "Прилагательное + существительное (скоро)" },
  { id: "numeral_agreement",      title: "Числительное + существительное (скоро)" },
  { id: "possessive_agreement",   title: "Притяжательные местоимения (скоро)" },
].map((m) => ({
  id: m.id,
  type: m.id,
  evaluation: "none",
  requirePin: false,
  ui: { title: { ru: m.title }, instruction: { ru: "Этот режим появится в одном из следующих обновлений" } },
}));

const topic = {
  meta: {
    id:       TOPIC_ID,
    renderer: "word_agreement",
    version:  VERSION,
    title:    { ru: "Языковой тренажёр" },
    about: {
      description: {
        ru: "Закрепляем согласование слов и окончаний в предложениях: ребёнок читает короткий текст с пропуском и выбирает верную форму слова по смыслу, без падежных терминов и правил.",
      },
    },
    language: "ru",
  },
  modes: [
    {
      id:          "case_agreement",
      type:        "case_agreement",
      evaluation:  "auto",
      requirePin:  false,
      ui: {
        title:       { ru: "Падеж существительного" },
        instruction: { ru: "Прочитай предложение и выбери верное слово" },
      },
    },
    ...PLACEHOLDER_MODES,
  ],
  cards: CARDS,
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));

const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024).toFixed(1)} KB)`);

const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf-8"));
const idx = catalog.decks.findIndex((d) => d.id === TOPIC_ID);
const entry = {
  id:       TOPIC_ID,
  version:  VERSION,
  url:      `./decks/${TOPIC_ID}_v${VERSION}.zip`,
  zipUrl:   `${TOPIC_ID}_v${VERSION}.zip`,
  title:    { ru: "Языковой тренажёр" },
  description: {
    ru: "Согласование слов и окончаний в предложениях. Первый режим: падеж существительного (набор «Иван и мяч»). Остальные режимы — скоро.",
  },
  renderer: "word_agreement",
  status:   "release",
  access:   "free",
};
if (idx >= 0) { catalog.decks[idx] = entry; } else { catalog.decks.push(entry); }
writeFileSync("public/decks/catalog.json", JSON.stringify(catalog, null, 2));
console.log("✓ catalog.json updated");
