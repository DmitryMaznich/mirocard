/**
 * Patch word_formation_soup v1.0.25 → v1.0.26
 * Adds 4 season overview cards (with items arrays).
 */
import { createRequire } from "module";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const require = createRequire(import.meta.url);
const JSZip = require("jszip");

const __dir = path.dirname(fileURLToPath(import.meta.url));
const root  = path.resolve(__dir, "..");

const SRC = path.join(root, "public/decks/word_formation_soup_v1.0.25.zip");
const DST = path.join(root, "public/decks/word_formation_soup_v1.0.26.zip");

const zipBuf = readFileSync(SRC);
const zip    = await JSZip.loadAsync(zipBuf);

const topicRaw = await zip.file("topic.json").async("string");
const topic    = JSON.parse(topicRaw);

topic.meta.version = "1.0.26";

const overviewCards = [
  {
    id: "sea_osen_overview",
    category: "seasons",
    backgroundImage: "media/season_autumn.webp",
    contextPhrase: "Наступила осень",
    items: [
      { id: "item_osen_plash",   adjPhrase: "осенний плащ",   image: "media/sea_vesna_plash_ingredient.webp" },
      { id: "item_osen_kurtka",  adjPhrase: "осенняя куртка", image: "media/sea_osen_kurtka_ingredient.webp" },
      { id: "item_osen_sapogi",  adjPhrase: "осенние сапоги", image: "media/sea_osen_sapogi_ingredient.webp" },
      { id: "item_osen_dozhd",   adjPhrase: "осенний дождь",  image: "media/wea_dozhd_ingredient.webp"       },
      { id: "item_osen_listya",  adjPhrase: "осенние листья", image: null },
      { id: "item_osen_griby",   adjPhrase: "осенние грибы",  image: null },
    ],
  },
  {
    id: "sea_zima_overview",
    category: "seasons",
    backgroundImage: "media/season_winter.webp",
    contextPhrase: "Наступила зима",
    items: [
      { id: "item_zima_kurtka",   adjPhrase: "зимняя куртка",   image: "media/sea_zima_shuba_ingredient.webp" },
      { id: "item_zima_shapka",   adjPhrase: "зимняя шапка",    image: null },
      { id: "item_zima_sapogi",   adjPhrase: "зимние сапоги",   image: null },
      { id: "item_zima_varezhki", adjPhrase: "зимние варежки",  image: null },
      { id: "item_zima_gorka",    adjPhrase: "зимняя горка",    image: null },
      { id: "item_zima_sanki",    adjPhrase: "зимние санки",    image: null },
    ],
  },
  {
    id: "sea_vesna_overview",
    category: "seasons",
    backgroundImage: "media/season_spring.webp",
    contextPhrase: "Наступила весна",
    items: [
      { id: "item_vesna_cvety",   adjPhrase: "весенние цветы",   image: null },
      { id: "item_vesna_kurtka",  adjPhrase: "весенняя куртка",  image: "media/sea_osen_kurtka_ingredient.webp" },
      { id: "item_vesna_botinki", adjPhrase: "весенние ботинки", image: null },
      { id: "item_vesna_dozhd",   adjPhrase: "весенний дождь",   image: "media/wea_dozhd_ingredient.webp" },
      { id: "item_vesna_solnce",  adjPhrase: "весеннее солнце",  image: null },
      { id: "item_vesna_ruchi",   adjPhrase: "весенние ручьи",   image: null },
    ],
  },
  {
    id: "sea_leto_overview",
    category: "seasons",
    backgroundImage: "media/season_summer.webp",
    contextPhrase: "Наступило лето",
    items: [
      { id: "item_leto_futbolka", adjPhrase: "летняя футболка", image: null },
      { id: "item_leto_shorty",   adjPhrase: "летние шорты",    image: "media/sea_leto_shorty_ingredient.webp" },
      { id: "item_leto_kepka",    adjPhrase: "летняя кепка",    image: null },
      { id: "item_leto_solnce",   adjPhrase: "летнее солнце",   image: null },
      { id: "item_leto_yagody",   adjPhrase: "летние ягоды",    image: null },
      { id: "item_leto_cvety",    adjPhrase: "летние цветы",    image: null },
    ],
  },
];

// Prepend overview cards (they'll appear first in pair_intro mode)
topic.cards = [...overviewCards, ...topic.cards];

zip.file("topic.json", JSON.stringify(topic, null, 2));

const newBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(DST, newBuf);
console.log(`Written: ${DST}`);
console.log(`Cards total: ${topic.cards.length} (+ 4 overview)`);
