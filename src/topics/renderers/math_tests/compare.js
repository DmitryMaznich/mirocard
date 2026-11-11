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
export const CMP_WHAT = ["nums", "expr", "two"];
export const CMP_SIGNS = ["<", ">", "="];

export function defaultCompare(what = "expr") {
  return { type: `cmp_${what}`, count: what === "two" ? 6 : 8, maxNumber: 10, ops: "both" };
}

export function normalizeCompare(block, what) {
  const def = defaultCompare(what);
  const b = { ...def, ...block, type: `cmp_${what}` };
  b.count = Math.max(2, Math.min(12, Math.round(Number(b.count) || def.count)));
  if (!CMP_MAX_NUMBERS.includes(b.maxNumber)) b.maxNumber = def.maxNumber;
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
  return { maxNumber: b.maxNumber, items };
}

// the value of a side made of tokens (for tests and checks)
export function sideValue(tokens) {
  let v = tokens[0].v;
  for (let i = 1; i < tokens.length; i += 2) v = tokens[i].op === "add" ? v + tokens[i + 1].v : v - tokens[i + 1].v;
  return v;
}
