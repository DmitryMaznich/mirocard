/**
 * Patches new season background images into word_formation_soup ZIP.
 * Reads v1.0.26, replaces media/season_*.webp, writes v1.0.27, updates catalog.json.
 *
 * Usage: node scripts/patch-season-images.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const DECKS_DIR = path.join(ROOT, "public/decks");
const SEASON_DIR = path.join(__dirname, "season_output");
const CATALOG_PATH = path.join(DECKS_DIR, "catalog.json");

const SOURCE_ZIP = "word_formation_soup_v1.0.26.zip";
const TARGET_ZIP = "word_formation_soup_v1.0.27.zip";
const NEW_VERSION = "1.0.27";

const SEASON_FILES = ["autumn", "winter", "spring", "summer"].map((s) => ({
  zipPath: `media/season_${s}.webp`,
  localPath: path.join(SEASON_DIR, `season_${s}.webp`),
}));

async function main() {
  // Load source ZIP
  const srcPath = path.join(DECKS_DIR, SOURCE_ZIP);
  console.log(`Loading ${SOURCE_ZIP}...`);
  const srcBuf = fs.readFileSync(srcPath);
  const zip = await JSZip.loadAsync(srcBuf);

  // Patch season images
  for (const { zipPath, localPath } of SEASON_FILES) {
    if (!fs.existsSync(localPath)) {
      console.error(`  Missing: ${localPath}`);
      process.exit(1);
    }
    const imgBuf = fs.readFileSync(localPath);
    zip.file(zipPath, imgBuf);
    console.log(`  Patched ${zipPath} (${Math.round(imgBuf.length / 1024)} KB)`);
  }

  // Update version in topic.json
  const topicRaw = await zip.file("topic.json")?.async("string");
  if (topicRaw) {
    const topic = JSON.parse(topicRaw);
    topic.meta = topic.meta ?? {};
    topic.meta.version = NEW_VERSION;
    zip.file("topic.json", JSON.stringify(topic, null, 2));
    console.log(`  Updated topic.json version → ${NEW_VERSION}`);
  }

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
  if (!entry) {
    console.error("word_formation_soup not found in catalog.json");
    process.exit(1);
  }
  entry.version = NEW_VERSION;
  entry.file = TARGET_ZIP;
  entry.url = `./decks/${TARGET_ZIP}`;
  entry.zipUrl = TARGET_ZIP;
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");
  console.log(`Updated catalog.json → ${TARGET_ZIP} v${NEW_VERSION}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
