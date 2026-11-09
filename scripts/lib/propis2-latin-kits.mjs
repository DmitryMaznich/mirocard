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

export function buildLatinKits(spec) {
  return spec.kits.map(({ pages, ...kit }) => ({
    ...kit,
    page: { ...spec.page, ...(kit.page ?? {}) },
    pages: pages.map((p) => (p.review ? reviewPage(p.review) : pairPage(p))),
  }));
}
