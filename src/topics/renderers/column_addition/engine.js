import { getFingerConfig, getRemoveMode } from "./FingerSystem.js";

const POSITIONS = ["units", "tens", "hundreds"];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDigits(n, count) {
  return Array.from({ length: count }, (_, i) => Math.floor(n / 10 ** i) % 10);
}

function buildAddColumns(top, bottom, digits) {
  const td = getDigits(top, digits);
  const bd = getDigits(bottom, digits);
  const cols = [];
  let carry = 0;
  for (let i = 0; i < digits; i++) {
    const sum = td[i] + bd[i] + carry;
    const writeDigit = sum % 10;
    const carryOut = Math.floor(sum / 10);
    cols.push({ position: POSITIONS[i], topDigit: td[i], bottomDigit: bd[i], carryIn: carry, carryOut, writeDigit });
    carry = carryOut;
  }
  return cols;
}

export function buildSubColumns(top, bottom, digits) {
  const td = getDigits(top, digits);
  const bd = getDigits(bottom, digits);
  const cols = [];
  let borrow = 0;
  for (let i = 0; i < digits; i++) {
    const effective = td[i] - borrow;
    const needsBorrow = effective < bd[i];
    const borrowOut = needsBorrow ? 1 : 0;
    const effectiveTopDigit = effective + (needsBorrow ? 10 : 0);
    const writeDigit = effectiveTopDigit - bd[i];
    cols.push({ position: POSITIONS[i], topDigit: td[i], bottomDigit: bd[i], borrowIn: borrow, borrowOut, effectiveTopDigit, compareTopDigit: effective, writeDigit });
    borrow = borrowOut;
  }
  return cols;
}

function buildAddSteps(columns) {
  const steps = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const next = columns[i + 1];
    steps.push({ cellType: "result", position: col.position, digit: col.writeDigit });
    if (col.carryOut > 0 && next) {
      steps.push({ cellType: "carry", position: next.position, digit: col.carryOut });
    }
  }
  return steps;
}

function buildSubSteps(columns) {
  const steps = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const next = columns[i + 1];
    if (col.borrowOut > 0 && next) {
      // "borrow" sits at the column that RECEIVES the extra ten (the one that
      // was short) — the child types "1" here to acknowledge the borrow.
      steps.push({ cellType: "borrow", position: col.position, digit: 1 });
    }
    // The current column is finished — borrowed if it needed to, then its
    // own result — BEFORE touching the source column at all. Only once this
    // column is fully done does work move to the source (crossout+adjust
    // below), which doubles as the first step of "moving on" to that column.
    steps.push({ cellType: "result", position: col.position, digit: col.writeDigit });
    if (col.borrowOut > 0 && next) {
      // "crossout" sits at the SOURCE column (one place higher), same
      // position "adjust" uses — the child must draw a left-to-right swipe
      // across that digit themselves before it counts as crossed out.
      // digit:null because this step isn't a numeric input, it's a gesture.
      steps.push({ cellType: "crossout", position: next.position, digit: null });
      // "adjust" sits at the SOURCE column too — the child computes and
      // types its own reduced digit (topDigit - 1) themselves.
      steps.push({ cellType: "adjust", position: next.position, digit: next.topDigit - 1 });
    }
  }
  return steps;
}

function generateAddTask(carryMode, digits, card, usedPairs) {
  for (let attempt = 0; attempt < 100; attempt++) {
    let top, bottom;
    if (digits === 2) {
      if (carryMode === "none") {
        const tU = randomInt(1, 8), tT = randomInt(1, 8);
        const bU = randomInt(1, 9 - tU), bT = randomInt(1, 9 - tT);
        top = tT * 10 + tU; bottom = bT * 10 + bU;
      } else if (carryMode === "carry") {
        const tU = randomInt(2, 9), bU = randomInt(10 - tU, 9);
        const tT = randomInt(1, 7), bT = randomInt(1, 8 - tT);
        top = tT * 10 + tU; bottom = bT * 10 + bU;
      } else {
        // bottom's upper bound must leave top+bottom within the 2-digit cap (99), so
        // top itself can't go all the way to 89 — at 89 there'd be no valid 2-digit
        // bottom (99-89=10 < the 11 floor every other branch here uses).
        top = randomInt(11, 88); bottom = randomInt(11, 99 - top);
      }
    } else {
      // Same reasoning as above, one digit up: top can't reach 899, or 999-top would
      // dip below the 101 floor and leave no valid 3-digit bottom.
      top = randomInt(101, 898); bottom = randomInt(101, 999 - top);
    }
    const columns = buildAddColumns(top, bottom, digits);
    const hasCarry = columns.some(c => c.carryOut > 0);
    if (carryMode === "none" && hasCarry) continue;
    if (carryMode === "carry" && !hasCarry) continue;
    // Avoid handing back the exact same pair twice within one generated batch —
    // pure independent random draws otherwise repeat far more often than a
    // parent/child expects, especially once carryMode narrows the digit space.
    const pairKey = `add:${top},${bottom}`;
    if (usedPairs?.has(pairKey)) continue;
    usedPairs?.add(pairKey);
    return {
      type: "column_arithmetic",
      cardId: card.id,
      conceptId: card.conceptId,
      operation: "add",
      digits,
      top,
      bottom,
      result: top + bottom,
      columns,
      steps: buildAddSteps(columns),
    };
  }
  return null;
}

function generateSubTask(carryMode, digits, card, usedPairs) {
  for (let attempt = 0; attempt < 100; attempt++) {
    let top, bottom;
    if (digits === 2) {
      if (carryMode === "none") {
        const bU = randomInt(1, 8), tU = randomInt(bU, 9);
        const bT = randomInt(1, 8), tT = randomInt(bT + 1, 9);
        top = tT * 10 + tU; bottom = bT * 10 + bU;
      } else if (carryMode === "carry") {
        const bU = randomInt(2, 9), tU = randomInt(1, bU - 1);
        const bT = randomInt(1, 7), tT = randomInt(bT + 1, 9);
        top = tT * 10 + tU; bottom = bT * 10 + bU;
      } else {
        top = randomInt(21, 99); bottom = randomInt(11, top - 10);
      }
    } else {
      top = randomInt(201, 999); bottom = randomInt(101, top - 100);
    }
    const columns = buildSubColumns(top, bottom, digits);
    const hasBorrow = columns.some(c => c.borrowOut > 0);
    if (carryMode === "none" && hasBorrow) continue;
    if (carryMode === "carry" && !hasBorrow) continue;
    const pairKey = `sub:${top},${bottom}`;
    if (usedPairs?.has(pairKey)) continue;
    usedPairs?.add(pairKey);
    return {
      type: "column_arithmetic",
      cardId: card.id,
      conceptId: card.conceptId,
      operation: "subtract",
      digits,
      top,
      bottom,
      result: top - bottom,
      columns,
      steps: buildSubSteps(columns),
    };
  }
  return null;
}

export function generateFingersShow(card) {
  const n = card.params?.n ?? 0;
  return {
    type: "fingers_show",
    cardId: card.id,
    conceptId: card.conceptId,
    n,
  };
}

export function generateFingersCount(card) {
  const op  = card.params?.op ?? "add";
  const a   = card.params?.a ?? 0;
  const b   = card.params?.b ?? 0;
  const result = op === "add" ? a + b : a - b;
  const base = { type: "fingers_count", cardId: card.id, conceptId: card.conceptId, op, a, b, result };
  if (op === "sub") return { ...base, ...getRemoveMode(a, b) };
  return base;
}

// maxOnes = 0 is a distinct, deliberate case (ones is always 0) — it is never mixed in
// with maxOnes > 0, where ones is drawn from [1, maxOnes]. This keeps "no ones" (a separate
// abstraction for a child learning place value) from showing up as an incidental low roll
// once a parent widens the range — it only appears when maxOnes is set to exactly 0.
function randomPlaceValueNumber(maxOnes, maxTens = 9) {
  const tens = randomInt(1, Number(maxTens));
  const max = Number(maxOnes);
  const ones = max === 0 ? 0 : randomInt(1, max);
  return { tens, ones };
}

export function generateBuildNumberTask(card, maxOnes, maxTens, numericBlocks) {
  const { tens, ones } = randomPlaceValueNumber(maxOnes, maxTens);
  return {
    type: "build_number",
    cardId: card.id,
    conceptId: card.conceptId,
    maxOnes: Number(maxOnes),
    maxTens: Number(maxTens),
    numericBlocks: Boolean(numericBlocks),
    number: tens * 10 + ones,
    target: { tens, ones },
  };
}

// identify_number only: occasionally mixes in round tens (ones = 0, e.g.
// 30/40/50) and bare single digits (tens = 0, e.g. 7) among the regular
// two-digit draws. Left out of the shared randomPlaceValueNumber above —
// build_number has nothing new to demonstrate on a round ten, and
// regroup_ten specifically needs at least one ten to exchange, so neither
// should ever see tens = 0. Without these edge cases, a child can answer
// "какое это число?" by pattern ("it's always two digits, both filled")
// instead of actually reading the picture — see the same session's
// "величина без ощущения" discussion for why that matters here specifically.
function randomIdentifyNumberValue(maxOnes, maxTens = 9) {
  const max = Number(maxOnes);
  // maxOnes = 0 is still the pre-existing, deliberate "round tens only"
  // session (untouched) — the mixing below only applies to a normal
  // maxOnes > 0 session.
  if (max === 0) return { tens: randomInt(1, Number(maxTens)), ones: 0 };

  const roll = Math.random();
  if (roll < 0.15) return { tens: randomInt(1, Number(maxTens)), ones: 0 };
  if (roll < 0.3) return { tens: 0, ones: randomInt(1, max) };
  return { tens: randomInt(1, Number(maxTens)), ones: randomInt(1, max) };
}

export function generateIdentifyNumberTask(card, maxOnes) {
  const { tens, ones } = randomIdentifyNumberValue(maxOnes);
  return {
    type: "identify_number",
    cardId: card.id,
    conceptId: card.conceptId,
    maxOnes: Number(maxOnes),
    number: tens * 10 + ones,
    model: { tens, ones },
  };
}

export function generateRegroupTask(card, maxOnes) {
  const { tens, ones } = randomPlaceValueNumber(maxOnes);
  return {
    type: "regroup_ten",
    cardId: card.id,
    conceptId: card.conceptId,
    maxOnes: Number(maxOnes),
    number: tens * 10 + ones,
    initial: { tens, ones },
    after: { tens: tens - 1, ones: ones + 10 },
  };
}

export function generateExamples(count, params) {
  const operation = params?.operation ?? "add";
  const carryMode = params?.carryMode ?? "none";
  const digits = Number(params?.digits ?? 2);
  const fakeCard = { id: "copy", conceptId: "copy" };
  const results = [];
  const usedPairs = new Set();
  let attempts = 0;
  while (results.length < count && attempts < count * 30) {
    attempts++;
    const op = operation === "mixed" ? (Math.random() < 0.5 ? "add" : "subtract") : operation;
    const t = op === "add"
      ? generateAddTask(carryMode, digits, fakeCard, usedPairs)
      : generateSubTask(carryMode, digits, fakeCard, usedPairs);
    if (t) results.push({ operation: t.operation, top: t.top, bottom: t.bottom });
  }
  return results;
}

// Gate for the borrow-teaching UI (comparison strip + borrow/adjust squares):
// only subtraction tasks that actually contain a borrow qualify. Addition,
// and subtraction tasks generated without a borrow, are untouched by it.
export function taskNeedsBorrowTeaching(task) {
  return task?.operation === "subtract" && (task?.columns ?? []).some((c) => c.borrowOut > 0);
}

// Resolves the "Сравнение" setting into one of the three compareMode values.
// Falls back to the pre-2026-07-26 boolean `showCompare` key so links saved
// before this change keep their chosen behavior instead of silently
// resetting to the default.
export function resolveCompareMode(sessionParams) {
  if (sessionParams?.compareMode) return sessionParams.compareMode;
  if (typeof sessionParams?.showCompare === "boolean") {
    return sessionParams.showCompare ? "onBorrow" : "off";
  }
  return "onBorrow";
}

export function generateTasks(modeOrObj, cards, countOrParams, maybeParams) {
  const mode = typeof modeOrObj === "string" ? modeOrObj : (modeOrObj?.type ?? modeOrObj?.id ?? "");
  const count = typeof countOrParams === "number" ? countOrParams : 15;
  const params = (countOrParams && typeof countOrParams === "object") ? countOrParams
    : (maybeParams && typeof maybeParams === "object") ? maybeParams : {};

  const allCards = cards.filter(c => c.renderer === "column_addition");
  if (!allCards.length) return [];

  const fingerShowCards     = allCards.filter(c => c.params?.mode === "fingers_show");
  const fingerCountCards    = allCards.filter(c => c.params?.mode === "fingers_count");
  const buildNumberCards    = allCards.filter(c => c.params?.mode === "build_number");
  const identifyNumberCards = allCards.filter(c => c.params?.mode === "identify_number");
  const regroupTenCards     = allCards.filter(c => c.params?.mode === "regroup_ten");

  if (mode === "fingers_show") {
    const pool = fingerShowCards.length ? fingerShowCards : [];
    const tasks = [];
    for (let i = 0; tasks.length < count && i < pool.length * 3; i++) {
      tasks.push(generateFingersShow(pool[i % pool.length]));
    }
    return tasks;
  }

  if (mode === "fingers_count") {
    const opFilter = params.op;
    let pool = fingerCountCards.length ? fingerCountCards : [];
    if (opFilter && opFilter !== "mixed") {
      pool = pool.filter(c => (c.params?.op ?? "add") === opFilter);
    }
    if (!pool.length) pool = fingerCountCards;
    const tasks = [];
    for (let i = 0; tasks.length < count && i < pool.length * 3; i++) {
      tasks.push(generateFingersCount(pool[i % pool.length]));
    }
    return tasks;
  }

  if (mode === "build_number") {
    if (!buildNumberCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const maxTens = Number(params.maxTens ?? 3);
    const numericBlocks = params.numericBlocks ?? false;
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateBuildNumberTask(buildNumberCards[i % buildNumberCards.length], maxOnes, maxTens, numericBlocks));
    }
    return tasks;
  }

  if (mode === "identify_number") {
    if (!identifyNumberCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateIdentifyNumberTask(identifyNumberCards[i % identifyNumberCards.length], maxOnes));
    }
    return tasks;
  }

  if (mode === "regroup_ten") {
    if (!regroupTenCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push(generateRegroupTask(regroupTenCards[i % regroupTenCards.length], maxOnes));
    }
    return tasks;
  }

  // Default: column_arithmetic — exclude finger cards
  const arithmeticCards = allCards.filter(c => !c.params?.mode);
  if (!arithmeticCards.length) return [];

  const operation = params.operation ?? "add";
  const carryMode = params.carryMode ?? "none";
  const digits    = Number(params.digits ?? 2);

  const filtered   = operation === "mixed" ? arithmeticCards
    : arithmeticCards.filter(c => (c.params?.operation ?? "add") === operation);
  const activePool = filtered.length ? filtered : arithmeticCards;

  const tasks = [];
  const usedPairs = new Set();
  let idx = 0, attempts = 0;

  while (tasks.length < count && attempts < count * 20) {
    attempts++;
    const card = activePool[idx % activePool.length];
    const op   = operation === "mixed" ? (Math.random() < 0.5 ? "add" : "subtract") : operation;
    const task = op === "add"
      ? generateAddTask(carryMode, digits, card, usedPairs)
      : generateSubTask(carryMode, digits, card, usedPairs);
    if (task) { tasks.push(task); idx++; }
  }

  return tasks;
}
