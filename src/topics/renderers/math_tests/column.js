// «Контрольные по математике», block «Реши в столбик»: the example is already set up in a column, one
// digit per notebook cell. An item is laid out on a small grid of its own (`grid: { w, h }`), its
// tokens carry their cell (`c`, column; `dr`, row inside the item):
//   row 0 — the marks row: carries / borrowed digits (`blank` kind "mark", not graded; on paper an
//           empty row the child writes into with a pen);
//   row 1 — the top number, digit by digit (`digit`, crossable for a borrow: `cross` key);
//   row 2 — the bottom number; the sign stands in column 0 between rows 1 and 2;
//   the rule under row 2, then row 3 — the answer box, as wide as the answer, filled from the right
//   (`rtl`), graded as one number.
// Column `c = 0` is the sign, places run right to left: units in column `w - 1`.
import { makeRng } from "../addition_subtraction/worksheet/sections.js";
import { normalizeOperands, operandsExample } from "../column_addition/engine.js";

// before 2026-11-16 a block chose a «Разрядность» (2 + 1 … 3 + 3); now the numbers are drawn as cells,
// the same setting as the «Столбик» trainer (`operands`, column_addition/engine.js normalizeOperands):
// how many digits each number has and where a 0 stands
export const COLUMN_SIZES = ["2+1", "2+2", "3+1", "3+2", "3+3"];
const operandsOfSize = (size) => {
  const [top, bottom] = String(size).split("+").map(Number);
  return { top, topZeros: [], bottom, bottomZeros: [] };
};
export const COLUMN_REGROUP = ["mixed", "with", "without"];

// `form`: "column" — the example stands in a column already; "line" — given in a line («347 + 28 =»),
// the child sets it up in a column in the notebook and writes the answer (what «Контрольная работа»
// of the «Столбик» topic did, 2026-11-16)
export const COLUMN_FORMS = ["column", "line"];

export function defaultColumn() {
  return { type: "column", count: 8, ops: "both", operands: operandsOfSize("2+2"), regroup: "mixed", form: "column", newPlace: true };
}

export function normalizeColumn(block) {
  const def = defaultColumn();
  const b = { ...def, ...block, type: "column" };
  b.count = Math.max(2, Math.min(12, Math.round(Number(b.count) || def.count)));
  if (!["add", "subtract", "both"].includes(b.ops)) b.ops = def.ops;
  // a «−» keeps the bottom no longer than the top; «+» and «оба» leave it free (as in the trainer)
  const operands = block?.operands ?? (COLUMN_SIZES.includes(block?.size) ? operandsOfSize(block.size) : def.operands);
  b.operands = normalizeOperands(operands, b.ops === "subtract" ? "subtract" : "add");
  delete b.size;
  if (!COLUMN_REGROUP.includes(b.regroup)) b.regroup = def.regroup;
  if (!COLUMN_FORMS.includes(b.form)) b.form = def.form;
  // «Новый разряд»: the answer may grow or lose a place (95 + 7 = 102, 102 − 7 = 95)
  b.newPlace = b.newPlace !== false;
  return b;
}

const digitsOf = (n) => String(n).split("").map(Number).reverse(); // units first

// does a ± b carry / borrow in any place?
export function regroups(a, b, op) {
  const da = digitsOf(a);
  const db = digitsOf(b);
  for (let i = 0; i < da.length; i += 1) {
    const x = da[i];
    const y = db[i] ?? 0;
    if (op === "add" ? x + y >= 10 : x < y) return true;
  }
  return false;
}


// tokens of one column example
export function columnItem(a, b, op) {
  const r = op === "add" ? a + b : a - b;
  const w = 1 + Math.max(String(a).length, String(b).length, String(r).length); // sign + places
  const tokens = [];
  // marks row: one small box above every place
  for (let pos = 0; pos < w - 1; pos += 1) tokens.push({ t: "blank", i: `m${pos}`, kind: "mark", c: w - 1 - pos, w: 1, dr: 0, pos });
  digitsOf(a).forEach((d, pos) => tokens.push({ t: "digit", v: d, c: w - 1 - pos, w: 1, dr: 1, cross: `x${pos}`, pos }));
  digitsOf(b).forEach((d, pos) => tokens.push({ t: "digit", v: d, c: w - 1 - pos, w: 1, dr: 2, pos }));
  tokens.push({ t: "op", op, c: 0, w: 1, dr: 1.5 });
  tokens.push({ t: "rule", c: 0, w, dr: 3 });
  const len = String(r).length;
  tokens.push({ t: "blank", i: 0, kind: "num", rtl: true, fixBelow: true, c: w - len, w: len, dr: 3 });
  return { grid: { w, h: 4 }, tokens, answers: [r], column: { a, b, op, w } };
}

// the example in a line: 347 + 28 = ☐ (the column is written in the notebook)
function lineItem(a, b, op) {
  return {
    tokens: [{ t: "num", v: a }, { t: "op", op }, { t: "num", v: b }, { t: "eq" }, { t: "blank", i: 0, kind: "num" }],
    answers: [op === "add" ? a + b : a - b],
    line: { a, b, op },
  };
}

export function buildColumn(block) {
  const b = normalizeColumn(block);
  const rng = makeRng(block.seed ?? 1);
  const items = [];
  const seen = new Set();
  for (let k = 0; items.length < b.count && k < b.count * 4; k += 1) {
    const op = b.ops === "both" ? (items.length % 2 === 0 ? "add" : "subtract") : b.ops;
    const want = b.regroup === "with" ? "carry" : b.regroup === "without" ? "none" : items.length % 3 !== 2 ? "carry" : "none";
    const ex = operandsExample(b.operands, op, want, seen, { rng, newPlace: b.newPlace });
    if (!ex) continue;
    items.push(b.form === "line" ? lineItem(ex.top, ex.bottom, op) : columnItem(ex.top, ex.bottom, op));
  }
  // the answer box of a line is as wide as the longest answer (1120 after 650 + 470)
  return { maxNumber: b.form === "line" ? Math.max(9, ...items.map((it) => it.answers[0])) : 999, items };
}
