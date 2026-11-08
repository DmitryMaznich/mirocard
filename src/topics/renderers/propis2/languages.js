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

// Writing styles of a language (docs/latin-letters.md, step 3.1): a language may list `styles` — [{ id, title, glyphs?, script?, papers? }],
// e.g. English print and English cursive. A style lays its own letters over the language's, and its script (slant, proportions) and papers
// replace the language's. The STYLE belongs to the notebook, like the language (`style` next to `lang`); a notebook without one, or a
// language without styles, writes in the language's first style — and a language without `styles` is exactly as before.
export const langStyles = (lang) => (Array.isArray(lang?.styles) && lang.styles.length ? lang.styles : null);
const langOfDeck = (record, langId) => { const langs = deckLanguages(record); return langs ? langs.find((l) => l.id === langId) ?? langs[0] : null; };
// the style a notebook of this language writes in: the wanted one when the language has it, else its first; null without styles
export function pickStyle(record, langId, wanted) {
  const styles = langStyles(langOfDeck(record, langId));
  if (!styles) return null;
  return (styles.find((st) => st.id === wanted) ?? styles[0]).id;
}
export const styleOf = (item) => item?.style ?? null;

const views = new WeakMap(); // record -> Map(lang id [| style id] -> view)
export function languageView(record, langId, styleId = null) {
  const langs = deckLanguages(record);
  if (!langs) return record;
  const lang = langs.find((l) => l.id === langId) ?? langs[0];
  const styles = langStyles(lang);
  const style = styles ? styles.find((st) => st.id === styleId) ?? styles[0] : null;
  const key = style ? `${lang.id}|${style.id}` : lang.id;
  let byLang = views.get(record);
  if (!byLang) { byLang = new Map(); views.set(record, byLang); }
  if (byLang.has(key)) return byLang.get(key);
  const methodology = lang.methodology !== false;
  const lower = lang.alphabet?.lower ?? null;
  const langWide = mergeGlyphs(record.wide ?? [], lang.glyphs ?? [], lower);
  const view = {
    ...record,
    wide: style?.glyphs?.length ? mergeGlyphs(langWide, style.glyphs, lower) : langWide,
    // the methodology sheets and ready notebooks are Russian letters and words: a language without them has only its own kits
    wideSheets: methodology ? record.wideSheets : {},
    kits: lang.kits?.length ? lang.kits : methodology ? record.kits : undefined,
    meta: {
      ...record.meta,
      alphabet: lang.alphabet,
      script: style?.script ?? lang.script,
      papers: style?.papers ?? lang.papers,
      coverWords: lang.coverWords,
      methodology: methodology ? record.meta?.methodology : false,
      writingLang: lang.id,
      ...(style ? { writingStyle: style.id } : {}),
    },
  };
  byLang.set(key, view);
  return view;
}

// The language a notebook (or the draft of one) is written in: notebooks made before the deck had languages carry none and are Russian.
export const DEFAULT_LANG = "ru";
export const langOf = (item) => item?.lang ?? DEFAULT_LANG;

// Notebooks made before their deck had languages carry none and count as Russian — except the Bulgarian customer's, made in the
// Bulgarian variant deck (`propis2_bg`): a notebook with a page on the Bulgarian paper (`gridKind: "bg"`, offered only by that deck) is
// Bulgarian. (owner 2026-11-01: his Russian notebooks, if any, do not matter.)
// v1.0.2758 tagged Bulgarian EVERY untagged notebook of an account that owned `propis2_bg` — the owner's own Russian notebooks too (he
// had it for testing). Undone here: a notebook it tagged Bulgarian (made before that release) with no page on the Bulgarian paper is
// Russian again. A tagged notebook is otherwise never touched; `updatedAt` moves so the fix wins over the wrong copy on other devices.
export const LEGACY_LANG_CUTOFF = Date.parse("2026-11-01T16:40:00Z");
export function fixLegacyNotebookLangs(lib, record, now = Date.now()) {
  if (!deckLanguages(record)?.some((l) => l.id === "bg") || !lib?.sets?.length) return lib;
  const byId = new Map((lib.pages ?? []).map((p) => [p.id, p]));
  const onBgPaper = (st) => (st.pageIds ?? []).some((id) => byId.get(id)?.gridKind === "bg");
  let changed = false;
  const sets = lib.sets.map((st) => {
    if (!st.lang && onBgPaper(st)) { changed = true; return { ...st, lang: "bg", updatedAt: now }; }
    if (st.lang === "bg" && !onBgPaper(st) && (st.createdAt ?? 0) < LEGACY_LANG_CUTOFF) { changed = true; return { ...st, lang: "ru", updatedAt: now }; }
    return st;
  });
  return changed ? { ...lib, sets } : lib;
}
// the language most of the library is in (the first language a new notebook gets, until one is picked on this device)
export function mostUsedLang(lib) {
  const n = {};
  for (const st of lib?.sets ?? []) n[langOf(st)] = (n[langOf(st)] ?? 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
