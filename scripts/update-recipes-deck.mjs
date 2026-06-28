import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";

const OLD_ZIP = "public/decks/reading_dad_texts_v1.124.0.zip";
const NEW_ZIP = "public/decks/reading_dad_texts_v1.125.0.zip";
const NEW_VERSION = "1.125.0";
const RECIPES_DIR = "content/recipes";
const MEDIA_DIR = "content/media";

function countSteps(txt) {
  return txt.split("\n").filter(l => /^\d+\./.test(l)).length;
}

// Known # metadata prefixes — must NOT be treated as the Russian title
const KNOWN_META_PREFIXES = ["en:", "photo:", "fixed_portions:", "status:", "tags:", "portions:", "ingredients:"];

function extractMeta(txt) {
  const lines = txt.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  let ru = "", en = "", photo = "", fixedPortions = null, status = null;
  for (const line of lines) {
    if (line.startsWith("# en:"))                 { en            = line.slice(5).trim(); }
    else if (line.startsWith("# photo:"))          { photo         = line.slice(8).trim(); }
    else if (line.startsWith("# fixed_portions:")) { fixedPortions = parseInt(line.slice(17).trim()) || null; }
    else if (line.startsWith("# status:"))         { status        = line.slice(9).trim(); }
    else if (!line.startsWith("#") && !line.startsWith("[") && !ru) { ru = line; }
  }
  return { ru, en: en || ru, photo, fixedPortions, status };
}

// Load old zip to copy over SVGs that aren't available locally
const oldData = readFileSync(OLD_ZIP);
const oldZip = await JSZip.loadAsync(oldData);
const oldTopicRaw = await oldZip.file("topic.json").async("string");
const oldTopic = JSON.parse(oldTopicRaw);

const newZip = new JSZip();

// Dynamically scan all recipe .txt files
const recipeFiles = readdirSync(RECIPES_DIR)
  .filter(f => f.endsWith(".txt"))
  .sort();

const recipeIds = recipeFiles.map(f => f.replace(".txt", ""));
console.log(`Найдено рецептов: ${recipeIds.length}`);

// Copy extra inline media files (referenced inside recipe steps, not per-recipe SVG/photo)
const EXTRA_MEDIA = ["oven_mode.jpg"];
for (const fname of EXTRA_MEDIA) {
  const localPath = `${MEDIA_DIR}/${fname}`;
  if (existsSync(localPath)) {
    newZip.file(`media/${fname}`, readFileSync(localPath));
    console.log(`${fname}: из content/media/ (inline)`);
  }
}

// Copy topic-level avatar (checklist icon)
const topicAvatarLocal = `${MEDIA_DIR}/topic_checklist.svg`;
if (existsSync(topicAvatarLocal)) {
  newZip.file("media/topic_checklist.svg", readFileSync(topicAvatarLocal, "utf-8"));
  console.log("topic_checklist.svg: из content/media/");
}

// Copy SVG media files
for (const id of recipeIds) {
  const svgPath = `media/${id}.svg`;
  const localSvg = `${MEDIA_DIR}/${id}.svg`;
  if (existsSync(localSvg)) {
    newZip.file(svgPath, readFileSync(localSvg, "utf-8"));
    console.log(`${id}.svg: из content/media/`);
  } else {
    const svgFile = oldZip.file(svgPath);
    if (svgFile) {
      newZip.file(svgPath, await svgFile.async("string"));
    }
  }
}

// Build texts manifest from recipe files
const textsManifest = [];

for (const id of recipeIds) {
  const txtPath = `${RECIPES_DIR}/${id}.txt`;
  const content = readFileSync(txtPath, "utf-8");
  const steps = countSteps(content);
  const { ru, en, photo, fixedPortions, status } = extractMeta(content);
  const title = { ru, en: en || ru };
  const hasSvg = existsSync(`${MEDIA_DIR}/${id}.svg`) || !!oldZip.file(`media/${id}.svg`);

  // Include photo if specified and file exists locally
  let photoPath = null;
  if (photo) {
    const localPhoto = `${MEDIA_DIR}/${photo}`;
    if (existsSync(localPhoto)) {
      newZip.file(`media/${photo}`, readFileSync(localPhoto));
      photoPath = `media/${photo}`;
      console.log(`  photo: ${photo} (local)`);
    } else {
      const oldPhoto = oldZip.file(`media/${photo}`);
      if (oldPhoto) {
        newZip.file(`media/${photo}`, await oldPhoto.async("nodebuffer"));
        photoPath = `media/${photo}`;
        console.log(`  photo: ${photo} (from old ZIP)`);
      }
    }
  }

  newZip.file(`recipes/${id}.txt`, content);

  textsManifest.push({
    id: `${id}_instruction`,
    kind: "instruction",
    title,
    ...(hasSvg         ? { image: `media/${id}.svg` } : {}),
    ...(photoPath      ? { photo: photoPath }          : {}),
    ...(fixedPortions  ? { fixedPortions }              : {}),
    ...(status         ? { status }                     : {}),
    file: `recipes/${id}.txt`,
    stepCount: steps,
  });

  console.log(`${id}.txt: ${steps} шагов — "${title.ru}"`);
}

// Build new topic.json
const newTopic = {
  ...oldTopic,
  meta: {
    ...oldTopic.meta,
    version: NEW_VERSION,
    avatar: "media/topic_checklist.svg",
  },
  texts: textsManifest,
  modes: (oldTopic.modes ?? []).filter((m) => m.id !== "shopping_list"),
};

newZip.file("topic.json", JSON.stringify(newTopic, null, 2));

// Write ZIP
const buffer = await newZip.generateAsync({ type: "nodebuffer" });
writeFileSync(NEW_ZIP, buffer);
console.log(`\nСоздан: ${NEW_ZIP} (${recipeIds.length} рецептов)`);

// Update catalog.json
const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf-8"));
const deckIdx = catalog.decks.findIndex(d => d.id === "reading_dad_texts");
if (deckIdx !== -1) {
  catalog.decks[deckIdx].version = NEW_VERSION;
  catalog.decks[deckIdx].url = `./decks/reading_dad_texts_v${NEW_VERSION}.zip`;
  writeFileSync("public/decks/catalog.json", JSON.stringify(catalog, null, 2));
  console.log("Обновлён catalog.json");
}
