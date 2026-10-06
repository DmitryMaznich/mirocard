// Ready sheets (methodology pages) usable as templates, in page order. The glyph bank, sheets
// and elements themselves come from the installed deck (topicRecord.wide / wideSheets /
// elements / wideElementRepeat), merged from tools/propis by scripts/build-propis2-deck.mjs.
// The workbook of the methodology (wide.json `sheets`): the first part is written on the WIDE ruling, the second on the NARROW one
// (the same split as the v1 «Листы методики»: part 1 = part1 + page3..page7, part 2 = part2 + page8..page18). Each part is one ready notebook,
// so a notebook keeps one ruling. [sheet id, page title].
export const PROPIS2_METHOD_NOTEBOOKS = [
  {
    id: "method-1",
    title: "Листы методики, часть 1 (широкая строка)",
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
