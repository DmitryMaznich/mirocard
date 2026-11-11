import JSZip from "jszip";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { buildLatinKits } from "./lib/propis2-latin-kits.mjs";
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
// `--latin`: «Прописи: латиница» (id `propis2_lang`, tools/propis2/latin.json; owner, 2026-11-09: Cyrillic and Latin are two decks, too
// many languages and styles in one) -- the same engine and renderer, built from data only, with ONLY the languages marked
// `deck: "latin"` in languages.json (English), drafts included, and without the dictation (Russian only). The ordinary build never
// takes a `deck: "latin"` language, nor a draft one.
const latin = process.argv.includes("--latin");
if (latin && variantId) throw new Error("--latin builds the Latin deck, not a variant");
const LATIN_PATH = "tools/propis2/latin.json";
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
  const inDeck = (l) => (latin ? l.deck === "latin" : l.deck !== "latin" && l.status !== "draft");
  const skipped = langSpec.languages.filter((l) => !inDeck(l)).map((l) => l.id);
  if (skipped.length) console.log(`  (languages left out of this deck: ${skipped.join(", ")})`);
  topic.languages = langSpec.languages.filter(inDeck).map((spec) => {
    const { from, glyphsFrom, deck: _deck, kitsFile, ...lang } = spec;
    // a language's own ready notebooks from their content list (`kitsFile`, the Latin series: scripts/lib/propis2-latin-kits.mjs)
    if (kitsFile) lang.kits = buildLatinKits(JSON.parse(readFileSync(kitsFile, "utf-8")));
    if (from) {
      const v = JSON.parse(readFileSync(from, "utf-8"));
      const glyphs = v.simplifyGlyphs ? simplifyGlyphs(v.glyphs ?? [], v.simplifyGlyphs).glyphs : v.glyphs ?? [];
      const { alphabet, script, papers, coverWords, methodology } = v.meta;
      Object.assign(lang, { alphabet, script, papers, coverWords, methodology, glyphs, kits: v.kits?.length ? variantKits(v, baseKits) : undefined }, Object.fromEntries(Object.entries(lang).filter(([k]) => !["id", "title", "status"].includes(k))));
    }
    if (glyphsFrom) lang.glyphs = JSON.parse(execFileSync(glyphsFrom[0], glyphsFrom.slice(1), { encoding: "utf-8", maxBuffer: 64 << 20 }));
    // a writing style's letters from their own file (`glyphsFile`, e.g. the English print letters, tools/handwriting/latin/print.json)
    // `like`: a style made from another one of the language (the Nelson slanted hand = the joined one leaned, docs/latin-letters.md): its
    // letters file and script, the style's own `script` fields over them (`slantDeg`, `sourceSlantDeg`); the joins stay in one place
    if (Array.isArray(lang.styles)) {
      const byId = new Map(lang.styles.map((st) => [st.id, st]));
      lang.styles = lang.styles.map(({ like, ...st }) => {
        if (!like) return st;
        const base = byId.get(like);
        if (!base || base.like) throw new Error(`style ${st.id}: like "${like}" is not a style of ${lang.id} made from data of its own`);
        return { glyphsFile: base.glyphsFile, papers: base.papers, ...st, script: { ...base.script, ...st.script } };
      });
    }
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
    if (topic.languages.length === 1) continue; // one language («Прописи: латиница»): nothing to choose
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
  // a language with several writing styles (docs/latin-letters.md: English print / British): the cards' style, `writingStyle`
  // (engine.js passes it to languageView); offered only when some language of this deck has more than one
  const styled = topic.languages.filter((l) => (l.styles?.length ?? 0) > 1);
  if (styled.length) {
    const opts = styled.flatMap((l) => l.styles.map((st) => [st.id, topic.languages.length === 1 ? st.title : `${st.title} (${l.title})`]));
    for (const m of topic.modes) {
      if (!["letters_recognize", "letters_case"].includes(m.type)) continue;
      const params = { ...m.params };
      const { writingLang, ...rest } = params;
      m.params = { ...(writingLang ? { writingLang } : {}), writingStyle: { type: "enum", label: { ru: "Стиль письма" }, values: opts.map(([id]) => id), labels: { ru: Object.fromEntries(opts) }, default: opts[0][0] }, ...rest };
    }
  }
}
// the variant's ready notebooks (variant.json `kits`, built from the base kits): carried in the deck, Propis2Home takes them over its own
if (variant?.kits?.length) topic.kits = variantKits(variant, JSON.parse(readFileSync("src/topics/renderers/propis2/kits.json", "utf-8")).kits);

if (latin) {
  const tc = JSON.parse(readFileSync(LATIN_PATH, "utf-8"));
  // its own description for the topic card (latin.json `about`: the Nelson scheme, no dictation), not propis2's
  topic.meta = { ...topic.meta, id: "propis2_lang", version: tc.version, title: tc.title.ru, ...(tc.about ? { about: tc.about } : {}), ...(tc.avatar ? { avatar: tc.avatar } : {}) };
  // the dictation is Russian (its words, texts and recordings): not in the Latin deck
  topic.modes = topic.modes.filter((m) => m.type !== "dictation");
}
const ID = topic.meta.id;
const VERSION = topic.meta.version;
const ZIP_PATH = `public/decks/${ID}_v${VERSION}.zip`;
if (existsSync(ZIP_PATH)) {
  throw new Error(`${ZIP_PATH} already exists. Bump meta.version in ${VARIANT_PATH ?? (latin ? LATIN_PATH : TOPIC_PATH)} before building again.`);
}

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(topic, null, 2));
const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(ZIP_PATH, buffer);
console.log(`✓ ${ZIP_PATH} (${(buffer.length / 1024).toFixed(0)} KB, ${topic.wide?.length ?? 0} glyphs, ${Object.keys(topic.wideSheets ?? {}).length} sheets, ${topic.elements?.length ?? 0} elements)`);

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
const own = variant ?? (latin ? JSON.parse(readFileSync(LATIN_PATH, "utf-8")) : null);
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
