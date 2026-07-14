/**
 * Adds category param to season_form_pick mode and updates overview card categories
 * so each season is independently filterable. Produces v1.0.46.
 *
 * Usage: node scripts/patch-wf-v1.0.46-sfp-category-param.mjs
 */
import fs from "fs";
import path from "path";
import JSZip from "jszip";

const ROOT      = "C:/Users/dmazn/Projects/Mirocard2";
const DECKS_DIR = path.join(ROOT, "public/decks");
const CATALOG   = path.join(DECKS_DIR, "catalog.json");
const SRC_ZIP   = "word_formation_soup_v1.0.45.zip";
const NEW_VER   = "1.0.46";
const DST_ZIP   = `word_formation_soup_v${NEW_VER}.zip`;

const SEASON_CATEGORIES = {
  sea_osen_overview:  "osen",
  sea_zima_overview:  "zima",
  sea_vesna_overview: "vesna",
  sea_leto_overview:  "leto",
};

const CATEGORY_PARAM = {
  type:    "enum_multi",
  label:   { ru: "Время года" },
  values:  ["osen", "zima", "vesna", "leto"],
  labels:  { ru: { osen: "Осень", zima: "Зима", vesna: "Весна", leto: "Лето" } },
  default: ["osen", "zima", "vesna", "leto"],
};

const srcZip   = await JSZip.loadAsync(fs.readFileSync(path.join(DECKS_DIR, SRC_ZIP)));
const srcTopic = JSON.parse(await srcZip.file("topic.json").async("string"));

// 1. Update overview card categories
const updatedCards = srcTopic.cards.map(card => {
  const newCat = SEASON_CATEGORIES[card.id];
  return newCat ? { ...card, category: newCat } : card;
});

// 2. Add category param to season_form_pick mode
const updatedModes = srcTopic.modes.map(mode => {
  if (mode.id !== "season_form_pick") return mode;
  return {
    ...mode,
    params: {
      category: CATEGORY_PARAM,
    },
  };
});

const newTopic = {
  ...srcTopic,
  version: NEW_VER,
  meta: { ...srcTopic.meta, version: NEW_VER },
  cards: updatedCards,
  modes: updatedModes,
};

srcZip.file("topic.json", JSON.stringify(newTopic, null, 2));

const buf = await srcZip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});
fs.writeFileSync(path.join(DECKS_DIR, DST_ZIP), buf);
console.log(`Wrote ${DST_ZIP} (${Math.round(buf.length / 1024)} KB)`);

const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const entry   = catalog.decks?.find(d => d.id === "word_formation_soup");
if (!entry) { console.error("word_formation_soup not found in catalog"); process.exit(1); }
entry.version = NEW_VER;
entry.url     = `./decks/${DST_ZIP}`;
if ("zipUrl" in entry) entry.zipUrl = DST_ZIP;
if ("file"   in entry) entry.file   = DST_ZIP;
fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`Updated catalog.json -> ${DST_ZIP} v${NEW_VER}`);

// Verify
const check = JSON.parse(await srcZip.file("topic.json").async("string"));
const sfp = check.modes.find(m => m.id === "season_form_pick");
console.log("season_form_pick params:", JSON.stringify(sfp.params, null, 2));
const overviewCats = check.cards
  .filter(c => Array.isArray(c.items) && c.items.length > 0)
  .map(c => `${c.id} -> ${c.category}`);
console.log("Overview card categories:", overviewCats);
