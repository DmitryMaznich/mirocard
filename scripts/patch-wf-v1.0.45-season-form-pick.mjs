/**
 * Adds the "season_form_pick" mode to the word_formation_soup deck,
 * producing v1.0.45. No media changes — only topic.json is updated.
 *
 * Usage: node scripts/patch-wf-v1.0.45-season-form-pick.mjs
 */
import fs from "fs";
import path from "path";
import JSZip from "jszip";

const ROOT       = "C:/Users/dmazn/Projects/Mirocard2";
const DECKS_DIR  = path.join(ROOT, "public/decks");
const CATALOG    = path.join(DECKS_DIR, "catalog.json");
const SRC_ZIP    = "word_formation_soup_v1.0.44.zip";
const NEW_VER    = "1.0.45";
const DST_ZIP    = `word_formation_soup_v${NEW_VER}.zip`;

const srcZip   = await JSZip.loadAsync(fs.readFileSync(path.join(DECKS_DIR, SRC_ZIP)));
const srcTopic = JSON.parse(await srcZip.file("topic.json").async("string"));

if (srcTopic.modes.some(m => m.id === "season_form_pick")) {
  console.log("season_form_pick already present — nothing to do");
  process.exit(0);
}

const newMode = {
  id:         "season_form_pick",
  type:       "season_form_pick",
  evaluation: "auto",
  ui: {
    title:       "Выбери окончание",
    instruction: "Нажми правильную форму прилагательного",
  },
  methodology: {
    text:  "Ребёнок видит картинку предмета и подпись без прилагательного, затем выбирает нужную форму из четырёх вариантов. Тренирует согласование прилагательного с существительным по роду и числу.",
    tips:  [
      "Называйте вслух: «Плащ — мужской род, значит КАКОЙ? — осенний»",
      "Акцентируйте цветное окончание на кнопках",
    ],
    duration: "4–6 минут",
  },
};

const newTopic = {
  ...srcTopic,
  version:  NEW_VER,
  meta: { ...srcTopic.meta, version: NEW_VER },
  modes: [...srcTopic.modes, newMode],
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
console.log("Modes:", newTopic.modes.map(m => m.id).join(", "));
