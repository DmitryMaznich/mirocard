// «Контрольные по математике», area «Сравнение»: put < > or = between two sides.
// A side is a number or a one-action example (a + b, a − b). Three kinds of task:
//   nums — two numbers (7 ○ 5, 47 ○ 74);
//   expr — an example and a number (3 + 2 ○ 6), the example on either side;
//   two  — two examples (3 + 2 ○ 4 + 1).
// The relation is chosen first (about a third «=» for examples, fewer for bare numbers), then the
// sides are made close to each other, so the child has to count, not guess by the look.
// The answer box is one cell (`kind: "cmp"`), its answer is "<", ">" or "=".
import { makeRng } from "../addition_subtraction/worksheet/sections.js";

export const CMP_MAX_NUMBERS = [10, 20, 100];
// «Сравни числа» goes up to 1000 too (from «7. Контрольная работа» of «Сравнение», moved here
// 2026-11-16): three-digit numbers with the place-value traps — 305 / 350, 99 / 100, 300 / 299
export const CMP_NUMS_MAX_NUMBERS = [10, 20, 100, 1000];
export const CMP_WHAT = ["nums", "expr", "two"];
export const CMP_SIGNS = ["<", ">", "="];

export function defaultCompare(what = "expr") {
  return { type: `cmp_${what}`, count: what === "two" ? 6 : 8, maxNumber: 10, ops: "both" };
}

export function normalizeCompare(block, what) {
  const def = defaultCompare(what);
  const b = { ...def, ...block, type: `cmp_${what}` };
  b.count = Math.max(2, Math.min(12, Math.round(Number(b.count) || def.count)));
  if (!(what === "nums" ? CMP_NUMS_MAX_NUMBERS : CMP_MAX_NUMBERS).includes(b.maxNumber)) b.maxNumber = def.maxNumber;
  if (!["add", "subtract", "both"].includes(b.ops)) b.ops = "both";
  return b;
}

const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const num = (v) => ({ t: "num", v });
const opTok = (op) => ({ t: "op", op });
const BOX = { t: "blank", i: 0, kind: "cmp" };

// how far apart the two sides may be: close enough that they have to be counted
const spreadOf = (max) => (max <= 10 ? 3 : max <= 20 ? 5 : 10);

// an example a ± d whose value is exactly v, all numbers inside 0…max, d ≥ 1
function exampleFor(rng, v, max, ops) {
  const allowed = ops === "add" ? ["add"] : ops === "subtract" ? ["subtract"] : ["add", "subtract"];
  const choices = allowed.filter((op) => (op === "add" ? v >= 2 : v + 1 <= max));
  if (!choices.length) return null;
  const op = pick(rng, choices);
  if (op === "add") {
    const d = int(rng, 1, v - 1);
    return [num(v - d), opTok("add"), num(d)];
  }
  const d = int(rng, 1, max - v);
  return [num(v + d), opTok("subtract"), num(d)];
}

// a value related to v by `rel` (the other side of «v rel w»), close to v, inside lo…max
function partnerOf(rng, v, rel, lo, max) {
  if (rel === "=") return v;
  const spread = spreadOf(max);
  if (rel === "<") return v + 1 > max ? null : int(rng, v + 1, Math.min(max, v + spread));
  return v - 1 < lo ? null : int(rng, Math.max(lo, v - spread), v - 1);
}

function relation(rng, what) {
  const eq = what === "nums" ? 0.15 : 0.3;
  const x = rng();
  return x < eq ? "=" : x < eq + (1 - eq) / 2 ? "<" : ">";
}

function oneItem(rng, b, what, index) {
  const max = b.maxNumber;
  const rel = relation(rng, what);
  if (what === "nums" && max >= 1000) return threeDigitPair(rng, rel);
  if (what === "nums") {
    // two-digit numbers: often the same digits swapped or the same tens, the classic traps
    const lo = max >= 100 ? 10 : 0;
    const v = int(rng, lo, max >= 100 ? 99 : max);
    let w = partnerOf(rng, v, rel, lo, max >= 100 ? 99 : max);
    if (max >= 100 && rel !== "=" && rng() < 0.35) {
      const swapped = (v % 10) * 10 + Math.floor(v / 10);
      if (swapped >= 10 && swapped !== v && (rel === "<" ? swapped > v : swapped < v)) w = swapped;
    }
    if (w == null) return null;
    return { tokens: [num(v), BOX, num(w)], answers: [rel] };
  }
  const v = int(rng, 2, max);
  const w = partnerOf(rng, v, rel, 0, max);
  if (w == null) return null;
  const left = exampleFor(rng, v, max, b.ops);
  if (!left) return null;
  if (what === "two") {
    const right = exampleFor(rng, w, max, b.ops);
    if (!right) return null;
    return { tokens: [...left, BOX, ...right], answers: [rel] };
  }
  // the example on the left mostly, every third task on the right (then the sign turns round)
  if (index % 3 === 2) {
    const flip = rel === "<" ? ">" : rel === ">" ? "<" : "=";
    return { tokens: [num(w), BOX, ...left], answers: [flip] };
  }
  return { tokens: [...left, BOX, num(w)], answers: [rel] };
}

// three-digit numbers: a third of them the traps of the place value, the rest close to each other
function threeDigitPair(rng, rel) {
  const signOf = (a, b) => (a < b ? "<" : a > b ? ">" : "=");
  let pair;
  if (rel === "=") { const v = int(rng, 100, 999); pair = [v, v]; }
  else {
    const x = rng();
    if (x < 0.15) { const h = int(rng, 1, 9), d = int(rng, 1, 9); pair = [h * 100 + d * 10, h * 100 + d]; } // 350 / 305
    else if (x < 0.3) { const n = int(rng, 1, 9) * 100; pair = [n - 1, n]; } // 299 / 300, 99 / 100
    else if (x < 0.45) { const h = int(rng, 1, 9), t = int(rng, 1, 9), o = int(rng, 1, 9); pair = t === o ? null : [h * 100 + t * 10 + o, h * 100 + o * 10 + t]; } // 347 / 374
    else { const v = int(rng, 100, 989); pair = [v, v + int(rng, 1, 10)]; }
    if (!pair) return null;
    if (rng() < 0.5) pair.reverse();
  }
  return { tokens: [num(pair[0]), BOX, num(pair[1])], answers: [signOf(pair[0], pair[1])] };
}

const keyOf = (item) => item.tokens.map((t) => (t.t === "num" ? t.v : t.t === "op" ? t.op : "_")).join(" ");

export function buildCompare(block, what) {
  const b = normalizeCompare(block, what);
  const rng = makeRng(b.seed ?? 1);
  const items = [];
  const seen = new Set();
  let attempts = 0;
  while (items.length < b.count && attempts < b.count * 60) {
    attempts += 1;
    const item = oneItem(rng, b, what, items.length);
    if (!item) continue;
    const key = keyOf(item);
    if (seen.has(key) && attempts < b.count * 30) continue;
    seen.add(key);
    items.push(item);
  }
  return { maxNumber: Math.min(b.maxNumber, 999), items }; // «до 1000» — three-digit cells
}

// the value of a side made of tokens (for tests and checks)
export function sideValue(tokens) {
  let v = tokens[0].v;
  for (let i = 1; i < tokens.length; i += 2) v = tokens[i].op === "add" ? v + tokens[i + 1].v : v - tokens[i + 1].v;
  return v;
}
