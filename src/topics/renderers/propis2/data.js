// Ready sheets (methodology pages) usable as templates, in page order. The glyph bank, sheets
// and elements themselves come from the installed deck (topicRecord.wide / wideSheets /
// elements / wideElementRepeat), merged from tools/propis by scripts/build-propis2-deck.mjs.
// The workbook of the methodology (wide.json `sheets`): the first part is written on the WIDE ruling, the second on the NARROW one
// (the same split as the `propis` «Листы методики»: part 1 = part1 + page3..page7, part 2 = part2 + page8..page18). Each part is one ready notebook,
// so a notebook keeps one ruling. [sheet id, page title].
export const PROPIS2_METHOD_NOTEBOOKS = [
  {
    id: "method-1",
    title: "Листы методики, часть 1 (широкая строка)",
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
    title: "Листы методики, часть 2 (узкая строка)",
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

// The ready notebooks are ONE series (owner, 2026-10-23; docs/propis2-series-plan.md): 16 notebooks of 24 A5 pages each, in the order a
// primary teacher and a speech therapist for children with ASD would lay writing out — elements, the letters inside the row on the wide
// row, the narrow row, loops and the letters below/above the row, capitals, joins, words, marks, copying a text. The methodology sheets
// (the teacher's method) are no longer ready notebooks of their own: their content is spread over the series (tools/propis2/build_kits.py).
// The step is in the title («1. …»). Not steps, after the series in their own order: the digits and the blank notebooks.
export const PROPIS2_LADDER = [
  "s01-sticks", "s02-hooks", "s03-letters-i", "s04-letters-l", "s05-letters-e", "s06-narrow", "s07-loops", "s08-letters-r",
  "s09-letters-b", "s10-capitals-1", "s11-capitals-2", "s12-syllables", "s13-words", "s14-phrases", "punctuation", "texts",
];
export const ladderIndex = (id) => { const i = PROPIS2_LADDER.indexOf(id); return i < 0 ? PROPIS2_LADDER.length : i; };

// Titles ready notebooks had before: a copy the adult already took keeps the title it was given, so a copy that still has one of these
// (never renamed) follows the ready notebook's current title (storage.js retitleKitCopies).
export const PROPIS2_OLD_TITLES = {
  texts: ["Тетрадь — тексты для переписывания", "11. Списываем текст"],
  punctuation: ["10. Знаки препинания"],
  digits: ["Прописи — цифры"],
};
// Ready notebooks replaced by the series. Their copies stay the adult's own; a copy still numbered as a step of the first ladder
// («2. Простые буквы…», v1.0.2694) loses the number, so it does not read as a step of the series.
export const PROPIS2_RETIRED = ["method-1", "method-2", "letters-1", "letters-2", "alphabet-1", "alphabet-2", "syllables", "words-1", "words-2"];
