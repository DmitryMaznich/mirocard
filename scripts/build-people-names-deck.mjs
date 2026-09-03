import JSZip from "jszip";
import sharp from "sharp";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const TOPIC_PATH = "tools/people_names/topic.json";
const ASSET_DIR = "public/decks/_assets/people_names";
const CATALOG_PATH = "public/decks/catalog.json";

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

console.log(`✓ ${zipPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB, ${topic.cards.length} cards)`);
