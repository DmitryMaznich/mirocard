import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { ALL_CARDS } from "./word-agreement-content.mjs";
import { AVATAR_SVG, AVATAR_PATH, MODE_ICONS } from "./word-agreement-icons.mjs";

const TOPIC_ID   = "word_agreement_ru";
const VERSION    = "1.3.3";
const ZIP_PATH   = `public/decks/${TOPIC_ID}_v${VERSION}.zip`;
// Where generate-word-agreement-audio.mjs (Gemini TTS) writes synthesized
// .wav files. A card gets its `audio` field only if the file actually
// exists here — until then FillBlankTask falls back to browser TTS.
const AUDIO_SRC_DIR = `public/decks/_audio_src/${TOPIC_ID}`;

const PLACEHOLDER_MODES = [
  { id: "verb_gender_agreement",  title: "Род глагола в прошедшем времени (скоро)" },
  { id: "adjective_agreement",    title: "Прилагательное + существительное (скоро)" },
  { id: "numeral_agreement",      title: "Числительное + существительное (скоро)" },
  { id: "possessive_agreement",   title: "Притяжательные местоимения (скоро)" },
].map((m) => ({
  id: m.id,
  type: m.id,
  evaluation: "none",
  requirePin: false,
  ui: {
    title:       { ru: m.title },
    instruction: { ru: "Этот режим появится в одном из следующих обновлений" },
    icon:        MODE_ICONS[m.id].path,
  },
}));

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
        },
        includeAdvancedCards: {
          type: "boolean", label: { ru: "Сложные сюжеты" },
          hint: { ru: "Карточки со значением «думает о…»" }, default: false,
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
    },
    ...PLACEHOLDER_MODES,
  ],
  cards: ALL_CARDS.map((card) => {
    const audioSrcPath = `${AUDIO_SRC_DIR}/${card.id}.wav`;
    return existsSync(audioSrcPath) ? { ...card, audio: `audio/${card.id}.wav` } : card;
  }),
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
zip.file(AVATAR_PATH, AVATAR_SVG);
const seenIconPaths = new Set();
for (const { path, svg } of Object.values(MODE_ICONS)) {
  if (seenIconPaths.has(path)) continue; // coming_soon.svg is shared across 4 modes
  zip.file(path, svg);
  seenIconPaths.add(path);
}

let audioCount = 0;
for (const card of topic.cards) {
  if (!card.audio) continue;
  zip.file(card.audio, readFileSync(`${AUDIO_SRC_DIR}/${card.id}.wav`));
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
    ru: "Согласование слов и окончаний в предложениях. Падеж существительного (мяч, карандаш, машина, яблоко) и число глагола. Настраиваемая сложность: от двух вариантов ответа.",
  },
  renderer: "word_agreement",
  status:   "release",
  access:   "free",
};
if (idx >= 0) { catalog.decks[idx] = entry; } else { catalog.decks.push(entry); }
writeFileSync("public/decks/catalog.json", JSON.stringify(catalog, null, 2));
console.log("✓ catalog.json updated");
