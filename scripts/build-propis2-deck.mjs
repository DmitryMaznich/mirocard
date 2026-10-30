import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { applyVariant, variantKits } from "./lib/propis2-variant.mjs";

// `propis2` deck: topic.json + glyph data merged from the shared tools/propis sources
// (wide.json, elements.json), exactly as build-propis-deck.mjs does for `propis` («Прописи старые»). No renderer bundle:
// like `propis`, the renderer lives in the app (src/topics/renderers/propis2).
//
// `--variant <id>` builds a VARIANT deck instead (docs/propis2-variants.md): the same topic with the data of
// tools/propis2/variants/<id>/variant.json laid over it — its own id, title, alphabet, modes, dictation words/texts and the glyphs
// that differ (replacing the base glyph of the same label). Same renderer, no code of its own.
const TOPIC_PATH = "tools/propis2/topic.json";
const ELEMENTS_PATH = "tools/propis/elements.json";
const WIDE_PATH = "tools/propis/wide.json";
// «части букв» from the owner's sheet (tools/propis2/parts/README.md): element glyphs of propis2 only, appended after the shared ones
const PARTS_PATH = "tools/propis2/parts_elements.json";
// stable numbers of the elements (tools/propis2/element_numbers.json): the badge on a tile of the element list and the field code {эN}
const NUMBERS_PATH = "tools/propis2/element_numbers.json";
const CATALOG_PATH = "public/decks/catalog.json";

const variantId = (() => {
  const i = process.argv.indexOf("--variant");
  return i === -1 ? null : process.argv[i + 1];
})();
if (variantId !== null && !/^[a-z]+$/.test(variantId ?? "")) throw new Error("--variant needs an id (tools/propis2/variants/<id>)");
const VARIANT_PATH = variantId && `tools/propis2/variants/${variantId}/variant.json`;
const variant = variantId ? JSON.parse(readFileSync(VARIANT_PATH, "utf-8")) : null;

const topic = JSON.parse(readFileSync(TOPIC_PATH, "utf-8"));
const DROPPED = new Set(JSON.parse(readFileSync("tools/propis2/dropped_elements.json", "utf-8")).ids);
if (existsSync(ELEMENTS_PATH)) topic.elements = JSON.parse(readFileSync(ELEMENTS_PATH, "utf-8")).elements.filter((el) => !DROPPED.has(el.id));
if (existsSync(WIDE_PATH)) {
  const wideData = JSON.parse(readFileSync(WIDE_PATH, "utf-8"));
  topic.wide = wideData.glyphs;
  topic.wideSheets = wideData.sheets ?? {};
  topic.wideElementRepeat = wideData.elementRepeat ?? {};
  if (existsSync(PARTS_PATH)) topic.wide = [...topic.wide, ...JSON.parse(readFileSync(PARTS_PATH, "utf-8")).glyphs];
}
if (existsSync(NUMBERS_PATH)) topic.elementNumbers = JSON.parse(readFileSync(NUMBERS_PATH, "utf-8")).numbers;
if (variant) applyVariant(topic, variant);
// the variant's ready notebooks (variant.json `kits`, built from the base kits): carried in the deck, Propis2Home takes them over its own
if (variant?.kits?.length) topic.kits = variantKits(variant, JSON.parse(readFileSync("src/topics/renderers/propis2/kits.json", "utf-8")).kits);

const ID = topic.meta.id;
const VERSION = topic.meta.version;
const ZIP_PATH = `public/decks/${ID}_v${VERSION}.zip`;
if (existsSync(ZIP_PATH)) {
  throw new Error(`${ZIP_PATH} already exists. Bump meta.version in ${VARIANT_PATH ?? TOPIC_PATH} before building again.`);
}

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024).toFixed(0)} KB, ${topic.wide?.length ?? 0} glyphs, ${Object.keys(topic.wideSheets ?? {}).length} sheets, ${topic.elements?.length ?? 0} elements)`);

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
const entry = variant
  ? { id: ID, version: VERSION, title: variant.catalog.title, description: variant.catalog.description, url: `./decks/${ID}_v${VERSION}.zip`, status: variant.catalog.status, access: variant.catalog.access }
  : {
    id: "propis2",
    version: VERSION,
    title: { ru: topic.meta.title, en: "Copybook" },
    description: {
      ru: "Конструктор тетрадей по письму и тренажёры письменных букв: страницы из элементов, букв, слов, цифр и текстов, показ анимации, печать; режимы «Узнай букву», «Строчная и заглавная», «Диктант».",
      en: "Handwriting notebook builder and written-letter trainers: pages of elements, letters, words, digits and texts, pen animation, printing; modes: Recognise the letter, Upper and lower case, Dictation.",
    },
    url: `./decks/propis2_v${VERSION}.zip`,
    status: "release",
    access: "paid",
  };
const idx = catalog.decks.findIndex((d) => d.id === ID);
if (idx === -1) {
  const after = catalog.decks.findIndex((d) => d.id === (variant ? "propis2" : "propis"));
  catalog.decks.splice(after === -1 ? catalog.decks.length : after + 1, 0, entry);
} else {
  catalog.decks[idx] = { ...catalog.decks[idx], ...entry };
}
writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
console.log(`✓ ${CATALOG_PATH} updated (${ID} v${VERSION})`);
