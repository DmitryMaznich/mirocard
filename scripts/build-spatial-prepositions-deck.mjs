import JSZip from "jszip";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ALL_CARDS } from "./spatial-prepositions-content.mjs";

const TOPIC_ID = "spatial_prepositions_ru";
const VERSION = "0.4.0";
const ZIP_PATH = `public/decks/${TOPIC_ID}_v${VERSION}.zip`;
const ASSET_DIR = "public/decks/_assets/spatial_prepositions";
const AUDIO_DIR = "public/decks/_audio_src/spatial_prepositions_ru";
const AVATAR_PATH = "media/avatar.svg";

const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
  <rect width="128" height="128" rx="32" fill="#E7F2E9"/>
  <path d="M23 92h82M38 91V53h52v38M31 53h66" stroke="#2E8A63" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="64" cy="37" r="13" fill="#E9534F"/>
</svg>`;

const RELATIONS_PARAM = {
  type: "enum_multi",
  label: { ru: "Предлоги" },
  values: ["spatial_in", "spatial_on", "spatial_under"],
  labels: { ru: { spatial_in: "В", spatial_on: "На", spatial_under: "Под" } },
  default: [],
  info: {
    ru: {
      text: "Оставьте «Все» или выберите один либо несколько предлогов. В выбранном наборе отношения чередуются.",
      tip: "Для знакомства обычно начинают с одного предлога, а затем добавляют уже знакомые отношения.",
    },
  },
};

const topic = {
  meta: {
    id: TOPIC_ID,
    renderer: "spatial_prepositions",
    version: VERSION,
    title: { ru: "Где предмет?" },
    avatar: AVATAR_PATH,
    language: "ru",
    about: {
      description: {
        ru: "Пространственные предлоги на спокойных фотореалистичных сценах. Сначала ребёнок знакомится с образцом, затем показывает отношение и отвечает с помощью взрослого.",
      },
    },
  },
  modes: [
    {
      id: "introduction",
      type: "spatial_introduction",
      evaluation: "none",
      loop: true,
      reshuffleOnLoop: true,
      hideConceptPicker: true,
      requirePin: false,
      ui: {
        title: { ru: "Знакомство" },
        instruction: { ru: "Посмотри и узнай" },
        icon: AVATAR_PATH,
      },
      params: {
        relations: RELATIONS_PARAM,
        modelTiming: {
          type: "enum",
          label: { ru: "Подача образца" },
          values: ["pause", "model_first"],
          labels: { ru: { pause: "Вопрос, затем ответ", model_first: "Сразу показать образец" } },
          default: "pause",
        },
      },
    },
    {
      id: "recognize",
      type: "spatial_recognize",
      evaluation: "auto",
      loop: true,
      reshuffleOnLoop: true,
      hideConceptPicker: true,
      requirePin: false,
      ui: {
        title: { ru: "Покажи" },
        instruction: { ru: "Слушай и покажи фотографию" },
        icon: AVATAR_PATH,
      },
      params: {
        relations: RELATIONS_PARAM,
        showInstructionText: {
          type: "boolean",
          label: { ru: "Показывать текст задания" },
          hint: { ru: "По умолчанию ребёнок слушает инструкцию и выбирает фотографию." },
          default: false,
        },
      },
    },
    {
      id: "respond",
      type: "spatial_respond",
      evaluation: "none",
      loop: true,
      reshuffleOnLoop: true,
      hideConceptPicker: true,
      requirePin: false,
      ui: {
        title: { ru: "Ответь" },
        instruction: { ru: "Дайте ребёнку паузу перед образцом" },
        icon: AVATAR_PATH,
      },
      params: {
        relations: RELATIONS_PARAM,
      },
    },
    {
      id: "transfer",
      type: "spatial_transfer",
      evaluation: "auto",
      loop: true,
      reshuffleOnLoop: true,
      hideConceptPicker: true,
      requirePin: false,
      ui: {
        title: { ru: "Новые картинки" },
        instruction: { ru: "Покажи отношение на новой фотографии" },
        icon: AVATAR_PATH,
      },
      params: {
        relations: RELATIONS_PARAM,
        showInstructionText: {
          type: "boolean",
          label: { ru: "Показывать текст задания" },
          default: false,
        },
      },
    },
  ],
  cards: ALL_CARDS,
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
zip.file(AVATAR_PATH, AVATAR_SVG);

const mediaPaths = new Set(ALL_CARDS.flatMap((card) => [
  card.image,
  card.contrastImage,
  card.questionAudio,
  card.modelAudio,
  card.recognizeAudio,
]));
for (const mediaPath of mediaPaths) {
  const fileName = mediaPath.split("/").at(-1);
  const sourcePath = mediaPath.startsWith("audio/")
    ? `${AUDIO_DIR}/${fileName}`
    : `${ASSET_DIR}/${fileName}`;
  if (!existsSync(sourcePath)) throw new Error(`Missing spatial prepositions asset: ${sourcePath}`);
  zip.file(mediaPath, readFileSync(sourcePath));
}

const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024 / 1024).toFixed(1)} MB, ${ALL_CARDS.length} cards, ${mediaPaths.size} media files)`);

const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf8"));
const entry = {
  id: TOPIC_ID,
  version: VERSION,
  url: `./decks/${TOPIC_ID}_v${VERSION}.zip`,
  zipUrl: `${TOPIC_ID}_v${VERSION}.zip`,
  title: { ru: "Где предмет?" },
  description: {
    ru: "Пространственные предлоги «в», «на» и «под»: знакомство, выбор фотографии и ответ с паузой. В каждом режиме можно выбрать один или несколько предлогов.",
  },
  renderer: "spatial_prepositions",
  status: "beta",
  access: "free",
};
const index = catalog.decks.findIndex((deck) => deck.id === TOPIC_ID);
if (index >= 0) catalog.decks[index] = entry;
else {
  const wordAgreementIndex = catalog.decks.findIndex((deck) => deck.id === "word_agreement_ru");
  catalog.decks.splice(wordAgreementIndex >= 0 ? wordAgreementIndex : catalog.decks.length, 0, entry);
}
writeFileSync("public/decks/catalog.json", `${JSON.stringify(catalog, null, 2)}\n`);
