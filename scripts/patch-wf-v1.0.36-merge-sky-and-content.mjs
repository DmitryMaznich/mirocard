import fs from "fs";
import path from "path";
import JSZip from "jszip";

const ROOT = "C:/Users/dmazn/Projects/Mirocard2";
const DECKS_DIR = path.join(ROOT, "public/decks");
const CATALOG_PATH = path.join(DECKS_DIR, "catalog.json");

const SOURCE_FULL = "word_formation_soup_v1.0.30.zip"; // last version with all 57 cards (no sky)
const SOURCE_CUR  = "word_formation_soup_v1.0.35.zip"; // current HEAD: sky feature, but only 4 season cards, media has sky assets
const NEW_VERSION = "1.0.36";
const TARGET_ZIP  = `word_formation_soup_v${NEW_VERSION}.zip`;

const fullZip = await JSZip.loadAsync(fs.readFileSync(path.join(DECKS_DIR, SOURCE_FULL)));
const curZip  = await JSZip.loadAsync(fs.readFileSync(path.join(DECKS_DIR, SOURCE_CUR)));

const fullTopic = JSON.parse(await fullZip.file("topic.json").async("string"));
const curTopic  = JSON.parse(await curZip.file("topic.json").async("string"));

// curTopic.cards = 4 sky-enhanced season overview cards (source of truth for those 4 ids)
const skyOverviewById = new Map(curTopic.cards.map(c => [c.id, c]));

const mergedCards = fullTopic.cards.map(c => skyOverviewById.get(c.id) ?? c);

// sanity: every card that was an overview card in fullTopic must have been replaced by sky version
const overviewIds = fullTopic.cards.filter(c => c.id.endsWith("_overview")).map(c => c.id);
for (const id of overviewIds) {
  if (!skyOverviewById.has(id)) {
    console.error(`Missing sky version for ${id} — aborting`);
    process.exit(1);
  }
}

const newTopic = {
  ...curTopic,
  meta: { ...curTopic.meta, version: NEW_VERSION },
  version: NEW_VERSION,
  cards: mergedCards,
};

// Base new zip on current HEAD zip (has sky media + latest CSS-relevant data), add back any
// media that only exists in v1.0.30 (older season item photos, other-category ingredients).
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

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const entry = catalog.decks?.find(d => d.id === "word_formation_soup");
if (!entry) { console.error("word_formation_soup not found in catalog"); process.exit(1); }
entry.version = NEW_VERSION;
entry.url = `./decks/${TARGET_ZIP}`;
entry.zipUrl = TARGET_ZIP;
entry.file = TARGET_ZIP;
fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`Updated catalog.json -> ${TARGET_ZIP} v${NEW_VERSION}`);
