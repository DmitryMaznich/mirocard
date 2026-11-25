// «Слушай и посчитай» (operation_audio) — which examples the dictation says (owner, 2026-11-25;
// mockup docs/mockups/addition-subtraction/2026-11-25-dictation-settings.html).
//
// The adult draws the example as two numbers of two cells (tens, units), like «Числа в примере»
// of «Столбик — Тренажёр», but a cell holds one of: "any" (any digit), a fixed digit 0–9, or
// "none" (no such place). Tens: "any" | 1–9 | "none" (a number never starts with 0). Units:
// "any" | 0–9 (always there). "any" never draws a 0 — a 0 comes only when chosen, as in the
// column. «1» in the tens of the first number is «within 20» (13 − 6); a fixed bottom digit is
// a single fact drilled (+9, ±1, +10).
//
// Value of the setting: { top: { tens, units }, bottom: { tens, units } }.
// Other settings: operation "add" | "subtract" | "mixed", crossTen "none" | "cross" | "mixed".
// Answers stay within 1…99: the recorded number bank has no words past 100, and 0 as an
// answer (7 − 7) is not a dictation example.

export const DICTATION_MAX_ANSWER = 99;

export const DEFAULT_DICTATION_NUMBERS = Object.freeze({
  top: Object.freeze({ tens: "none", units: "any" }),
  bottom: Object.freeze({ tens: "none", units: "any" }),
});

const isDigit = (v) => Number.isInteger(v) && v >= 0 && v <= 9;

function normalizeCell(value, place) {
  if (value === "any") return "any";
  if (place === "tens") {
    if (value === "none") return "none";
    return isDigit(value) && value > 0 ? value : "none";
  }
  return isDigit(value) ? value : "any";
}

function normalizeNumber(n, fallback) {
  const src = n && typeof n === "object" ? n : fallback;
  return { tens: normalizeCell(src.tens, "tens"), units: normalizeCell(src.units, "units") };
}

// With «−» the second number is never longer than the first: no tens over a one-digit number.
export function normalizeDictationNumbers(value, operation = "add") {
  const top = normalizeNumber(value?.top, DEFAULT_DICTATION_NUMBERS.top);
  const bottom = normalizeNumber(value?.bottom, DEFAULT_DICTATION_NUMBERS.bottom);
  if (operation === "subtract" && top.tens === "none") bottom.tens = "none";
  return { top, bottom };
}

// Settings saved before 2026-11-25 carry «Максимальное число» (maxNumber 20/50/100): «до 20» is
// the teens with a one-digit number, «до 50/100» two two-digit numbers; examples of both kinds
// went with and without a ten crossed.
export function resolveDictationParams(saved = {}) {
  const legacy = saved.numbers == null && saved.maxNumber != null;
  const numbers = saved.numbers != null
    ? saved.numbers
    : legacy
      ? (Number(saved.maxNumber) <= 20
        ? { top: { tens: 1, units: "any" }, bottom: { tens: "none", units: "any" } }
        : { top: { tens: "any", units: "any" }, bottom: { tens: "any", units: "any" } })
      : DEFAULT_DICTATION_NUMBERS;
  const operation = ["add", "subtract", "mixed"].includes(saved.operation) ? saved.operation : "add";
  const crossTen = ["none", "cross", "mixed"].includes(saved.crossTen) ? saved.crossTen : legacy ? "mixed" : "none";
  return { operation, crossTen, numbers: normalizeDictationNumbers(numbers, operation) };
}

function candidates(n) {
  const tens = n.tens === "none" ? [0] : n.tens === "any" ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [n.tens];
  const units = n.units === "any" ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [n.units];
  const out = [];
  for (const t of tens) for (const u of units) {
    const v = t * 10 + u;
    if (v > 0) out.push(v);
  }
  return out;
}

export function crossesTen(a, b, operation) {
  return operation === "add" ? (a % 10) + (b % 10) >= 10 : (a % 10) < (b % 10);
}

// Every example the cells allow, for one operation: [{ a, b, crosses }].
function allPairs(numbers, operation) {
  const n = normalizeDictationNumbers(numbers, operation);
  const out = [];
  for (const a of candidates(n.top)) for (const b of candidates(n.bottom)) {
    const r = operation === "add" ? a + b : a - b;
    if (r < 1 || r > DICTATION_MAX_ANSWER) continue;
    out.push({ a, b, crosses: crossesTen(a, b, operation) });
  }
  return out;
}

// The examples a session draws from, per operation, and what the settings screen says about them.
// relaxed: the ten setting cannot be kept with these digits (40 + 30 «через десяток», 60 − 4
// «без»), so the examples go as the digits allow — the same rule as «Перенос / заём» in the column.
export function dictationPlan({ numbers, operation = "add", crossTen = "none" } = {}) {
  const ops = operation === "mixed" ? ["add", "subtract"] : [operation];
  const byOp = {};
  let relaxed = false;
  for (const op of ops) {
    const all = allPairs(numbers, op);
    if (!all.length) continue;
    const kept = crossTen === "mixed" ? all : all.filter((p) => p.crosses === (crossTen === "cross"));
    if (!kept.length) relaxed = true;
    byOp[op] = kept.length ? kept : all;
  }
  const available = Object.keys(byOp);
  const total = available.reduce((sum, op) => sum + byOp[op].length, 0);
  return { byOp, ops: available, relaxed, empty: !available.length, single: total === 1 };
}

// One example: { start, delta, operation, result, crosses }; null when the cells allow none.
export function drawDictationExample(plan, random = Math.random, avoid = null) {
  if (!plan || plan.empty) return null;
  const op = plan.ops[Math.floor(random() * plan.ops.length)];
  const pool = plan.byOp[op];
  let pick = pool[Math.floor(random() * pool.length)];
  if (avoid && pool.length > 1) {
    for (let i = 0; i < 8 && pick.a === avoid.start && pick.b === avoid.delta && op === avoid.operation; i++) {
      pick = pool[Math.floor(random() * pool.length)];
    }
  }
  return {
    start: pick.a,
    delta: pick.b,
    operation: op,
    result: op === "add" ? pick.a + pick.b : pick.a - pick.b,
    crosses: pick.crosses,
  };
}
