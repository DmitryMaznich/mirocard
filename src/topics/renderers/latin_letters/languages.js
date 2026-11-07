// Languages of «Латиница»: the alphabet (the letter blocks the constructor offers, in this order)
// and starter words for word blocks. A language is data; which writing styles cover it is said by
// the style (styles.js → languages). Slovenian (Č Š Ž) is planned — docs/latin-letters.md.

export const LANGUAGES = {
  en: {
    id: "en",
    title: "Английский",
    alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    // short, regular words a schoolchild meets first (CVC first, then a few common ones)
    words: [
      "cat", "dog", "pig", "hen", "fox", "bus", "sun", "bed", "pen", "hat",
      "bag", "box", "cup", "red", "big", "six", "ten", "map", "jam", "zip",
      "apple", "fish", "milk", "book", "tree", "ball", "duck", "frog", "lemon", "queen",
      "I am", "my cat", "a big dog", "I like milk",
    ],
  },
};

export const DEFAULT_LANG = "en";

export function languageOf(id) {
  return LANGUAGES[id] ?? LANGUAGES[DEFAULT_LANG];
}
