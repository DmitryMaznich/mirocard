// Ready notebooks of «Прописи: латиница» (tools/propis2/latin-kits.json, docs/latin-letters.md): a page per pair of letters with one
// kind of join, built to one plan on the deck's British paper (5 mm, 10 rows on A5 — latinKits.test.jsx checks it against model.js):
//   the pair as a pattern («inin»), traced all along the row;
//   the pair traced all along, then fading out, then the model once and the child's own;
//   three words with the pair, each fading out, then once and the child's own.
// The last page of a notebook (`review`): five words, each fading out and then on its own. A kit carries its writing `style`: a copy of
// it opens in that style (Propis2Home ownCopyOf).
const row = (text, repeat, dots = "all", extra = {}) => ({ text, kind: "text", repeat, dots, copies: "dash", ...extra });
const word = (w) => [row(w, "fade", "all", { gap: 1 }), row(w, "one", "one", { asText: false })];

export function pairPage({ pair, words }) {
  return {
    title: pair,
    rows: [
      row(`${pair}${pair}`, "all"),
      row(pair, "all", "all", { gap: 1 }),
      row(pair, "fade", "all", { gap: 1 }),
      row(pair, "one", "one", { asText: false }),
      ...words.flatMap(word),
    ],
  };
}

export function reviewPage(words) {
  return { title: "Повторение", rows: words.flatMap(word) };
}

// The series after the New Nelson copymasters (2026-11-10: patterns, letters, the four joins, consonant and vowel spellings, themed words,
// sentences and poems). A page holds 10 rows (the British paper on A5); what a page lists fills them from the top, blank rows after:
//   copy    — lines of words / a sentence: the model once, the row under it blank for the child (the copymasters' «eye» and «pencil» rows);
//   trace   — words: each fading out, then once and the child's own (as the pairs' words);
//   pattern — a pattern traced all along the row, then fading out;
//   fade    — one row each, fading out (the digits).
// A page may carry its own writing `style` (the print letters in a notebook of joined writing).
const ROWS = 10;
const blank = () => ({ kind: "blank" });
const fill = (rows) => [...rows, ...Array.from({ length: Math.max(0, ROWS - rows.length) }, blank)];
export function seriesPage(p) {
  let rows;
  if (p.copy) rows = p.copy.flatMap((l) => [row(l, "one", "one", { asText: false }), blank()]);
  else if (p.trace) rows = p.trace.flatMap(word);
  else if (p.pattern) rows = p.pattern.flatMap((t) => [row(t, "all"), row(t, "fade", "all")]);
  else if (p.fade) rows = p.fade.map((t) => row(t, "fade", "all", { gap: 1 }));
  else throw new Error(`a series page needs copy, trace, pattern or fade: ${p.title}`);
  if (rows.length > ROWS) throw new Error(`page «${p.title}»: ${rows.length} rows, a page holds ${ROWS}`);
  return { title: p.title, ...(p.style ? { style: p.style } : {}), rows: fill(rows) };
}

export function buildLatinKits(spec) {
  return spec.kits.map(({ pages, ...kit }) => ({
    ...kit,
    page: { ...spec.page, ...(kit.page ?? {}) },
    pages: pages.map((p) => (p.review ? reviewPage(p.review) : p.pair ? pairPage(p) : seriesPage(p))),
  }));
}
