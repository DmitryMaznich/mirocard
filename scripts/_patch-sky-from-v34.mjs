/**
 * Patches v1.0.34 with sky images extracted from v1.0.35 (bad source)
 * → produces a correct v1.0.35
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS = path.join(__dirname, "..", "public", "decks");

// Load source (good data)
const src34 = fs.readFileSync(path.join(DECKS, "word_formation_soup_v1.0.34.zip"));
const zip34 = await JSZip.loadAsync(src34);
const data = JSON.parse(await zip34.file("topic.json").async("text"));

// Load images from bad v1.0.35
const src35 = fs.readFileSync(path.join(DECKS, "word_formation_soup_v1.0.35.zip"));
const zip35 = await JSZip.loadAsync(src35);

const SKY = [
  { id: "item_osen_nebo",  adjPhrase: "осеннее небо",  replaces: "item_osen_kurtka",  season: "sea_osen_overview", file: "item_osen_nebo.webp" },
  { id: "item_zima_nebo",  adjPhrase: "зимнее небо",   replaces: "item_zima_kurtka",  season: "sea_zima_overview", file: "item_zima_nebo.webp" },
  { id: "item_vesna_nebo", adjPhrase: "весеннее небо", replaces: "item_vesna_kurtka", season: "sea_vesna_overview", file: "item_vesna_nebo.webp" },
  { id: "item_leto_nebo",  adjPhrase: "летнее небо",   replaces: "item_leto_cvety",   season: "sea_leto_overview", file: "item_leto_nebo.webp" },
];

// Patch topic.json
for (const sky of SKY) {
  const card = data.cards.find(c => c.id === sky.season);
  if (!card) { console.error("Card not found:", sky.season); process.exit(1); }
  const idx = card.items.findIndex(it => it.id === sky.replaces);
  if (idx === -1) { console.error("Item not found:", sky.replaces); process.exit(1); }
  const old = card.items[idx];
  card.items[idx] = { id: sky.id, adjPhrase: sky.adjPhrase, image: `media/${sky.file}` };
  console.log(`${sky.season}: ${old.adjPhrase} → ${sky.adjPhrase}`);
}
data.version = "1.0.35";

// Write patched topic.json into zip34
zip34.file("topic.json", JSON.stringify(data, null, 2));

// Copy sky images from zip35 into zip34
for (const sky of SKY) {
  const imgBuf = await zip35.file(`media/${sky.file}`).async("nodebuffer");
  zip34.file(`media/${sky.file}`, imgBuf);
  console.log(`Added media/${sky.file} (${Math.round(imgBuf.length/1024)} KB)`);
}

// Delete bad v1.0.35 first
fs.unlinkSync(path.join(DECKS, "word_formation_soup_v1.0.35.zip"));

// Write correct v1.0.35
const outBuf = await zip34.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
fs.writeFileSync(path.join(DECKS, "word_formation_soup_v1.0.35.zip"), outBuf);
console.log(`\nWrote word_formation_soup_v1.0.35.zip (${Math.round(outBuf.length/1024)} KB)`);

// Update catalog.json
const catPath = path.join(DECKS, "catalog.json");
const catalog = JSON.parse(fs.readFileSync(catPath, "utf8"));
const entry = catalog.decks.find(d => d.id === "word_formation_soup");
if (entry) {
  entry.version = "1.0.35";
  entry.file = "word_formation_soup_v1.0.35.zip";
  entry.url = "/decks/word_formation_soup_v1.0.35.zip";
  entry.zipUrl = "/decks/word_formation_soup_v1.0.35.zip";
  fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2));
  console.log("Updated catalog.json → v1.0.35");
}
console.log("Done");
