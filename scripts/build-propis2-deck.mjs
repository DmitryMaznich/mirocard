import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { applyVariant, variantKits } from "./lib/propis2-variant.mjs";
import { simplifyGlyphs } from "./lib/simplify-path.mjs";

// `propis2` deck: topic.json + glyph data merged from the shared tools/handwriting/cyrillic sources
// (wide.json, elements.json), exactly as build-propis-deck.mjs does for `propis` («Прописи старые»). No renderer bundle:
// like `propis`, the renderer lives in the app (src/topics/renderers/propis2).
//
// `--variant <id>` builds a VARIANT deck instead (docs/propis2-variants.md): the same topic with the data of
// tools/propis2/variants/<id>/variant.json laid over it — its own id, title, alphabet, modes, dictation words/texts and the glyphs
// that differ (replacing the base glyph of the same label). Same renderer, no code of its own.
//
// The `propis2` deck carries its writing languages (docs/propis2-languages.md, since v0.6.0): tools/propis2/languages.json lists them,
// each its alphabet, writing, papers, cover words, letters and ready notebooks (taken from a variant.json with `from`). A notebook
// remembers its language (src/topics/renderers/propis2/languages.js). The variant decks (`--variant`) carry one alphabet, no languages.
const TOPIC_PATH = "tools/propis2/topic.json";
const ELEMENTS_PATH = "tools/handwriting/cyrillic/elements.json";
const WIDE_PATH = "tools/handwriting/cyrillic/wide.json";
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
const LANGUAGES_PATH = variantId ? null : "tools/propis2/languages.json";
// `--test-copy`: the test copy of the deck (id `propis2_lang`, catalog `individual`: the owner's account only) WITH the languages
// still in the making (`status: "draft"`, docs/latin-letters.md). The ordinary build leaves the drafts out — users never see them.
const testCopy = process.argv.includes("--test-copy");
if (testCopy && variantId) throw new Error("--test-copy builds the languages deck, not a variant");
const TEST_COPY_PATH = "tools/propis2/test-copy.json";
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
if (existsSync(NUMBERS_PATH)) {
  const nd = JSON.parse(readFileSync(NUMBERS_PATH, "utf-8"));
  topic.elementNumbers = nd.numbers;
  topic.elementGroups = nd.groups ?? [];
  topic.elementRetired = nd.retired ?? {};
}
// variant.json `simplifyGlyphs` (a tolerance, glyph units): the variant's own letters traced too densely are refitted with fewer
// Bézier segments (scripts/lib/simplify-path.mjs); the traced source in variant.json stays as it is
if (variant?.simplifyGlyphs) {
  const r = simplifyGlyphs(variant.glyphs ?? [], variant.simplifyGlyphs);
  variant.glyphs = r.glyphs;
  console.log(`✓ glyph paths simplified (tolerance ${variant.simplifyGlyphs}): ${r.before} -> ${r.after} numbers, worst deviation ${r.worst.dev.toFixed(3)} (${r.worst.label})`);
}
if (variant) applyVariant(topic, variant);
const langSpec = LANGUAGES_PATH ? JSON.parse(readFileSync(LANGUAGES_PATH, "utf-8")) : null;
if (langSpec) {
  // (the dictation stays: Russian only — its words, texts and recordings are Russian; engine.js makes it in the deck's first language)
  const baseKits = JSON.parse(readFileSync("src/topics/renderers/propis2/kits.json", "utf-8")).kits;
  const skipped = langSpec.languages.filter((l) => l.status === "draft" && !testCopy).map((l) => l.id);
  if (skipped.length) console.log(`  (draft languages left out: ${skipped.join(", ")} — they go into the --test-copy deck)`);
  topic.languages = langSpec.languages.filter((l) => testCopy || l.status !== "draft").map((spec) => {
    const { from, glyphsFrom, ...lang } = spec;
    if (from) {
      const v = JSON.parse(readFileSync(from, "utf-8"));
      const glyphs = v.simplifyGlyphs ? simplifyGlyphs(v.glyphs ?? [], v.simplifyGlyphs).glyphs : v.glyphs ?? [];
      const { alphabet, script, papers, coverWords, methodology } = v.meta;
      Object.assign(lang, { alphabet, script, papers, coverWords, methodology, glyphs, kits: v.kits?.length ? variantKits(v, baseKits) : undefined }, Object.fromEntries(Object.entries(lang).filter(([k]) => !["id", "title", "status"].includes(k))));
    }
    if (glyphsFrom) lang.glyphs = JSON.parse(execFileSync(glyphsFrom[0], glyphsFrom.slice(1), { encoding: "utf-8", maxBuffer: 64 << 20 }));
    // a writing style's letters from their own file (`glyphsFile`, e.g. the English print letters, tools/handwriting/latin/print.json)
    if (Array.isArray(lang.styles)) lang.styles = lang.styles.map(({ glyphsFile, ...st }) => (glyphsFile ? { ...st, glyphs: JSON.parse(readFileSync(glyphsFile, "utf-8")).glyphs } : st));
    const lower = lang.alphabet?.lower;
    const styleGlyphs = (lang.styles ?? []).flatMap((st) => st.glyphs ?? []);
    const missing = lower ? [...lower].filter((ch) => !topic.wide.some((g) => g.label === ch || g.aliases?.includes(ch)) && !lang.glyphs?.some((g) => g.label === ch) && !styleGlyphs.some((g) => g.label === ch)) : [];
    console.log(`  ${lang.id} ${lang.title} (${lang.status}): ${lang.glyphs?.length ?? 0} own glyphs${missing.length ? `, no letter yet: ${missing.join(" ")}` : ""}`);
    return lang;
  });
  // the letter cards are made in the language chosen in the mode's settings (`writingLang`, read by propis2/engine.js), not in the
  // student's: one «student» may be a whole class, and a child may write in two languages
  for (const m of topic.modes) {
    if (!["letters_recognize", "letters_case"].includes(m.type)) continue;
    m.params = {
      writingLang: {
        type: "enum",
        label: { ru: "Язык" },
        values: topic.languages.map((l) => l.id),
        labels: { ru: Object.fromEntries(topic.languages.map((l) => [l.id, l.title])) },
        default: topic.languages[0].id,
      },
      ...(m.params ?? {}),
    };
  }
}
// the variant's ready notebooks (variant.json `kits`, built from the base kits): carried in the deck, Propis2Home takes them over its own
if (variant?.kits?.length) topic.kits = variantKits(variant, JSON.parse(readFileSync("src/topics/renderers/propis2/kits.json", "utf-8")).kits);

if (testCopy) {
  const tc = JSON.parse(readFileSync(TEST_COPY_PATH, "utf-8"));
  topic.meta = { ...topic.meta, id: "propis2_lang", version: tc.version, title: tc.title.ru };
}
const ID = topic.meta.id;
const VERSION = topic.meta.version;
const ZIP_PATH = `public/decks/${ID}_v${VERSION}.zip`;
if (existsSync(ZIP_PATH)) {
  throw new Error(`${ZIP_PATH} already exists. Bump meta.version in ${VARIANT_PATH ?? (testCopy ? TEST_COPY_PATH : TOPIC_PATH)} before building again.`);
}

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024).toFixed(0)} KB, ${topic.wide?.length ?? 0} glyphs, ${Object.keys(topic.wideSheets ?? {}).length} sheets, ${topic.elements?.length ?? 0} elements)`);

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
const own = variant ?? (testCopy ? JSON.parse(readFileSync(TEST_COPY_PATH, "utf-8")) : null);
const entry = own
  ? { id: ID, version: VERSION, title: (own.catalog ?? own).title, description: (own.catalog ?? own).description, url: `./decks/${ID}_v${VERSION}.zip`, status: (own.catalog ?? own).status, access: (own.catalog ?? own).access }
  : {
    id: "propis2",
    version: VERSION,
    title: { ru: topic.meta.title, en: "Copybook" },
    description: {
      ru: "Конструктор тетрадей по письму и тренажёры письменных букв на русском, болгарском и казахском: страницы из элементов, букв, слов, цифр и текстов, показ анимации, печать; режимы «Узнай букву», «Строчная и заглавная», «Диктант».",
      en: "Handwriting notebook builder and written-letter trainers in Russian, Bulgarian and Kazakh: pages of elements, letters, words, digits and texts, pen animation, printing; modes: Recognise the letter, Upper and lower case, Dictation.",
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
