// Ready sheets (methodology pages) usable as templates, in page order. The glyph bank, sheets
// and elements themselves come from the installed deck (topicRecord.wide / wideSheets /
// elements / wideElementRepeat), merged from tools/propis by scripts/build-propis2-deck.mjs.
// The workbook of the methodology (wide.json `sheets`): the first part is written on the WIDE ruling, the second on the NARROW one
// (the same split as the `propis` «Листы методики»: part 1 = part1 + page3..page7, part 2 = part2 + page8..page18). Each part is one ready notebook,
// so a notebook keeps one ruling. [sheet id, page title].
export const PROPIS2_METHOD_NOTEBOOKS = [
  {
    id: "method-1",
    title: "1. Элементы и первые буквы",
    description: "Широкая строка. Элементы (заборчик, палочки, петли), затем строчные из них: и й ш н г п т к л м я о а ю с е ё э х ж ч ь ы ъ — сразу в слогах и коротких словах.",
    ruling: "wide",
    sheets: [
      ["part1", "Лист 1"],
      ["page3", "Лист с л, м, я"],
      ["page4", "Лист с о"],
      ["page5", "Лист с а, ю, с"],
      ["page6", "Лист с е, ё, э, х, ж"],
      ["page7", "Лист с ч, ь, ы, ъ"],
    ],
  },
  {
    id: "method-2",
    title: "3. Сложные буквы и заглавные",
    description: "Узкая строка, частая косая. Строчные с петлями и овалами вверх и вниз: р б ф у д з в ц щ — в словах; затем все заглавные по группам формы.",
    ruling: "narrow",
    sheets: [
      ["part2", "Лист с р"],
      ["page8", "Лист с б"],
      ["page9", "Лист с ф"],
      ["page10", "Лист с у"],
      ["page11", "Лист с д, з"],
      ["page12", "Лист с в"],
      ["page13", "Лист с ц, щ"],
      ["page14", "Заглавные И, Ш, Ц, Щ, У, Ч"],
      ["page15", "Заглавные Г, П, Т, Р, Л, А"],
      ["page16", "Заглавные М, Я, О, Ф, Б, Д"],
      ["page17", "Заглавные З, В, Е, С, Э, Х, Ж"],
      ["page18", "Заглавные Н, Ю, К"],
    ],
  },
];

// The ready notebooks as ONE ladder of difficulty (owner, 2026-10-21: «выстроить в один логический ряд», as a primary teacher and a
// speech therapist for children with ASD would): the methodology sheets (the teacher's method) and the kits (kits.json) interleaved, one
// new demand at a time — first the bigger wide row and the elements, then the narrow row with the same simple letters, then the hard
// forms, the alphabet as a review, joins, words, digits, marks, and copying whole texts last. The step is in the title («1. …»).
// Blank notebooks are not steps: they stay after the ladder, in their own order.
export const PROPIS2_LADDER = [
  "method-1", // 1. elements and the first lowercase letters, wide row
  "letters-1", // 2. the same simple forms, one letter at a time, lowercase and capital, narrow row
  "method-2", // 3. the hard lowercase forms and all capitals, in words
  "letters-2", // 4. the hard forms one letter at a time
  "alphabet-1", // 5-6. review: every letter in alphabet order
  "alphabet-2",
  "syllables", // 7. joins: a consonant and a vowel
  "words-1", // 8. words of the simple forms
  "words-2", // 9. words with any letters
  "digits", // 10. digits (a track of its own, squared paper: can go along with steps 5-9)
  "punctuation", // 11. full stop, comma, ! and ? — in words and sentences
  "texts", // 12. copying a whole text
];
export const ladderIndex = (id) => { const i = PROPIS2_LADDER.indexOf(id); return i < 0 ? PROPIS2_LADDER.length : i; };

// Titles the ready notebooks had before the ladder: a copy the adult already took keeps the title it was given, so a copy that still
// has the old one (never renamed) follows the ready notebook's new title (storage.js retitleKitCopies).
export const PROPIS2_OLD_TITLES = {
  "method-1": "Листы методики, часть 1 (широкая строка)",
  "method-2": "Листы методики, часть 2 (узкая строка)",
  "letters-1": "Прописи — часть 1 (простые формы)",
  "letters-2": "Прописи — часть 2 (сложные формы)",
  syllables: "Прописи — соединения букв",
  "words-1": "Прописи — слова, часть 1 (простые формы)",
  "words-2": "Прописи — слова, часть 2 (любые буквы)",
  texts: "Тетрадь — тексты для переписывания",
  digits: "Прописи — цифры",
};
