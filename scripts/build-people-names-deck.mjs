import JSZip from "jszip";
import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TOPIC_PATH = "tools/people_names/topic.json";
const ASSET_DIR = "public/decks/_assets/people_names";
const CATALOG_PATH = "public/decks/catalog.json";
// Where generate-people-names-audio.mjs / generate-people-names-prompt-audio.mjs /
// generate-people-names-name-audio.mjs (Gemini TTS) write synthesized .mp3
// files. A card gets its `audio`/`promptAudio` field only if the file
// actually exists here - until then IntroTask/FindNTask fall back to
// browser TTS of speech/promptSpeech (see flashcards/index.jsx).
const AUDIO_SRC_DIR = "public/decks/_audio_src/people_names";

const AVATAR_PATH = "media/avatar.svg";
const AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none">
  <rect width="128" height="128" rx="32" fill="#EEF3F1"/>
  <circle cx="47" cy="47" r="15" fill="#D98258"/>
  <circle cx="82" cy="47" r="15" fill="#4C796B"/>
  <path d="M23 103c3-21 15-33 24-33s21 12 24 33M57 103c3-21 15-33 25-33s21 12 23 33" stroke="#263131" stroke-width="7" stroke-linecap="round"/>
  <path d="M34 34c5-8 19-11 26-2M69 33c7-8 19-5 25 2" stroke="#263131" stroke-width="6" stroke-linecap="round"/>
</svg>`;

const topic = JSON.parse(readFileSync(TOPIC_PATH, "utf8"));
const topicId = topic.meta.id;
const version = topic.meta.version;
const zipPath = `public/decks/${topicId}_v${version}.zip`;

if (existsSync(zipPath)) {
  throw new Error(`Refusing to overwrite an existing deck version: ${zipPath}`);
}

// Attach audio fields in-memory only - tools/people_names/topic.json stays
// the audio-free content source, same convention as build-word-agreement-deck.mjs.
let audioCount = 0;
const cardsWithAudio = topic.cards.map((card) => {
  const isNameWord = card.cardType === "name_word";
  // name_word cards have no card.speech (never rendered via IntroTask) - the
  // file at {id}.mp3 for them is the name_gender prompt, not a "speech"
  // line, so this must not double-attach it as card.audio too.
  const speechAudioPath = `${AUDIO_SRC_DIR}/${card.id}.mp3`;
  // name_word cards (the "Мужское или женское имя?" mode) each have their
  // own distinct recording keyed by card id (name_petya.mp3, name_olya.mp3,
  // ...) - every other card's promptAudio is shared per concept (every
  // photo/pictogram/illustration/probe card of e.g. "boy" all say the same
  // "Покажи мальчика."), keyed by conceptId so one recording covers all of
  // them.
  const promptAudioPath = isNameWord
    ? `${AUDIO_SRC_DIR}/${card.id}.mp3`
    : `${AUDIO_SRC_DIR}/prompt_${card.conceptId}.mp3`;
  const withAudio = {
    ...card,
    ...(!isNameWord && existsSync(speechAudioPath) && { audio: { ru: `audio/${card.id}.mp3` } }),
    ...(existsSync(promptAudioPath) && { promptAudio: { ru: `audio/${promptAudioPath.split("/").at(-1)}` } }),
  };
  if (withAudio.audio) audioCount += 1;
  if (withAudio.promptAudio) audioCount += 1;
  return withAudio;
});
topic.cards = cardsWithAudio;

// Fixed-phrase audio not tied to any single card: sort_by_attribute's one
// remaining instruction (the "category" grouping was cut as redundant with
// find_n) - attached to the mode object in-memory, same audio-free-source
// convention as the card fields above.
const sortAgeAudioPath = `${AUDIO_SRC_DIR}/sort_age.mp3`;
topic.modes = topic.modes.map((mode) => {
  if (mode.type === "sort_by_attribute" && existsSync(sortAgeAudioPath)) {
    audioCount += 1;
    return { ...mode, ui: { ...mode.ui, instructionAudio: { age: { ru: "audio/sort_age.mp3" } } } };
  }
  return mode;
});

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
zip.file(AVATAR_PATH, AVATAR_SVG);

for (const card of topic.cards) {
  // name_word cards are text-only (a name spoken as a prompt) - they have
  // no picture and no card.image to bundle.
  if (card.cardType !== "name_word") {
    const sourcePath = `${ASSET_DIR}/${card.id}.png`;
    if (!existsSync(sourcePath)) throw new Error(`Missing people-names image: ${sourcePath}`);
    const webp = await sharp(sourcePath)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, smartSubsample: true })
      .toBuffer();
    zip.file(card.image, webp);
  }

  for (const audioField of [card.audio, card.promptAudio]) {
    if (!audioField?.ru) continue;
    const fileName = audioField.ru.split("/").at(-1);
    zip.file(audioField.ru, readFileSync(`${AUDIO_SRC_DIR}/${fileName}`));
  }
}

for (const mode of topic.modes) {
  for (const audioField of [mode.promptAudio, mode.ui?.instructionAudio?.age]) {
    if (!audioField?.ru) continue;
    const fileName = audioField.ru.split("/").at(-1);
    zip.file(audioField.ru, readFileSync(`${AUDIO_SRC_DIR}/${fileName}`));
  }
}

const buffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});
writeFileSync(zipPath, buffer);

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
const entry = {
  id: topicId,
  version,
  url: `./decks/${topicId}_v${version}.zip`,
  zipUrl: `${topicId}_v${version}.zip`,
  title: topic.meta.title,
  description: {
    ru: "Мальчик, девочка, мужчина и женщина: узнавание людей, ребёнок / взрослый и различение мужских и женских имён на слух.",
  },
  renderer: "flashcards",
  status: "beta",
  access: "free",
};
const existingIndex = catalog.decks.findIndex((deck) => deck.id === topicId);
if (existingIndex >= 0) catalog.decks[existingIndex] = entry;
else {
  const emotionsIndex = catalog.decks.findIndex((deck) => deck.id === "emotions_v2");
  catalog.decks.splice(emotionsIndex >= 0 ? emotionsIndex + 1 : catalog.decks.length, 0, entry);
}
writeFileSync(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);

console.log(`✓ ${zipPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB, ${topic.cards.length} cards, ${audioCount} audio files)`);
