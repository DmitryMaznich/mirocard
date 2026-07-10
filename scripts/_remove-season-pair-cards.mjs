/**
 * Removes individual season pair cards (sea_zima_sharf etc.) from v1.0.36
 * → produces v1.0.37 with only the 4 overview cards in seasons category
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DECKS = path.join(__dirname, "..", "public", "decks");
const SRC = "word_formation_soup_v1.0.36.zip";
const OUT_VER = "1.0.37";
const OUT = `word_formation_soup_v${OUT_VER}.zip`;

const raw = fs.readFileSync(path.join(DECKS, SRC));
const zip = await JSZip.loadAsync(raw);
const data = JSON.parse(await zip.file("topic.json").async("text"));

const REMOVE_IDS = [
  "sea_zima_sharf", "sea_zima_shuba",
  "sea_osen_sapogi", "sea_osen_kurtka",
  "sea_leto_sarafan", "sea_leto_shorty",
  "sea_vesna_plash", "sea_vesna_zontik",
];

const before = data.cards.length;
data.cards = data.cards.filter(c => !REMOVE_IDS.includes(c.id));
data.version = OUT_VER;
console.log(`Removed ${before - data.cards.length} cards (${before} → ${data.cards.length})`);
data.cards.filter(c => c.category === "seasons").forEach(c =>
  console.log("  kept:", c.id, c.items ? `(${c.items.length} items)` : "")
);

zip.file("topic.json", JSON.stringify(data, null, 2));
const outBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
fs.writeFileSync(path.join(DECKS, OUT), outBuf);
console.log(`\nWrote ${OUT} (${Math.round(outBuf.length / 1024)} KB)`);

const catPath = path.join(DECKS, "catalog.json");
const catalog = JSON.parse(fs.readFileSync(catPath, "utf8"));
const entry = catalog.decks.find(d => d.id === "word_formation_soup");
entry.version = OUT_VER;
entry.file = OUT;
entry.url = `/decks/${OUT}`;
entry.zipUrl = `/decks/${OUT}`;
fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2));
console.log(`Updated catalog.json → v${OUT_VER}`);
