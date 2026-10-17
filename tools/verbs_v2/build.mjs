import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const deck = JSON.parse(readFileSync(join(dir, "deck.json"), "utf8"));
const zip = new JSZip();

zip.file("deck.json", readFileSync(join(dir, "deck.json")));
zip.file("generation-report.json", readFileSync(join(dir, "generation-report.json")));

// Only files the deck references ship: retired cards keep their source images
// in media/ (see docs/verbs-methodology-review.md) but stay out of the ZIP.
const files = new Set();
for (const card of deck.cards) {
  if (card.image) files.add(card.image);
  for (const path of Object.values(card.audio ?? {})) files.add(path);
  for (const path of Object.values(card.promptAudio ?? {})) files.add(path);
}
for (const file of [...files].sort()) {
  const source = join(dir, file);
  if (!existsSync(source)) throw new Error(`Missing ${file}`);
  zip.file(file, readFileSync(source));
}

const output = join(dir, "verbs_v2.zip");
writeFileSync(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Built ${output} (${files.size} media files)`);
