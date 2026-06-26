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

function buildSubColumns(top, bottom, digits) {
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
    cols.push({ position: POSITIONS[i], topDigit: td[i], bottomDigit: bd[i], borrowIn: borrow, borrowOut, effectiveTopDigit, writeDigit });
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
      steps.push({ cellType: "borrow", position: next.position, digit: 1 });
    }
    steps.push({ cellType: "result", position: col.position, digit: col.writeDigit });
  }
  return steps;
}

function generateAddTask(carryMode, digits, card) {
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
        top = randomInt(11, 89); bottom = randomInt(11, 89);
      }
    } else {
      top = randomInt(101, 899); bottom = randomInt(101, 999 - top);
    }
    const columns = buildAddColumns(top, bottom, digits);
    const hasCarry = columns.some(c => c.carryOut > 0);
    if (carryMode === "none" && hasCarry) continue;
    if (carryMode === "carry" && !hasCarry) continue;
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

function generateSubTask(carryMode, digits, card) {
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

export function generateExamples(count, params) {
  const operation = params?.operation ?? "add";
  const carryMode = params?.carryMode ?? "none";
  const digits = Number(params?.digits ?? 2);
  const fakeCard = { id: "copy", conceptId: "copy" };
  const results = [];
  let attempts = 0;
  while (results.length < count && attempts < count * 30) {
    attempts++;
    const op = operation === "mixed" ? (Math.random() < 0.5 ? "add" : "subtract") : operation;
    const t = op === "add"
      ? generateAddTask(carryMode, digits, fakeCard)
      : generateSubTask(carryMode, digits, fakeCard);
    if (t) results.push({ operation: t.operation, top: t.top, bottom: t.bottom });
  }
  return results;
}

export function generateTasks(modeOrObj, cards, countOrParams, maybeParams) {
  const mode = typeof modeOrObj === "string" ? modeOrObj : (modeOrObj?.type ?? modeOrObj?.id ?? "");
  const count = typeof countOrParams === "number" ? countOrParams : 15;
  const params = (countOrParams && typeof countOrParams === "object") ? countOrParams
    : (maybeParams && typeof maybeParams === "object") ? maybeParams : {};

  const allCards = cards.filter(c => c.renderer === "column_addition");
  if (!allCards.length) return [];

  const fingerShowCards  = allCards.filter(c => c.params?.mode === "fingers_show");
  const fingerCountCards = allCards.filter(c => c.params?.mode === "fingers_count");

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
  let idx = 0, attempts = 0;

  while (tasks.length < count && attempts < count * 20) {
    attempts++;
    const card = activePool[idx % activePool.length];
    const op   = operation === "mixed" ? (Math.random() < 0.5 ? "add" : "subtract") : operation;
    const task = op === "add"
      ? generateAddTask(carryMode, digits, card)
      : generateSubTask(carryMode, digits, card);
    if (task) { tasks.push(task); idx++; }
  }

  return tasks;
}
