import JSZip from "jszip";
import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TOPIC_PATH = "tools/people_names/topic.json";
const ASSET_DIR = "public/decks/_assets/people_names";
const CATALOG_PATH = "public/decks/catalog.json";
// Where generate-people-names-audio.mjs (Gemini TTS) writes synthesized
// .mp3 files. A card gets its `audio`/`personAudio` field only if the file
// actually exists here - until then IntroTask/person_intro fall back to
// browser TTS of speech/personSpeech (see flashcards/index.jsx).
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
  const speechAudioPath = `${AUDIO_SRC_DIR}/${card.id}.mp3`;
  const personAudioPath = `${AUDIO_SRC_DIR}/${card.id}_person.mp3`;
  // promptAudio is shared per concept (every photo/pictogram/illustration/
  // probe card of e.g. "boy" all say the same "Покажи мальчика.") - keyed by
  // conceptId, not card id, so one recording covers every card of that concept.
  const promptAudioPath = `${AUDIO_SRC_DIR}/prompt_${card.conceptId}.mp3`;
  // personPromptAudio ("Где Петя?") only applies to cards with a named person.
  const personPromptAudioPath = card.person
    ? `${AUDIO_SRC_DIR}/where_${card.person.id}.mp3`
    : null;
  const withAudio = {
    ...card,
    ...(existsSync(speechAudioPath) && { audio: { ru: `audio/${card.id}.mp3` } }),
    ...(existsSync(personAudioPath) && { personAudio: { ru: `audio/${card.id}_person.mp3` } }),
    ...(existsSync(promptAudioPath) && { promptAudio: { ru: `audio/prompt_${card.conceptId}.mp3` } }),
    ...(personPromptAudioPath && existsSync(personPromptAudioPath) && {
      personPromptAudio: { ru: `audio/where_${card.person.id}.mp3` },
    }),
  };
  if (withAudio.audio) audioCount += 1;
  if (withAudio.personAudio) audioCount += 1;
  if (withAudio.promptAudio) audioCount += 1;
  if (withAudio.personPromptAudio) audioCount += 1;
  return withAudio;
});
topic.cards = cardsWithAudio;

// Fixed-phrase audio not tied to any single card: choose_name's single
// "Как зовут?" prompt (mode-level) and sort_by_attribute's two instructions
// (one per sortBy value) - attached to the mode objects in-memory, same
// audio-free-source convention as the card fields above.
const choosNameAudioPath = `${AUDIO_SRC_DIR}/choose_name_prompt.mp3`;
const sortCategoryAudioPath = `${AUDIO_SRC_DIR}/sort_category.mp3`;
const sortAgeAudioPath = `${AUDIO_SRC_DIR}/sort_age.mp3`;
topic.modes = topic.modes.map((mode) => {
  if (mode.type === "choose_name" && existsSync(choosNameAudioPath)) {
    audioCount += 1;
    return { ...mode, promptAudio: { ru: "audio/choose_name_prompt.mp3" } };
  }
  if (mode.type === "sort_by_attribute") {
    const instructionAudio = {};
    if (existsSync(sortCategoryAudioPath)) { instructionAudio.category = { ru: "audio/sort_category.mp3" }; audioCount += 1; }
    if (existsSync(sortAgeAudioPath))      { instructionAudio.age      = { ru: "audio/sort_age.mp3" };      audioCount += 1; }
    if (Object.keys(instructionAudio).length) {
      return { ...mode, ui: { ...mode.ui, instructionAudio } };
    }
  }
  return mode;
});

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
zip.file(AVATAR_PATH, AVATAR_SVG);

for (const card of topic.cards) {
  const sourcePath = `${ASSET_DIR}/${card.id}.png`;
  if (!existsSync(sourcePath)) throw new Error(`Missing people-names image: ${sourcePath}`);
  const webp = await sharp(sourcePath)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, smartSubsample: true })
    .toBuffer();
  zip.file(card.image, webp);

  for (const audioField of [card.audio, card.personAudio, card.promptAudio, card.personPromptAudio]) {
    if (!audioField?.ru) continue;
    const fileName = audioField.ru.split("/").at(-1);
    zip.file(audioField.ru, readFileSync(`${AUDIO_SRC_DIR}/${fileName}`));
  }
}

for (const mode of topic.modes) {
  for (const audioField of [mode.promptAudio, mode.ui?.instructionAudio?.category, mode.ui?.instructionAudio?.age]) {
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
    ru: "Мальчик, девочка, мужчина и женщина: узнавание людей, ребёнок / взрослый и первые русскоязычные имена на современных фотореалистичных карточках.",
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
