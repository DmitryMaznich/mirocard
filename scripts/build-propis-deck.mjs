import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const TOPIC_DIR = "tools/propis";
const TOPIC_PATH = `${TOPIC_DIR}/topic.json`;
const ELEMENTS_PATH = `${TOPIC_DIR}/elements.json`;
const CATALOG_PATH = "public/decks/catalog.json";
// Ready-made print PDFs (print/) + their card thumbnails (thumbnails/), migrated in from the
// standalone print_materials topic (2026-09-15) for the new "print_materials"/"browse" mode.
// Bundled the same way tools/comparison/build.mjs bundles its own media/ folder -- every file
// under these dirs ships in the zip under the same relative path topic.json's `items[].files`/
// `thumbnail` fields reference, so nothing else needs to know these are binary.
const ASSET_DIRS = ["print", "thumbnails"];

const topic = JSON.parse(readFileSync(TOPIC_PATH, "utf-8"));
// Pre-writing elements (крючки, петли, заборчики...) live in their own file, not directly in
// topic.json -- it's actively growing via scripts/propis_ingest_elements.mjs (11/27 captured
// as of 2026-09-17) and would otherwise churn topic.json's diff on every single capture.
// Merged into the SHIPPED topic.json here, the same way ASSET_DIRS merges binary files below,
// so the source files stay separate but the deck itself carries everything read_lines'
// "Элементы букв" option needs (PrintPageView.jsx reads topicRecord.elements).
if (existsSync(ELEMENTS_PATH)) {
  const { elements } = JSON.parse(readFileSync(ELEMENTS_PATH, "utf-8"));
  topic.elements = elements;
}
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

let assetCount = 0;
for (const dir of ASSET_DIRS) {
  const dirPath = join(TOPIC_DIR, dir);
  if (!existsSync(dirPath)) continue;
  for (const name of readdirSync(dirPath)) {
    const filePath = join(dirPath, name);
    if (!statSync(filePath).isFile()) continue;
    zip.file(`${dir}/${name}`, readFileSync(filePath));
    assetCount++;
  }
}

const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024 / 1024).toFixed(2)} MB, ${topic.cards.length} cards, ${topic.modes.length} modes, ${assetCount} bundled assets, ${topic.elements?.length ?? 0} elements)`);

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
