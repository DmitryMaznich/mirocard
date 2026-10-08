import { digitsOut } from "@/topics/renderers/propis2/fieldText.js";
import { newRow, rowToLine } from "@/topics/renderers/propis2/model.js";

// What the back of the cover holds (coverConfig.js BACKS), as rows of the notebook engine: written once, without start dots, a blank
// row between rows of writing (as the reference sheets of the printed series, scripts/cover_tetrad.py). `heading` is printed above.

const LOWER = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя";
// a capital the hand was captured for (wide.json): not Ё and Й, and Ъ Ы Ь have none at all; where there is no capital, the lowercase
// letter stands alone, as in the ready notebooks (tools/propis2/build_kits.py)
const NO_CAPITAL = new Set(["ё", "й", "ъ", "ы", "ь"]);
// a row holds what fits the A5 width (checked on the page): at most 5 pairs, a pair weighs 2, a lone lowercase letter 1
const ROW_WEIGHT = 11;
const ROW_PAIRS = 5;

// spaces as typed in the editor: one is the usual gap (inside a pair: no connection runs into the lowercase letter after a space),
// two add a cell (between pairs)
const write = (text) => rowToLine(newRow({ text: digitsOut(text), repeat: "one", dots: "none" }));
const spaced = (rows) => rows.flatMap((t, i) => (i ? ["", write(t)] : [write(t)]));

function alphabetRows() {
  const units = [...LOWER].map((l) => (NO_CAPITAL.has(l) ? l : `${l.toUpperCase()} ${l}`));
  const rows = [];
  let cur = [];
  let weight = 0;
  let pairs = 0;
  for (const u of units) {
    const pair = u.includes(" ");
    if (weight + (pair ? 2 : 1) > ROW_WEIGHT || (pair && pairs === ROW_PAIRS)) { rows.push(cur.join("  ")); cur = []; weight = 0; pairs = 0; }
    cur.push(u);
    weight += pair ? 2 : 1;
    if (pair) pairs += 1;
  }
  if (cur.length) rows.push(cur.join("  "));
  return rows;
}

const DIGITS = "0 1 2 3 4 5 6 7 8 9";
const SIGNS = [["+", "плюс"], ["-", "минус"], ["=", "равно"], [">", "больше"], ["<", "меньше"]];
const PUNCT = [[".", "точка"], [",", "запятая"], ["?", "вопрос"], ["!", "восклицание"]];

export const BACK_HEADINGS = { alphabet: "Алфавит", digits: "Цифры", signs: "Знаки", "digits-signs": "Цифры и знаки", punctuation: "Знаки препинания" };

// {heading, lines, rows}: `rows` — how many rows of the page the content takes
export function backContent(kind) {
  let lines;
  switch (kind) {
    case "alphabet":
      lines = spaced(alphabetRows());
      break;
    case "digits":
      lines = spaced([DIGITS, "1 2 3 4 5 6 7 8 9 10", "11 12 13 14 15", "16 17 18 19 20"]);
      break;
    case "signs":
      lines = spaced(SIGNS.map(([s, w]) => `${s}   ${w}`));
      break;
    case "digits-signs":
      lines = spaced([DIGITS, "+ - = > <", "2 + 3 = 5", "5 - 1 = 4", "3 > 2   2 < 3"]);
      break;
    case "punctuation":
      lines = spaced(PUNCT.map(([s, w]) => `${w}${s}`));
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
