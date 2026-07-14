/**
 * pick_form: add hideOptionImages param, group difficulty/hintMode/showImage/hideOptionImages
 * under section "Усложнения".
 *
 * Usage: node scripts/patch-wf-v1.0.50-pick-form-усложнения.mjs
 */
import fs from "fs";
import path from "path";
import JSZip from "jszip";

const ROOT      = "C:/Users/dmazn/Projects/Mirocard2";
const DECKS_DIR = path.join(ROOT, "public/decks");
const CATALOG   = path.join(DECKS_DIR, "catalog.json");
const SRC_ZIP   = "word_formation_soup_v1.0.49.zip";
const NEW_VER   = "1.0.50";
const DST_ZIP   = `word_formation_soup_v${NEW_VER}.zip`;

const УСЛОЖНЕНИЯ_KEYS = ["difficulty", "hintMode", "showImage"];

const srcZip   = await JSZip.loadAsync(fs.readFileSync(path.join(DECKS_DIR, SRC_ZIP)));
const srcTopic = JSON.parse(await srcZip.file("topic.json").async("string"));

const updatedModes = srcTopic.modes.map(mode => {
  if (mode.id !== "pick_form") return mode;

  const newParams = {};
  for (const [key, def] of Object.entries(mode.params ?? {})) {
    newParams[key] = УСЛОЖНЕНИЯ_KEYS.includes(key)
      ? { ...def, section: "Усложнения" }
      : def;
  }
  newParams.hideOptionImages = {
    type:    "boolean",
    section: "Усложнения",
    label:   { ru: "Без картинок в подборке" },
    hint:    { ru: "Подборка показывает только текст, без изображений предметов" },
    default: false,
  };

  return { ...mode, params: newParams };
});

const newTopic = {
  ...srcTopic,
  version: NEW_VER,
  meta: { ...srcTopic.meta, version: NEW_VER },
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
entry.version = NEW_VER;
entry.url     = `./decks/${DST_ZIP}`;
if ("zipUrl" in entry) entry.zipUrl = DST_ZIP;
if ("file"   in entry) entry.file   = DST_ZIP;
fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`Updated catalog.json -> ${DST_ZIP} v${NEW_VER}`);

const check = JSON.parse(await srcZip.file("topic.json").async("string"));
const pf    = check.modes.find(m => m.id === "pick_form");
console.log("\npick_form params:");
for (const [k, v] of Object.entries(pf.params)) {
  console.log(`  ${k}: type=${v.type}  section=${v.section ?? "-"}`);
}
