// Writing languages inside ONE `propis2` deck (docs/propis2-languages.md). A deck with `languages` (topic.json, top level) carries several
// alphabets at once — Russian, Bulgarian, Kazakh — and the student's chosen one (`writingLang` in the student-topic params) decides
// what the topic writes. A deck without `languages` (the `propis2` everyone has, the variant decks) is not touched: languageView gives
// back the very same record.
//
// A language: { id, title, status: "ready" | "draft", alphabet?, script?, papers?, coverWords?, methodology?, glyphs?, kits? }
//   alphabet / script / papers / coverWords / methodology — the same fields a variant deck puts in its meta (docs/propis2-variants.md);
//   glyphs — the language's own letter shapes over the deck's bank (`wide`, the Russian one): a glyph replaces the bank's glyph with the
//   same label or is added; kits — its ready notebooks (none: the deck's own, unless methodology is false).
// languageView(record, id) is the record as a deck of that one language: everything that reads the topic record (alphabet.js,
// pageTask.js buildGlyphMap, model.js deckPapers, the cover, Propis2Home's kits) works on it unchanged.
//
// No "@/" imports: scripts/lib/propis2-variant.mjs (Node) builds the variant decks with mergeGlyphs from here.

// The bank with a language's own glyphs laid over it. `lower`: the language's alphabet — the bank's other Cyrillic letters are dropped
// (Bulgarian: no Ё Ы Э), so a Russian ы pasted into a page is flagged «нет начертания» instead of being written in the Russian hand.
export function mergeGlyphs(bank, ownGlyphs = [], lower = null) {
  const own = new Map(ownGlyphs.map((g) => [g.label, g]));
  let wide = [...bank.map((g) => own.get(g.label) ?? g), ...[...own.values()].filter((g) => !bank.some((b) => b.label === g.label))];
  // a bank glyph's alias naming an own glyph would win over it (aliases are mapped last: the Russian «п1» is also «п», «г1» «г»)
  wide = wide.map((g) => (g.aliases?.some((a) => own.has(a)) && !own.has(g.label) ? { ...g, aliases: g.aliases.filter((a) => !own.has(a)) } : g));
  if (lower) {
    const keep = new Set([...lower, ...lower.toUpperCase()]);
    const foreign = (s) => /^[а-яё]$/i.test(s) && !keep.has(s);
    wide = wide.filter((g) => !foreign(g.label)).map((g) => (g.aliases?.some(foreign) ? { ...g, aliases: g.aliases.filter((a) => !foreign(a)) } : g));
  }
  return wide;
}

export const deckLanguages = (record) => (Array.isArray(record?.languages) && record.languages.length ? record.languages : null);

// the languages a user is offered: drafts only to the admin
export const offeredLanguages = (record, isAdmin = false) => (deckLanguages(record) ?? []).filter((l) => l.status !== "draft" || isAdmin);

// the language the topic writes: the chosen one when the deck has it, else the deck's first
export function pickLanguage(record, wanted) {
  const langs = deckLanguages(record);
  if (!langs) return null;
  return (langs.find((l) => l.id === wanted) ?? langs[0]).id;
}

const views = new WeakMap(); // record -> Map(lang id -> view)
export function languageView(record, langId) {
  const langs = deckLanguages(record);
  if (!langs) return record;
  const lang = langs.find((l) => l.id === langId) ?? langs[0];
  let byLang = views.get(record);
  if (!byLang) { byLang = new Map(); views.set(record, byLang); }
  if (byLang.has(lang.id)) return byLang.get(lang.id);
  const methodology = lang.methodology !== false;
  const view = {
    ...record,
    wide: mergeGlyphs(record.wide ?? [], lang.glyphs ?? [], lang.alphabet?.lower ?? null),
    // the methodology sheets and ready notebooks are Russian letters and words: a language without them has only its own kits
    wideSheets: methodology ? record.wideSheets : {},
    kits: lang.kits?.length ? lang.kits : methodology ? record.kits : undefined,
    meta: {
      ...record.meta,
      alphabet: lang.alphabet,
      script: lang.script,
      papers: lang.papers,
      coverWords: lang.coverWords,
      methodology: methodology ? record.meta?.methodology : false,
      writingLang: lang.id,
    },
  };
  byLang.set(lang.id, view);
  return view;
}

// The language a notebook (or the draft of one) is written in: notebooks made before the deck had languages carry none and are Russian.
export const DEFAULT_LANG = "ru";
export const langOf = (item) => item?.lang ?? DEFAULT_LANG;
