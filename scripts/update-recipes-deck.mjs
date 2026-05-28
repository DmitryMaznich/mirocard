import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const OLD_ZIP = "public/decks/reading_dad_texts_v1.21.0.zip";
const NEW_ZIP = "public/decks/reading_dad_texts_v1.22.0.zip";
const NEW_VERSION = "1.22.0";
const RECIPES_DIR = "content/recipes";

const recipeIds = [
  "omelet", "mashed_potatoes", "pasta", "fried_eggs", "oatmeal",
  "salad", "chicken", "syrnik", "tea", "cocoa", "kompot", "lemonade",
  "pasta_meat",
];

const TITLES = {
  omelet:           { ru: "Омлет с колбасой",              en: "Omelette with Sausage" },
  mashed_potatoes:  { ru: "Картофельное пюре",             en: "Mashed Potatoes" },
  pasta:            { ru: "Макароны с маслом и сыром",     en: "Pasta with Butter and Cheese" },
  fried_eggs:       { ru: "Яичница-глазунья",              en: "Fried Eggs" },
  oatmeal:          { ru: "Овсяная каша на молоке",        en: "Oatmeal" },
  salad:            { ru: "Салат из огурцов и помидоров",  en: "Cucumber and Tomato Salad" },
  chicken:          { ru: "Курица в сливочном соусе",      en: "Chicken in Cream Sauce" },
  syrnik:           { ru: "Сырники",                       en: "Cottage Cheese Pancakes" },
  tea:              { ru: "Чай с мёдом",                   en: "Tea with Honey" },
  cocoa:            { ru: "Какао",                         en: "Cocoa" },
  kompot:           { ru: "Компот из ягод",                en: "Berry Compote" },
  lemonade:         { ru: "Лимонад",                       en: "Lemonade" },
  pasta_meat:       { ru: "Макароны болоньезе",            en: "Pasta Bolognese" },
};

function countSteps(txt) {
  return txt.split("\n").filter(l => /^\d+\./.test(l)).length;
}

// Load old zip to extract SVGs and existing topic structure
const oldData = readFileSync(OLD_ZIP);
const oldZip = await JSZip.loadAsync(oldData);
const oldTopicRaw = await oldZip.file("topic.json").async("string");
const oldTopic = JSON.parse(oldTopicRaw);

const newZip = new JSZip();

// Copy SVG media files: prefer local content/media/, fall back to old ZIP
for (const id of recipeIds) {
  const svgPath = `media/${id}.svg`;
  const localSvg = `content/media/${id}.svg`;
  if (existsSync(localSvg)) {
    newZip.file(svgPath, readFileSync(localSvg, "utf-8"));
    console.log(`${id}.svg: из content/media/`);
  } else {
    const svgFile = oldZip.file(svgPath);
    if (svgFile) newZip.file(svgPath, await svgFile.async("string"));
  }
}

// Build texts manifest from recipeIds
const textsManifest = [];

for (const id of recipeIds) {
  const txtPath = `${RECIPES_DIR}/${id}.txt`;
  const content = readFileSync(txtPath, "utf-8");
  const steps = countSteps(content);

  newZip.file(`recipes/${id}.txt`, content);

  // Find existing text entry in old topic (by id with or without _instruction suffix)
  const existing = oldTopic.texts.find(
    (t) => t.id === `${id}_instruction` || t.id === id
  );

  const textEntry = existing
    ? { ...existing, title: TITLES[id] ?? existing.title, stepCount: steps, image: existing.image ?? `media/${id}.svg` }
    : {
        id: `${id}_instruction`,
        kind: "instruction",
        title: TITLES[id] ?? { ru: id, en: id },
        image: `media/${id}.svg`,
        file: `recipes/${id}.txt`,
        stepCount: steps,
      };

  textsManifest.push(textEntry);
  console.log(`${id}.txt: ${steps} шагов`);
}

// Build new topic.json
const newTopic = {
  ...oldTopic,
  meta: {
    ...oldTopic.meta,
    version: NEW_VERSION,
    title: { ru: "Инструкции — рецепты", en: "Instructions: Recipes" },
    description: {
      ru: "Пошаговые инструкции для работы в группе под руководством шеф-повара.",
      en: "Step-by-step instructions for group cooking sessions.",
    },
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
  catalog.decks[deckIdx].title = { ru: "Инструкции — рецепты", en: "Instructions: Recipes" };
  writeFileSync("public/decks/catalog.json", JSON.stringify(catalog, null, 2));
  console.log("Обновлён catalog.json");
}
