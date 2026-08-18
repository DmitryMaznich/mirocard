import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const TOPIC_PATH = "tools/propis/topic.json";
const CATALOG_PATH = "public/decks/catalog.json";

const topic = JSON.parse(readFileSync(TOPIC_PATH, "utf-8"));
const VERSION = topic.meta.version;
const ZIP_PATH = `public/decks/propis_v${VERSION}.zip`;

if (existsSync(ZIP_PATH)) {
  throw new Error(
    `${ZIP_PATH} already exists. Bump meta.version in ${TOPIC_PATH} before building again — ` +
    "the deck-versioning rule is that a version's zip is never overwritten."
  );
}

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024).toFixed(1)} KB, ${topic.cards.length} cards, ${topic.modes.length} modes)`);

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
const idx = catalog.decks.findIndex((d) => d.id === "propis");
if (idx === -1) throw new Error(`"propis" entry not found in ${CATALOG_PATH}`);
catalog.decks[idx] = {
  ...catalog.decks[idx],
  version: VERSION,
  url: `./decks/propis_v${VERSION}.zip`,
};
writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
console.log(`✓ ${CATALOG_PATH} updated to v${VERSION}`);
