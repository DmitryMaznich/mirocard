import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

// «Прописи 2» deck: topic.json + glyph data merged from the shared tools/propis sources
// (wide.json, elements.json), exactly as build-propis-deck.mjs does for v1. No renderer bundle:
// like v1, the renderer lives in the app (src/topics/renderers/propis2).
const TOPIC_PATH = "tools/propis2/topic.json";
const ELEMENTS_PATH = "tools/propis/elements.json";
const WIDE_PATH = "tools/propis/wide.json";
const CATALOG_PATH = "public/decks/catalog.json";

const topic = JSON.parse(readFileSync(TOPIC_PATH, "utf-8"));
if (existsSync(ELEMENTS_PATH)) topic.elements = JSON.parse(readFileSync(ELEMENTS_PATH, "utf-8")).elements;
if (existsSync(WIDE_PATH)) {
  const wideData = JSON.parse(readFileSync(WIDE_PATH, "utf-8"));
  topic.wide = wideData.glyphs;
  topic.wideSheets = wideData.sheets ?? {};
  topic.wideElementRepeat = wideData.elementRepeat ?? {};
}
const VERSION = topic.meta.version;
const ZIP_PATH = `public/decks/propis2_v${VERSION}.zip`;
if (existsSync(ZIP_PATH)) {
  throw new Error(`${ZIP_PATH} already exists. Bump meta.version in ${TOPIC_PATH} before building again.`);
}

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024).toFixed(0)} KB, ${topic.wide?.length ?? 0} glyphs, ${Object.keys(topic.wideSheets ?? {}).length} sheets, ${topic.elements?.length ?? 0} elements)`);

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
const entry = {
  id: "propis2",
  version: VERSION,
  title: { ru: "Прописи 2", en: "Copybook 2" },
  description: {
    ru: "Конструктор страниц прописей: соберите страницу из элементов, букв, слов и текстов; ребёнок пишет на бумаге и смотрит анимацию написания.",
    en: "Copybook page builder: compose a page of elements, letters, words and texts; the child writes on paper and watches the pen animation.",
  },
  url: `./decks/propis2_v${VERSION}.zip`,
  status: "beta",
  access: "paid",
};
const idx = catalog.decks.findIndex((d) => d.id === "propis2");
if (idx === -1) {
  const after = catalog.decks.findIndex((d) => d.id === "propis");
  catalog.decks.splice(after === -1 ? catalog.decks.length : after + 1, 0, entry);
} else {
  catalog.decks[idx] = { ...catalog.decks[idx], ...entry };
}
writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
console.log(`✓ ${CATALOG_PATH} updated (propis2 v${VERSION})`);
