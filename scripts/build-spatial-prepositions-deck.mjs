import JSZip from "jszip";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ALL_CARDS } from "./spatial-prepositions-content.mjs";

const TOPIC_ID = "spatial_prepositions_ru";
const VERSION = "0.8.0";
const ZIP_PATH = `public/decks/${TOPIC_ID}_v${VERSION}.zip`;
const ASSET_DIR = "public/decks/_assets/spatial_prepositions";
const AUDIO_DIR = "public/decks/_audio_src/spatial_prepositions_ru";
const AVATAR_PATH = "media/avatar.svg";

const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
  <rect width="128" height="128" rx="32" fill="#E7F2E9"/>
  <path d="M23 92h82M38 91V53h52v38M31 53h66" stroke="#2E8A63" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="64" cy="37" r="13" fill="#E9534F"/>
</svg>`;

const MODE_ICONS = {
  introduction: {
    path: "media/mode_introduction.svg",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="32" fill="#E7F2E9"/>
      <path d="M29 92h70M40 91V62h46v29M34 62h58" stroke="#2E8A63" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="61" cy="47" r="15" fill="#E9534F"/>
      <path d="m75 66 9 9 18-21" stroke="#4A79D9" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  recognize: {
    path: "media/mode_recognize.svg",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="32" fill="#EDF3FC"/>
      <path d="M23 58s15-22 41-22 41 22 41 22-15 22-41 22S23 58 23 58Z" fill="#fff" stroke="#4A79D9" stroke-width="7" stroke-linejoin="round"/>
      <circle cx="64" cy="58" r="12" fill="#2E8A63"/>
      <path d="M39 98h50" stroke="#8BA7E8" stroke-width="8" stroke-linecap="round"/>
      <path d="m54 98 7 7 14-16" stroke="#2E8A63" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  respond: {
    path: "media/mode_respond.svg",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="32" fill="#FFF3E4"/>
      <path d="M27 34h74v48H66l-19 15V82H27V34Z" fill="#fff" stroke="#D98535" stroke-width="7" stroke-linejoin="round"/>
      <path d="M47 53h34M47 68h22" stroke="#D98535" stroke-width="7" stroke-linecap="round"/>
      <path d="M92 91c4 3 7 7 7 12M99 86c7 5 11 11 11 18" stroke="#2E8A63" stroke-width="6" stroke-linecap="round"/>
    </svg>`,
  },
  transfer: {
    path: "media/mode_transfer.svg",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="32" fill="#F2ECFB"/>
      <rect x="27" y="35" width="47" height="57" rx="8" fill="#fff" stroke="#8061B8" stroke-width="7"/>
      <circle cx="42" cy="51" r="6" fill="#E9B850"/>
      <path d="m34 82 12-14 9 9 8-8 8 13" stroke="#8061B8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M78 62h21m-8-9 9 9-9 9" stroke="#2E8A63" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
};

const RELATIONS_PARAM = {
  type: "enum_multi",
  label: { ru: "Предлоги" },
  values: ["spatial_in", "spatial_near", "spatial_on", "spatial_under"],
  labels: { ru: { spatial_in: "В", spatial_near: "Рядом с", spatial_on: "На", spatial_under: "Под" } },
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
        icon: MODE_ICONS.introduction.path,
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
        icon: MODE_ICONS.recognize.path,
      },
      params: {
        relations: RELATIONS_PARAM,
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
        icon: MODE_ICONS.respond.path,
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
        icon: MODE_ICONS.transfer.path,
      },
      params: {
        relations: RELATIONS_PARAM,
      },
    },
  ],
  cards: ALL_CARDS,
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
zip.file(AVATAR_PATH, AVATAR_SVG);
for (const modeIcon of Object.values(MODE_ICONS)) zip.file(modeIcon.path, modeIcon.svg);

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
    ru: "Пространственные отношения «в», «рядом с», «на» и «под»: знакомство, выбор фотографии и ответ с паузой. В каждом режиме можно выбрать одно или несколько отношений.",
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
