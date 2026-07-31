import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";

const TOPIC_ID = "word_agreement_ru";
const VERSION  = "1.1.0";
const ZIP_PATH = `public/decks/${TOPIC_ID}_v${VERSION}.zip`;

// Four lexical sets for the case_agreement mode. Each card targets a form
// that's actually distinct from a form already covered elsewhere in the same
// set — for inanimate masc./neuter nouns (мяч, карандаш, яблоко) accusative
// is spelled identically to nominative, so no separate accusative card is
// needed there; машинка (fem.) gets one, since its accusative genuinely
// differs from nominative (машинка → машинку).
// See src/topics/renderers/word_agreement/engine.js: FORMS_BY_WORD.
const CARDS = [
  // Иван и мяч
  { id: "myach_01", word: "myach", sentence: "У Ивана один {blank}.",                                answer: "мяч",    optionSet: "singular" },
  { id: "myach_02", word: "myach", context: "Иван потерял мяч.",   sentence: "Теперь у него нет {blank}.",   answer: "мяча",   optionSet: "singular", marker: "нет" },
  { id: "myach_03", word: "myach", sentence: "Иван пришёл во двор без {blank}.",                      answer: "мяча",   optionSet: "singular", marker: "без" },
  { id: "myach_04", word: "myach", context: "На полу лежит мяч.", sentence: "Иван подошёл к {blank}.",      answer: "мячу",   optionSet: "singular", marker: "к" },
  { id: "myach_05", word: "myach", context: "Иван вышел во двор.", sentence: "Он играет с {blank}.",        answer: "мячом",  optionSet: "singular", marker: "с" },
  { id: "myach_06", word: "myach", context: "Иван посмотрел на мяч.", sentence: "На {blank} было пятно.",   answer: "мяче",   optionSet: "singular", marker: "на" },
  { id: "myach_07", word: "myach", sentence: "Папа купил Ивану новые {blank}.",                       answer: "мячи",   optionSet: "plural" },
  { id: "myach_08", word: "myach", sentence: "У Ивана много {blank}.",                                answer: "мячей",  optionSet: "plural", marker: "много" },
  { id: "myach_09", word: "myach", context: "В углу лежат мячи.", sentence: "Иван подошёл к {blank}.",      answer: "мячам",  optionSet: "plural", marker: "к" },
  { id: "myach_10", word: "myach", context: "В коробке лежат мячи.", sentence: "Иван играет с {blank}.",    answer: "мячами", optionSet: "plural", marker: "с" },
  { id: "myach_11", word: "myach", context: "В комнате лежат разные мячи.", sentence: "Иван рассказывает о {blank}.", answer: "мячах", optionSet: "plural", marker: "о" },

  // Алина и карандаш
  { id: "karandash_01", word: "karandash", sentence: "У Алины один {blank}.",                              answer: "карандаш",    optionSet: "singular" },
  { id: "karandash_02", word: "karandash", context: "Алина потеряла карандаш.", sentence: "Теперь у неё нет {blank}.", answer: "карандаша",   optionSet: "singular", marker: "нет" },
  { id: "karandash_03", word: "karandash", sentence: "Алина пришла в школу без {blank}.",                  answer: "карандаша",   optionSet: "singular", marker: "без" },
  { id: "karandash_04", word: "karandash", context: "На столе лежит карандаш.", sentence: "Алина подошла к {blank}.", answer: "карандашу",   optionSet: "singular", marker: "к" },
  { id: "karandash_05", word: "karandash", context: "Алина села за стол.", sentence: "Она рисует {blank}.",         answer: "карандашом",  optionSet: "singular" },
  { id: "karandash_06", word: "karandash", context: "Алина посмотрела на карандаш.", sentence: "На {blank} было пятно.", answer: "карандаше", optionSet: "singular", marker: "на" },
  { id: "karandash_07", word: "karandash", sentence: "Папа купил Алине новые {blank}.",                    answer: "карандаши",   optionSet: "plural" },
  { id: "karandash_08", word: "karandash", sentence: "У Алины много {blank}.",                             answer: "карандашей",  optionSet: "plural", marker: "много" },
  { id: "karandash_09", word: "karandash", context: "В коробке лежат карандаши.", sentence: "Алина подошла к {blank}.", answer: "карандашам",  optionSet: "plural", marker: "к" },
  { id: "karandash_10", word: "karandash", context: "В коробке лежат карандаши.", sentence: "Алина рисует {blank}.",   answer: "карандашами", optionSet: "plural" },
  { id: "karandash_11", word: "karandash", context: "В шкафу лежат разные карандаши.", sentence: "Алина рассказывает о {blank}.", answer: "карандашах", optionSet: "plural", marker: "о" },

  // Иван и машинка
  { id: "mashinka_01", word: "mashinka", sentence: "У Ивана одна {blank}.",                             answer: "машинка",    optionSet: "singular" },
  { id: "mashinka_02", word: "mashinka", sentence: "Иван нашёл свою {blank}.",                          answer: "машинку",    optionSet: "singular" },
  { id: "mashinka_03", word: "mashinka", context: "Иван потерял машинку.", sentence: "Теперь у него нет {blank}.", answer: "машинки", optionSet: "singular", marker: "нет" },
  { id: "mashinka_04", word: "mashinka", sentence: "Иван пришёл во двор без {blank}.",                  answer: "машинки",    optionSet: "singular", marker: "без" },
  { id: "mashinka_05", word: "mashinka", context: "На полу стоит машинка.", sentence: "Иван подошёл к {blank}.", answer: "машинке", optionSet: "singular", marker: "к" },
  { id: "mashinka_06", word: "mashinka", context: "Иван хочет играть.", sentence: "Он думает о {blank}.",       answer: "машинке",   optionSet: "singular", marker: "о" },
  { id: "mashinka_07", word: "mashinka", context: "Иван вышел во двор.", sentence: "Он играет с {blank}.",      answer: "машинкой",  optionSet: "singular", marker: "с" },
  { id: "mashinka_08", word: "mashinka", sentence: "Мама купила Ивану новые {blank}.",                  answer: "машинки",    optionSet: "plural" },
  { id: "mashinka_09", word: "mashinka", sentence: "У Ивана много {blank}.",                            answer: "машинок",    optionSet: "plural", marker: "много" },
  { id: "mashinka_10", word: "mashinka", context: "В углу стоят машинки.", sentence: "Иван подошёл к {blank}.", answer: "машинкам", optionSet: "plural", marker: "к" },
  { id: "mashinka_11", word: "mashinka", context: "В коробке лежат машинки.", sentence: "Иван играет с {blank}.", answer: "машинками", optionSet: "plural", marker: "с" },
  { id: "mashinka_12", word: "mashinka", context: "В комнате стоят разные машинки.", sentence: "Иван рассказывает о {blank}.", answer: "машинках", optionSet: "plural", marker: "о" },

  // Мама, папа и яблоко
  { id: "yabloko_01", word: "yabloko", sentence: "У папы одно {blank}.",                               answer: "яблоко",   optionSet: "singular" },
  { id: "yabloko_02", word: "yabloko", context: "Папа уронил яблоко.", sentence: "Теперь у него нет {blank}.", answer: "яблока",   optionSet: "singular", marker: "нет" },
  { id: "yabloko_03", word: "yabloko", sentence: "Мама пришла домой без {blank}.",                     answer: "яблока",   optionSet: "singular", marker: "без" },
  { id: "yabloko_04", word: "yabloko", context: "На столе лежит яблоко.", sentence: "Папа подошёл к {blank}.", answer: "яблоку",   optionSet: "singular", marker: "к" },
  { id: "yabloko_05", word: "yabloko", context: "Мама угощает всех.", sentence: "Она делится {blank}.",       answer: "яблоком",  optionSet: "singular" },
  { id: "yabloko_06", word: "yabloko", context: "Мама посмотрела на яблоко.", sentence: "На {blank} было пятно.", answer: "яблоке", optionSet: "singular", marker: "на" },
  { id: "yabloko_07", word: "yabloko", sentence: "Мама купила детям новые {blank}.",                   answer: "яблоки",   optionSet: "plural" },
  { id: "yabloko_08", word: "yabloko", sentence: "У мамы много {blank}.",                              answer: "яблок",    optionSet: "plural", marker: "много" },
  { id: "yabloko_09", word: "yabloko", context: "В корзине лежат яблоки.", sentence: "Папа подошёл к {blank}.", answer: "яблокам",  optionSet: "plural", marker: "к" },
  { id: "yabloko_10", word: "yabloko", context: "Мама испекла пирог.", sentence: "Пирог получился с {blank}.", answer: "яблоками", optionSet: "plural", marker: "с" },
  { id: "yabloko_11", word: "yabloko", context: "В саду растут разные яблоки.", sentence: "Мама рассказывает о {blank}.", answer: "яблоках", optionSet: "plural", marker: "о" },
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
    ru: "Согласование слов и окончаний в предложениях. Первый режим: падеж существительного (мяч, карандаш, машинка, яблоко). Остальные режимы — скоро.",
  },
  renderer: "word_agreement",
  status:   "release",
  access:   "free",
};
if (idx >= 0) { catalog.decks[idx] = entry; } else { catalog.decks.push(entry); }
writeFileSync("public/decks/catalog.json", JSON.stringify(catalog, null, 2));
console.log("✓ catalog.json updated");
