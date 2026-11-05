// `propis2` variant decks (docs/propis2-variants.md): scripts/build-propis2-deck.mjs --variant <id> and its test.
// The variant over the base topic: meta fields replace the base's (renderer and avatar stay), only the listed modes stay, words /
// texts are the variant's own (the base ones are Russian), a variant glyph replaces the base glyph of the same label (or is added).
import { mergeGlyphs } from "../../src/topics/renderers/propis2/languages.js";

export function applyVariant(base, v) {
  base.meta = { ...base.meta, ...v.meta, renderer: base.meta.renderer, variantOf: base.meta.id };
  const missing = v.modes.filter((id) => !base.modes.some((m) => m.id === id));
  if (missing.length) throw new Error(`variant modes not in the base topic: ${missing.join(", ")}`);
  base.modes = base.modes.filter((m) => v.modes.includes(m.id));
  // an empty `texts` array would make the installer take the deck for a reading topic (topicLoader validateManifest): none, not []
  delete base.words;
  delete base.texts;
  if (v.words?.length) base.words = v.words;
  if (v.texts?.length) base.texts = v.texts;
  base.wide = mergeGlyphs(base.wide, v.glyphs ?? []);
  if (v.meta.methodology === false) base.wideSheets = {}; // the methodology sheets are Russian letters and words
  // a variant with its own alphabet writes none of the base's other letters (Bulgarian: no Ё Ы Э)
  if (v.meta.alphabet?.lower) base.wide = mergeGlyphs(base.wide, [], v.meta.alphabet.lower);
}

// Ready notebooks of a variant (`v.kits`, docs/propis2-variants.md): a base kit (src/topics/renderers/propis2/kits.json) copied, its
// pages on the squared paper kept as they are (digits, numbers, signs: no letters), its pages of text replaced by the variant's own
// sentences on the variant's first paper. `spec.rows`: how many rows that paper has on an A5 page (variant.test.jsx checks it against
// model.js rowsPerPage): a sentence and an empty row under it, as many pairs as fit.
const digitsOut = (t) => t.replace(/\d/g, "№$&");
const modelRow = (t) => ({ text: digitsOut(t), kind: "text", repeat: "one", dots: "none", copies: "dash", asText: false });
const blankRow = () => ({ text: "", kind: "blank", repeat: "one", dots: "none", copies: "dash" });
// A kit of its own (`spec.wordPages`, no `from`: the Kazakh word notebooks, 2026-11-02): a page per entry, a row per word, each the
// model word and its copies fading out along the row (`repeat: "fade"`, start dots on all), on `spec.page`.
const fadeRow = (t) => ({ text: digitsOut(t), kind: "text", repeat: "fade", dots: "all", copies: "dash", gap: 1 });
function ownKit(spec) {
  const { wordPages, note, ...kit } = spec;
  return { ...kit, pages: wordPages.map((wp) => ({ title: wp.title, paper: spec.page, rows: wp.words.map(fadeRow) })) };
}

export function variantKits(v, baseKits) {
  return (v.kits ?? []).map((spec) => {
    if (spec.wordPages) return ownKit(spec);
    const rowsPerPage = spec.rows;
    const base = baseKits.find((k) => k.id === spec.from);
    if (!base) throw new Error(`variant kit: no base kit ${spec.from}`);
    const keep = base.pages.filter((p) => (p.paper ?? base.page)?.gridKind === "square");
    const textPaper = { ...(base.pages.find((p) => p.paper?.gridKind !== "square")?.paper ?? base.page), gridKind: v.meta.papers[0] };
    const textPages = spec.textPages.map((tp) => {
      const rows = tp.copy ? tp.sentences.map(modelRow) : tp.sentences.flatMap((t) => [modelRow(t), blankRow()]).slice(0, Math.floor(rowsPerPage / 2) * 2);
      while (rows.length < rowsPerPage) rows.push(blankRow());
      return { title: tp.title, paper: textPaper, rows: rows.slice(0, rowsPerPage) };
    });
    return { ...base, description: spec.description ?? base.description, pages: [...keep, ...textPages] };
  });
}
