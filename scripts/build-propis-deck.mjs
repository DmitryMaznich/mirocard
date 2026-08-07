import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";

const TOPIC_PATH = "tools/propis/topic.json";
const EXPECTED_VERSION = "1.3.0";
const ZIP_PATH = `public/decks/propis_v${EXPECTED_VERSION}.zip`;
const CATALOG_PATH = "public/decks/catalog.json";

const topic = JSON.parse(readFileSync(TOPIC_PATH, "utf-8"));
if (topic.meta.version !== EXPECTED_VERSION) {
  throw new Error(
    `${TOPIC_PATH} meta.version is "${topic.meta.version}", expected "${EXPECTED_VERSION}". ` +
    "Bump meta.version (and this script's EXPECTED_VERSION for the next release) before building."
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
  version: EXPECTED_VERSION,
  url: `./decks/propis_v${EXPECTED_VERSION}.zip`,
};
writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
console.log(`✓ ${CATALOG_PATH} updated to v${EXPECTED_VERSION}`);
