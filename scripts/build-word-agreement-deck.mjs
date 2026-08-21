import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { ALL_CARDS } from "./word-agreement-content.mjs";
import { AVATAR_SVG, AVATAR_PATH, MODE_ICONS } from "./word-agreement-icons.mjs";

const TOPIC_ID   = "word_agreement_ru";
const VERSION    = "1.8.5";
const ZIP_PATH   = `public/decks/${TOPIC_ID}_v${VERSION}.zip`;
// Where generate-word-agreement-audio.mjs (Gemini TTS) writes synthesized
// .mp3 files. A card gets its `audio` field only if the file actually
// exists here — until then FillBlankTask falls back to browser TTS.
const AUDIO_SRC_DIR = `public/decks/_audio_src/${TOPIC_ID}`;

// Shared explanation for every mode's optionCount enum — same underlying
// idea everywhere (more options = more real distractor forms to rule out,
// so it's harder), just reused across all modes rather than restated.
const OPTION_COUNT_INFO = {
  ru: {
    text: "Чем больше вариантов ответа, тем больше похожих, но неправильных форм слова нужно исключить — сложнее угадать наугад, важнее по-настоящему знать окончание. Начните с меньшего числа и увеличивайте его, когда ребёнок отвечает уверенно.",
    tip: "Если ребёнок часто ошибается, не бойтесь вернуться к меньшему числу вариантов — это не откат назад, а нормальная часть тренировки.",
  },
};

const topic = {
  meta: {
    id:       TOPIC_ID,
    renderer: "word_agreement",
    version:  VERSION,
    title:    { ru: "Языковой тренажёр" },
    avatar:   AVATAR_PATH,
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
        icon:        MODE_ICONS.case_agreement.path,
      },
      params: {
        optionCount: {
          type: "enum", label: { ru: "Вариантов ответа" }, values: [2, 3, 4, 6],
          labels: { ru: { "2": "2 — начало", "3": "3", "4": "4", "6": "6 — уверенный уровень" } }, default: 2,
          info: OPTION_COUNT_INFO,
        },
        includeAdvancedCards: {
          type: "boolean", label: { ru: "Сложные сюжеты" },
          hint: { ru: "Карточки со значением «думает о…» — сложнее, чем обычные" }, default: false,
          info: {
            ru: {
              text: "Все остальные карточки этой темы — конкретные, физические ситуации («мяч лежит», «нет мяча», «подошёл к мячу»), где падеж подсказывает сам глагол или предлог. «Думает о...» — абстрактная конструкция: сначала нужно понять смысл «думать о чём-то», и только потом подобрать окончание. Это сложнее, поэтому по умолчанию выключено.",
              tip: "Включайте, когда ребёнок уверенно справляется с обычным набором карточек — как дополнительную, более сложную тренировку того же падежа.",
            },
          },
        },
      },
    },
    {
      id:          "verb_number_agreement",
      type:        "verb_number_agreement",
      evaluation:  "auto",
      requirePin:  false,
      ui: {
        title:       { ru: "Число глагола" },
        instruction: { ru: "Прочитай предложение и выбери форму глагола" },
        icon:        MODE_ICONS.verb_number_agreement.path,
      },
      params: {
        optionCount: {
          type: "enum", label: { ru: "Вариантов ответа" }, values: [2, 4, 6],
          labels: { ru: { "2": "2 — только число", "4": "4 — сложнее выбор", "6": "6 — все формы" } }, default: 2,
          info: OPTION_COUNT_INFO,
        },
      },
    },
    {
      id:          "verb_gender_agreement",
      type:        "verb_gender_agreement",
      evaluation:  "auto",
      requirePin:  false,
      ui: {
        title:       { ru: "Род глагола в прошедшем времени" },
        instruction: { ru: "Прочитай предложение и выбери верную форму глагола" },
        icon:        MODE_ICONS.verb_gender_agreement.path,
      },
      params: {
        // Capped at 4, not 6 like the other modes: distractors are strictly
        // this verb's other genders (masc/fem/neut/plural), so 4 is every
        // option that exists — offering "6" would silently render only 4.
        optionCount: {
          type: "enum", label: { ru: "Вариантов ответа" }, values: [2, 3, 4],
          labels: { ru: { "2": "2 — начало", "3": "3", "4": "4 — уверенный уровень" } }, default: 2,
          info: OPTION_COUNT_INFO,
        },
      },
    },
    {
      id:          "numeral_agreement",
      type:        "numeral_agreement",
      evaluation:  "auto",
      requirePin:  false,
      ui: {
        title:       { ru: "Числительное + существительное" },
        instruction: { ru: "Прочитай предложение и выбери верное слово" },
        icon:        MODE_ICONS.numeral_agreement.path,
      },
      params: {
        optionCount: {
          type: "enum", label: { ru: "Вариантов ответа" }, values: [2, 3, 4, 6],
          labels: { ru: { "2": "2 — начало", "3": "3", "4": "4", "6": "6 — уверенный уровень" } }, default: 2,
          info: OPTION_COUNT_INFO,
        },
      },
    },
    {
      id:          "adjective_agreement",
      type:        "adjective_agreement",
      evaluation:  "auto",
      requirePin:  false,
      ui: {
        title:       { ru: "Прилагательное + существительное" },
        instruction: { ru: "Прочитай предложение и выбери верное слово" },
        icon:        MODE_ICONS.adjective_agreement.path,
      },
      params: {
        // Capped at 4, not 6, same reason as verb_gender_agreement:
        // distractors are strictly this adjective's other genders
        // (masc/fem/neut/plural), so 4 is every option that exists.
        optionCount: {
          type: "enum", label: { ru: "Вариантов ответа" }, values: [2, 3, 4],
          labels: { ru: { "2": "2 — начало", "3": "3", "4": "4 — уверенный уровень" } }, default: 2,
          info: OPTION_COUNT_INFO,
        },
      },
    },
    {
      id:          "possessive_agreement",
      type:        "possessive_agreement",
      evaluation:  "auto",
      requirePin:  false,
      ui: {
        title:       { ru: "Притяжательные местоимения" },
        instruction: { ru: "Прочитай предложение и выбери верное слово" },
        icon:        MODE_ICONS.possessive_agreement.path,
      },
      params: {
        optionCount: {
          type: "enum", label: { ru: "Вариантов ответа" }, values: [2, 3, 4, 6],
          labels: { ru: { "2": "2 — начало", "3": "3", "4": "4", "6": "6 — уверенный уровень" } }, default: 2,
          info: OPTION_COUNT_INFO,
        },
      },
    },
  ],
  cards: ALL_CARDS.map((card) => {
    const audioSrcPath = `${AUDIO_SRC_DIR}/${card.id}.mp3`;
    return existsSync(audioSrcPath) ? { ...card, audio: `audio/${card.id}.mp3` } : card;
  }),
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
zip.file(AVATAR_PATH, AVATAR_SVG);
const seenIconPaths = new Set();
for (const { path, svg } of Object.values(MODE_ICONS)) {
  if (seenIconPaths.has(path)) continue; // guards against two modes sharing one icon path
  zip.file(path, svg);
  seenIconPaths.add(path);
}

let audioCount = 0;
for (const card of topic.cards) {
  if (!card.audio) continue;
  zip.file(card.audio, readFileSync(`${AUDIO_SRC_DIR}/${card.id}.mp3`));
  audioCount += 1;
}

const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024).toFixed(1)} KB, ${topic.cards.length} cards, ${audioCount} with audio)`);

const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf-8"));
const idx = catalog.decks.findIndex((d) => d.id === TOPIC_ID);
const entry = {
  id:       TOPIC_ID,
  version:  VERSION,
  url:      `./decks/${TOPIC_ID}_v${VERSION}.zip`,
  zipUrl:   `${TOPIC_ID}_v${VERSION}.zip`,
  title:    { ru: "Языковой тренажёр" },
  description: {
    ru: "Согласование слов и окончаний в предложениях. Падеж существительного (мяч, карандаш, стол, машина, книга, кукла, яблоко, окно, яйцо), число и род глагола, числительное, прилагательное и притяжательные местоимения + существительное. Настраиваемая сложность: от двух до шести вариантов ответа.",
  },
  renderer: "word_agreement",
  status:   "release",
  access:   "free",
};
if (idx >= 0) { catalog.decks[idx] = entry; } else { catalog.decks.push(entry); }
writeFileSync("public/decks/catalog.json", JSON.stringify(catalog, null, 2));
console.log("✓ catalog.json updated");
