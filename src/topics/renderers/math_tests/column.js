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

export const COLUMN_SIZES = ["2+1", "2+2", "3+1", "3+2", "3+3"];
export const COLUMN_REGROUP = ["mixed", "with", "without"];

export function defaultColumn() {
  return { type: "column", count: 8, ops: "both", size: "2+2", regroup: "mixed" };
}

export function normalizeColumn(block) {
  const def = defaultColumn();
  const b = { ...def, ...block, type: "column" };
  b.count = Math.max(2, Math.min(12, Math.round(Number(b.count) || def.count)));
  if (!["add", "subtract", "both"].includes(b.ops)) b.ops = def.ops;
  if (!COLUMN_SIZES.includes(b.size)) b.size = def.size;
  if (!COLUMN_REGROUP.includes(b.regroup)) b.regroup = def.regroup;
  return b;
}

const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
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

function pickNumbers(rng, b, op, wantRegroup) {
  const [la, lb] = b.size.split("+").map(Number);
  const lo = (l) => 10 ** (l - 1);
  const hi = (l) => 10 ** l - 1;
  for (let k = 0; k < 200; k += 1) {
    let x = int(rng, lo(la), hi(la));
    let y = int(rng, lo(lb), hi(lb));
    if (op === "subtract") {
      if (la === lb && x < y) [x, y] = [y, x];
      if (x - y < 1) continue;
    }
    // round numbers (40 + 30) teach nothing about the column
    if (y % 10 === 0 && x % 10 === 0) continue;
    const r = regroups(x, y, op);
    if (wantRegroup === true && !r) continue;
    if (wantRegroup === false && r) continue;
    return [x, y];
  }
  return null;
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

export function buildColumn(block) {
  const b = normalizeColumn(block);
  const rng = makeRng(block.seed ?? 1);
  const items = [];
  const seen = new Set();
  for (let k = 0; items.length < b.count && k < b.count * 40; k += 1) {
    const op = b.ops === "both" ? (items.length % 2 === 0 ? "add" : "subtract") : b.ops;
    const want = b.regroup === "with" ? true : b.regroup === "without" ? false : items.length % 3 !== 2;
    const pair = pickNumbers(rng, b, op, want) ?? pickNumbers(rng, b, op, null);
    if (!pair) continue;
    const key = `${pair[0]}${op}${pair[1]}`;
    if (seen.has(key) && k < b.count * 20) continue;
    seen.add(key);
    items.push(columnItem(pair[0], pair[1], op));
  }
  return { maxNumber: 999, items };
}
