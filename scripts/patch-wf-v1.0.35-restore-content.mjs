/**
 * v1.0.31 ("keep only 4 season overview cards") dropped 53 cards
 * (soup/juice/jam/kasha/materials/weather + 8 individual season items)
 * and was never reverted through v1.0.34. Media files were untouched.
 * This restores the full v1.0.30 card set onto the current (v1.0.34)
 * meta/modes, producing v1.0.35.
 *
 * Usage: node scripts/patch-wf-v1.0.35-restore-content.mjs
 */
import fs from "fs";
import path from "path";
import JSZip from "jszip";

const ROOT = "C:/Users/dmazn/Projects/Mirocard2";
const DECKS_DIR = path.join(ROOT, "public/decks");
const CATALOG_PATH = path.join(DECKS_DIR, "catalog.json");

const SOURCE_FULL = "word_formation_soup_v1.0.30.zip";   // last version with all 57 cards
const SOURCE_CUR  = "word_formation_soup_v1.0.34.zip";   // current production (media + latest meta/modes)
const NEW_VERSION = "1.0.35";
const TARGET_ZIP  = `word_formation_soup_v${NEW_VERSION}.zip`;

const fullZip = await JSZip.loadAsync(fs.readFileSync(path.join(DECKS_DIR, SOURCE_FULL)));
const curZip  = await JSZip.loadAsync(fs.readFileSync(path.join(DECKS_DIR, SOURCE_CUR)));

const fullTopic = JSON.parse(await fullZip.file("topic.json").async("string"));
const curTopic  = JSON.parse(await curZip.file("topic.json").async("string"));

// Sanity: overview season cards must be identical content in both
const fullOverview = fullTopic.cards.filter(c => c.id.endsWith("_overview"));
if (JSON.stringify(fullOverview) !== JSON.stringify(curTopic.cards)) {
  console.error("Season overview cards differ between v1.0.30 and v1.0.34 — aborting, needs manual review");
  process.exit(1);
}

// New topic = current meta/modes (latest fixes) + full card set from v1.0.30
const newTopic = {
  ...curTopic,
  meta: { ...curTopic.meta, version: NEW_VERSION },
  version: NEW_VERSION,
  cards: fullTopic.cards,
};

// Base the new ZIP on the current (v1.0.34) ZIP so we keep the latest media set,
// then add back any media files that only existed in v1.0.30 (season item photos etc.)
const newZip = curZip;
for (const [relPath, file] of Object.entries(fullZip.files)) {
  if (file.dir) continue;
  if (!newZip.file(relPath)) {
    const buf = await file.async("nodebuffer");
    newZip.file(relPath, buf);
    console.log(`  + restored media: ${relPath}`);
  }
}

newZip.file("topic.json", JSON.stringify(newTopic, null, 2));

const outBuf = await newZip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 6 },
});
fs.writeFileSync(path.join(DECKS_DIR, TARGET_ZIP), outBuf);
console.log(`Wrote ${TARGET_ZIP} (${Math.round(outBuf.length / 1024)} KB), cards: ${newTopic.cards.length}`);

// Update catalog.json
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const entry = catalog.decks?.find(d => d.id === "word_formation_soup");
if (!entry) { console.error("word_formation_soup not found in catalog"); process.exit(1); }
entry.version = NEW_VERSION;
entry.url = `./decks/${TARGET_ZIP}`;
entry.zipUrl = TARGET_ZIP;
entry.file = TARGET_ZIP;
fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`Updated catalog.json -> ${TARGET_ZIP} v${NEW_VERSION}`);
