import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";

const TOPIC_ID = "shopping_list";
const VERSION  = "1.0.3";
const ZIP_PATH = `public/decks/${TOPIC_ID}_v${VERSION}.zip`;

const topic = {
  meta: {
    id: TOPIC_ID,
    renderer: "shopping",
    version: VERSION,
    title: { ru: "Список покупок", en: "Shopping list" },
    language: "ru",
  },
  modes: [
    {
      id: "plan",
      type: "plan",
      evaluation: "none",
      requirePin: false,
      ui: {
        title: { ru: "Составить список", en: "Build list" },
        instruction: { ru: "Выбери, что нужно купить" },
      },
    },
  ],
  texts: [
    {
      id: "shopping_main",
      kind: "shopping_v2",
      title: { ru: "Список покупок", en: "Shopping list" },
      file: "shopping/shopping.txt",
      //         Овощи  Фрукты Ягоды  Зелень Бакалея Мясо  Рыба  Гастрон Напитки Молочн Химия  Сладости Хлеб  Консервы Заморозка Животные
      categoryIcons: ["🥦","🍎","🍓","🌿","🌾","🥩","🐟","🧀","🥤","🥛","🧴","🍬","🍞","🥫","🧊","🐾"],
    },
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
zip.file("shopping/shopping.txt", readFileSync("content/shopping/shopping.txt", "utf-8"));

const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH}`);

const catalog = JSON.parse(readFileSync("public/decks/catalog.json", "utf-8"));
const idx = catalog.decks.findIndex((d) => d.id === TOPIC_ID);
const entry = {
  id: TOPIC_ID,
  version: VERSION,
  url: `./decks/${TOPIC_ID}_v${VERSION}.zip`,
  title: { ru: "Список покупок", en: "Shopping list" },
  renderer: "shopping",
};
if (idx >= 0) { catalog.decks[idx] = entry; } else { catalog.decks.push(entry); }
writeFileSync("public/decks/catalog.json", JSON.stringify(catalog, null, 2));
console.log("✓ catalog.json updated");
