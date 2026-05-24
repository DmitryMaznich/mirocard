import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";

const OLD_ZIP = "public/decks/reading_dad_texts_v1.15.0.zip";
const NEW_ZIP = "public/decks/reading_dad_texts_v1.16.0.zip";
const NEW_VERSION = "1.16.0";
const RECIPES_DIR = "content/recipes";

const recipeIds = [
  "omelet", "mashed_potatoes", "pasta", "fried_eggs", "oatmeal",
  "salad", "chicken", "syrnik", "tea", "cocoa", "kompot", "lemonade",
];

function countSteps(txt) {
  return txt.split("\n").filter(l => /^\d+\./.test(l)).length;
}

// Load old zip to extract SVGs
const oldData = readFileSync(OLD_ZIP);
const oldZip = await JSZip.loadAsync(oldData);

const newZip = new JSZip();

// Copy all SVG media files from old zip
for (const id of recipeIds) {
  const svgPath = `media/${id}.svg`;
  const svgFile = oldZip.file(svgPath);
  if (svgFile) {
    const svgContent = await svgFile.async("string");
    newZip.file(svgPath, svgContent);
  } else {
    console.warn(`SVG not found in old zip: ${svgPath}`);
  }
}

// Read updated recipe texts and count steps
const textsManifest = [];
const oldTopicRaw = await oldZip.file("topic.json").async("string");
const oldTopic = JSON.parse(oldTopicRaw);

for (const oldText of oldTopic.texts) {
  const id = oldText.id.replace("_instruction", "");
  const txtPath = `${RECIPES_DIR}/${id}.txt`;
  const content = readFileSync(txtPath, "utf-8");
  const steps = countSteps(content);

  newZip.file(`recipes/${id}.txt`, content);

  textsManifest.push({
    ...oldText,
    stepCount: steps,
  });

  console.log(`${id}.txt: ${steps} шагов`);
}

// Build new topic.json
const newTopic = {
  ...oldTopic,
  meta: {
    ...oldTopic.meta,
    version: NEW_VERSION,
  },
  texts: textsManifest,
};

newZip.file("topic.json", JSON.stringify(newTopic, null, 2));

// Write ZIP
const buffer = await newZip.generateAsync({ type: "nodebuffer" });
writeFileSync(NEW_ZIP, buffer);
console.log(`\nСоздан: ${NEW_ZIP}`);

// Update catalog.json
const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf-8"));
const deckIdx = catalog.decks.findIndex(d => d.id === "reading_dad_texts");
if (deckIdx !== -1) {
  catalog.decks[deckIdx].version = NEW_VERSION;
  catalog.decks[deckIdx].url = `./decks/reading_dad_texts_v${NEW_VERSION}.zip`;
  writeFileSync("public/decks/catalog.json", JSON.stringify(catalog, null, 2));
  console.log("Обновлён catalog.json");
}
