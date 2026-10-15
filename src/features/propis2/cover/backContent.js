import { digitsOut } from "@/topics/renderers/propis2/fieldText.js";
import { newRow, rowToLine } from "@/topics/renderers/propis2/model.js";

// What the back of the cover holds (coverTasks.js / BACKS in coverConfig.js), as rows of the notebook engine: written once, without start
// dots, row after row (a compact block, as the backs of the printed series, scripts/cover_tetrad.py). `heading` is written above it
// in our own hand (coverTasks.js).

const LOWER = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
// Ъ Ы Ь have no capital, the lowercase letter stands alone; Ё and Й are there (built from Е / И and the marks of ё / й,
// propis2/glyphOverrides.js withMarkedCapitals — they were left out here before, owner 2026-10-15)
const NO_CAPITAL = new Set(["ъ", "ы", "ь"]);
// a row holds what fits the A5 width (checked on the page): at most 6 pairs, a pair weighs 2, a lone lowercase letter 1; pairs are
// three spaces apart (two cells more than the gap inside a pair, wordEngine `#v`)
const ROW_WEIGHT = 12;
const ROW_PAIRS = 6;

// spaces as typed in the editor: one is the usual gap (inside a pair: no connection runs into the lowercase letter after a space),
// two add a cell (between pairs)
const write = (text) => rowToLine(newRow({ text: digitsOut(text), repeat: "one", dots: "none" }));
const writeAll = (rows) => rows.map(write);
// the alphabet: evenly spaced (wordEngine `#v`): a short gap inside a pair «Аа», a long one between pairs, the same all along
const writeEven = (rows) => rows.map((t) => `${write(t)}#v`);

function alphabetRows() {
  const units = [...LOWER].map((l) => (NO_CAPITAL.has(l) ? l : `${l.toUpperCase()} ${l}`));
  const rows = [];
  let cur = [];
  let weight = 0;
  let pairs = 0;
  for (const u of units) {
    const pair = u.includes(" ");
    if (weight + (pair ? 2 : 1) > ROW_WEIGHT || (pair && pairs === ROW_PAIRS)) { rows.push(cur.join("   ")); cur = []; weight = 0; pairs = 0; }
    cur.push(u);
    weight += pair ? 2 : 1;
    if (pair) pairs += 1;
  }
  if (cur.length) rows.push(cur.join("   "));
  return rows;
}

const DIGITS = "0 1 2 3 4 5 6 7 8 9";
const SIGNS = [["+", "плюс"], ["-", "минус"], ["=", "равно"], [">", "больше"], ["<", "меньше"]];
const PUNCT = [[".", "точка"], [",", "запятая"], ["?", "вопрос"], ["!", "восклицание"]];

export const BACK_HEADINGS = { alphabet: "Алфавит", digits: "Цифры", signs: "Знаки", "digits-signs": "Цифры и знаки", punctuation: "Знаки препинания" };

// {heading, lines, rows}: `rows` — how many rows of the page the content takes (the heading not counted)
export function backContent(kind) {
  let lines;
  switch (kind) {
    case "alphabet":
      lines = writeEven(alphabetRows());
      break;
    case "digits":
      lines = writeAll([DIGITS, "1 2 3 4 5 6 7 8 9 10", "11 12 13 14 15", "16 17 18 19 20"]);
      break;
    case "signs":
      lines = writeAll(SIGNS.map(([s, w]) => `${s}   ${w}`));
      break;
    case "digits-signs":
      lines = writeAll([DIGITS, "+ - = > <", "2 + 3 = 5", "5 - 1 = 4", "3 > 2   2 < 3"]);
      break;
    case "punctuation":
      lines = writeAll(PUNCT.map(([s, w]) => `${w}${s}`));
      break;
    default:
      return null;
  }
  return { heading: BACK_HEADINGS[kind], lines, rows: lines.length };
}

// the paper of the back, in the shape of a page of the notebook (model.js taskGrid / pageFormat read it)
export const backPaper = (paper, format) => (paper === "square"
  ? { gridKind: "square", ruling: "narrow", grid: "regular", midDash: true, margin: "off", format }
  : { gridKind: "propis", ruling: "narrow", grid: "regular", midDash: true, margin: "off", format });
