/**
 * Patches new season item images into word_formation_soup ZIP.
 * Loads v1.0.29, adds media/item_*.webp, updates topic.json image fields,
 * writes v1.0.30, updates catalog.json.
 *
 * Usage: node scripts/patch-season-items.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DECKS_DIR = path.join(ROOT, "public/decks");
const ITEMS_DIR = path.join(__dirname, "season_items_output");
const CATALOG_PATH = path.join(DECKS_DIR, "catalog.json");

const SOURCE_ZIP = "word_formation_soup_v1.0.29.zip";
const TARGET_ZIP = "word_formation_soup_v1.0.30.zip";
const NEW_VERSION = "1.0.30";

// New images to add: local filename → path inside ZIP
const NEW_IMAGES = [
  "item_osen_listya",
  "item_osen_griby",
  "item_zima_shapka",
  "item_zima_sapogi",
  "item_zima_varezhki",
  "item_zima_gorka",
  "item_zima_sanki",
  "item_vesna_cvety",
  "item_vesna_botinki",
  "item_vesna_solnce",
  "item_vesna_ruchi",
  "item_leto_futbolka",
  "item_leto_kepka",
  "item_leto_solnce",
  "item_leto_yagody",
  "item_leto_cvety",
  "item_dozhd",
].map((name) => ({
  name,
  localPath: path.join(ITEMS_DIR, `${name}.webp`),
  zipPath: `media/${name}.webp`,
}));

// Topic item ID → new zip path
const ITEM_IMAGE_MAP = {
  // null → new images
  item_osen_listya: "media/item_osen_listya.webp",
  item_osen_griby: "media/item_osen_griby.webp",
  item_zima_shapka: "media/item_zima_shapka.webp",
  item_zima_sapogi: "media/item_zima_sapogi.webp",
  item_zima_varezhki: "media/item_zima_varezhki.webp",
  item_zima_gorka: "media/item_zima_gorka.webp",
  item_zima_sanki: "media/item_zima_sanki.webp",
  item_vesna_cvety: "media/item_vesna_cvety.webp",
  item_vesna_botinki: "media/item_vesna_botinki.webp",
  item_vesna_solnce: "media/item_vesna_solnce.webp",
  item_vesna_ruchi: "media/item_vesna_ruchi.webp",
  item_leto_futbolka: "media/item_leto_futbolka.webp",
  item_leto_kepka: "media/item_leto_kepka.webp",
  item_leto_solnce: "media/item_leto_solnce.webp",
  item_leto_yagody: "media/item_leto_yagody.webp",
  item_leto_cvety: "media/item_leto_cvety.webp",
  // replace old rain photo
  item_osen_dozhd: "media/item_dozhd.webp",
  item_vesna_dozhd: "media/item_dozhd.webp",
};

async function main() {
  // Load source ZIP
  const srcPath = path.join(DECKS_DIR, SOURCE_ZIP);
  console.log(`Loading ${SOURCE_ZIP}...`);
  const zip = await JSZip.loadAsync(fs.readFileSync(srcPath));

  // Add all new item images
  console.log("\nAdding item images:");
  for (const { name, localPath, zipPath } of NEW_IMAGES) {
    if (!fs.existsSync(localPath)) {
      console.error(`  MISSING: ${localPath}`);
      process.exit(1);
    }
    const buf = fs.readFileSync(localPath);
    zip.file(zipPath, buf);
    console.log(`  + ${zipPath} (${Math.round(buf.length / 1024)} KB)`);
  }

  // Update topic.json
  const topicRaw = await zip.file("topic.json").async("string");
  const topic = JSON.parse(topicRaw);

  let updated = 0;
  for (const card of topic.cards ?? []) {
    for (const item of card.items ?? []) {
      if (ITEM_IMAGE_MAP[item.id]) {
        const prev = item.image;
        item.image = ITEM_IMAGE_MAP[item.id];
        console.log(`  topic: ${item.id} ${JSON.stringify(prev)} → "${item.image}"`);
        updated++;
      }
    }
  }
  console.log(`\nUpdated ${updated} item image fields`);

  topic.version = NEW_VERSION;
  topic.meta = topic.meta ?? {};
  topic.meta.version = NEW_VERSION;
  zip.file("topic.json", JSON.stringify(topic, null, 2));

  // Write new ZIP
  const dstPath = path.join(DECKS_DIR, TARGET_ZIP);
  const newBuf = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  fs.writeFileSync(dstPath, newBuf);
  console.log(`\nWrote ${TARGET_ZIP} (${Math.round(newBuf.length / 1024)} KB)`);

  // Update catalog.json
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const entry = catalog.decks?.find((d) => d.id === "word_formation_soup");
  if (!entry) { console.error("word_formation_soup not found in catalog"); process.exit(1); }
  entry.version = NEW_VERSION;
  entry.file = TARGET_ZIP;
  entry.url = `./decks/${TARGET_ZIP}`;
  entry.zipUrl = TARGET_ZIP;
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log(`Updated catalog.json → ${TARGET_ZIP} v${NEW_VERSION}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
