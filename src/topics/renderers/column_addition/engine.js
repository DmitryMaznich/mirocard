const POSITIONS = ["units", "tens", "hundreds"];

export { buildAddSteps, buildSubSteps };

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDigits(n, count) {
  return Array.from({ length: count }, (_, i) => Math.floor(n / 10 ** i) % 10);
}

// bottomDigits < digits marks a shorter bottom operand (currently only the
// "2-зн. + 1-зн." category: digits=2, bottomDigits=1) — its missing high
// position still math-zero-pads via getDigits (bd[i]=0), but hasBottomDigit
// tells the renderer that position has no real digit to show/fill for the
// bottom number, so it can leave that cell blank instead of drawing a "0"
// that was never written on paper.
// topDigits < digits — a shorter TOP number (25 + 326, «Числа в примере»
// 2026-11-15): the same idea one row up, hasTopDigit marks the empty cells.
function buildAddColumns(top, bottom, digits, bottomDigits = digits, topDigits = digits) {
  const td = getDigits(top, digits);
  const bd = getDigits(bottom, digits);
  const cols = [];
  let carry = 0;
  for (let i = 0; i < digits; i++) {
    const sum = td[i] + bd[i] + carry;
    const writeDigit = sum % 10;
    const carryOut = Math.floor(sum / 10);
    cols.push({ position: POSITIONS[i], topDigit: td[i], hasTopDigit: i < topDigits, bottomDigit: bd[i], hasBottomDigit: i < bottomDigits, carryIn: carry, carryOut, writeDigit });
    carry = carryOut;
  }
  return cols;
}

export function buildSubColumns(top, bottom, digits, bottomDigits = digits) {
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
    // A zero lent through (302 − 195: the ones borrow, the tens have 0): it
    // borrows from the next place itself and is left with 9, written over the
    // crossed-out 0 — never «−1». See buildSubSteps.
    const throughZero = effective < 0;
    cols.push({ position: POSITIONS[i], topDigit: td[i], bottomDigit: bd[i], hasBottomDigit: i < bottomDigits, borrowIn: borrow, borrowOut, effectiveTopDigit, compareTopDigit: throughZero ? 9 : effective, writeDigit, ...(throughZero ? { throughZero } : {}) });
    borrow = borrowOut;
  }
  return cols;
}

// One order for every place (2026-11-15, mockup
// docs/mockups/column-addition/2026-11-15-unified-steps.html). Every step
// carries `column` — the place being worked on — and the first step of a
// place carries `first`, `have` (the top number of the place right now: the
// digit, or the mark written over it) and `need` (the bottom digit, null when
// the bottom number has none): the «… хватает?» question is asked there.
//
// Addition, per place right to left: the result digit; a sum of 10 or more —
// «1» over the next place; with no next place the child writes that «1» in
// the answer itself (`result:overflow`, a new place: 95 + 7 = 102).
function buildAddSteps(columns) {
  const steps = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const next = columns[i + 1];
    const sum = col.topDigit + col.bottomDigit + col.carryIn;
    steps.push({ cellType: "result", position: col.position, digit: col.writeDigit, column: col.position, first: true, have: sum, need: null });
    if (col.carryOut > 0) {
      steps.push(next
        ? { cellType: "carry", position: next.position, digit: col.carryOut, column: col.position }
        : { cellType: "result", position: "overflow", digit: col.carryOut, column: col.position });
    }
  }
  return steps;
}

// Subtraction, per place right to left:
//   1. the top number of the place: its digit, or the mark over it;
//   2. «хватает?» against the bottom digit;
//   3. not enough → borrow: the neighbour on the left lights up (a 0 there
//      lends through — the next one lights up too) and a «1» goes in front of
//      the place's own number (2 → 12);
//   4. each 0 on the way is crossed out and becomes 9, nearest first, then the
//      lender is crossed out and written one less (302 − 195: 0 → 9, 3 → 2) —
//      take, give, reduce (owner, 2026-11-16 and 2026-11-25);
//   5. the result digit. A leading zero of the answer is not written, and a
//      leading place lent down to 0 gets no «0» over it (102 − 7 = 95).
// Nothing is ever overwritten: 532 − 157 keeps «2» over the crossed-out 3 of
// the tens and puts the tens' own «1» in front of it — 12.
function buildSubSteps(columns) {
  const steps = [];
  const cur = columns.map((c) => c.topDigit);
  const last = columns.length - 1;
  for (let i = 0; i <= last; i++) {
    const col = columns[i];
    const have = cur[i];
    const need = col.hasBottomDigit === false ? null : col.bottomDigit;
    const place = [];
    let value = have;
    if (need !== null && have < need) {
      let j = i + 1;
      while (cur[j] === 0) j++;
      const lenders = columns.slice(i + 1, j + 1).map((c) => c.position);
      // The «1» goes in front of our number while every place we go to lights up;
      // then, nearest first, each 0 on the way is crossed out and becomes 9, and
      // the far lender is crossed out and written one less. 801 − 605 (owner,
      // 2026-11-25, as at school: 1 hundred = 10 tens, one ten to the units, 9
      // stay): «1» in front of the 1 → 0 → 9 → 8 → 7. Before (2026-11-22) the
      // child wrote «10» over the 0 and struck it out — no one could follow it.
      place.push({ cellType: "borrow", position: col.position, digit: 1, lenders });
      for (let k = i + 1; k < j; k++) {
        cur[k] = 9;
        place.push({ cellType: "crossout", position: columns[k].position, digit: null, throughZero: true });
        place.push({ cellType: "adjust", position: columns[k].position, digit: 9, throughZero: true });
      }
      place.push({ cellType: "crossout", position: columns[j].position, digit: null });
      cur[j] -= 1;
      if (!(j === last && cur[j] === 0)) place.push({ cellType: "adjust", position: columns[j].position, digit: cur[j] });
      value += 10;
    }
    const digit = value - (need ?? 0);
    if (!(i === last && i > 0 && digit === 0)) place.push({ cellType: "result", position: col.position, digit });
    place.forEach((step, n) => steps.push({ ...step, column: col.position, ...(n === 0 ? { first: true, have, need } : {}) }));
  }
  return steps;
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

  // column_arithmetic — cards with params.mode belonged to modes that moved out
  // (fingers → addition_subtraction, coins → place_value); older decks still carry them.
  const arithmeticCards = allCards.filter(c => !c.params?.mode);
  if (!arithmeticCards.length) return [];

  const operation = params.operation ?? "add";
  const carryMode = params.carryMode ?? "none";
  const operands = resolveOperands(params);

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
    const ex = operandsExample(operands, op, carryMode, usedPairs);
    if (ex) { tasks.push(trainerTaskFrom(ex, card)); idx++; }
  }

  return tasks;
}

// ── «Контрольная работа» (column_copy): a sheet of mixed kinds ───────────────
// The adult ticks the kinds of examples; the sheet mixes them. Numbers stay
// within three digits; only «Переход в новый разряд» lets the answer grow a
// place (95 + 7 = 102, 650 + 470 = 1120) or lose one (102 − 7 = 95) — every
// other kind keeps the answer as wide as the longer number, so a wrong width
// is a mistake of that kind alone. «Перенос / заём» filters every kind but
// that one (a new place is a carry by nature).
export const COPY_KINDS = [
  { key: "kind_22", id: "22", label: "2 + 2", example: "34 + 18" },
  { key: "kind_21", id: "21", label: "2 + 1", example: "34 + 7" },
  { key: "kind_33", id: "33", label: "3 + 3", example: "347 + 128" },
  { key: "kind_32", id: "32", label: "3 + 2", example: "347 + 28" },
  { key: "kind_31", id: "31", label: "3 + 1", example: "347 + 5" },
  { key: "kind_round", id: "round", label: "Круглые", example: "40 + 30, 500 − 70" },
  { key: "kind_zero", id: "zero", label: "С нулём", example: "305 − 7, 400 − 126" },
  { key: "kind_newplace", id: "newplace", label: "Новый разряд", example: "95 + 7, 102 − 7" },
];

const width = (n) => String(n).length;
export function hasCarry(a, b) {
  let carry = 0;
  for (; a || b; a = Math.floor(a / 10), b = Math.floor(b / 10)) {
    carry = (a % 10) + (b % 10) + carry >= 10 ? 1 : 0;
    if (carry) return true;
  }
  return false;
}
export function hasBorrow(a, b) {
  let borrow = 0;
  for (; a || b; a = Math.floor(a / 10), b = Math.floor(b / 10)) {
    borrow = (a % 10) - borrow < (b % 10) ? 1 : 0;
    if (borrow) return true;
  }
  return false;
}
const pickOne = (items) => items[Math.floor(Math.random() * items.length)];
const ofWidth = (w) => randomInt(10 ** (w - 1), 10 ** w - 1);

// One draw of a kind's shape: [top, bottom] before the checks below.
function drawKind(kind, op) {
  switch (kind) {
    case "22": return [ofWidth(2), ofWidth(2)];
    case "21": return [ofWidth(2), randomInt(2, 9)];
    case "33": return [ofWidth(3), ofWidth(3)];
    case "32": return [ofWidth(3), ofWidth(2)];
    case "31": return [ofWidth(3), randomInt(2, 9)];
    case "round": {
      const shape = pickOne(["tens", "hundreds", "mixed"]);
      if (shape === "tens") return [randomInt(1, 9) * 10, randomInt(1, 9) * 10];
      if (shape === "hundreds") return [randomInt(1, 9) * 100, randomInt(1, 9) * 100];
      // 340 + 200, 500 − 70, 600 − 40
      return [randomInt(11, 99) * 10, Math.random() < 0.5 ? randomInt(1, 9) * 10 : randomInt(1, 9) * 100];
    }
    case "zero": {
      // A zero inside the top number: 305, 340, 400 — the borrow through zero.
      const h = randomInt(1, 9);
      const top = pickOne([h * 100 + randomInt(1, 9), h * 100 + randomInt(1, 9) * 10, h * 100]);
      return [top, pickOne([randomInt(2, 9), ofWidth(2), ofWidth(3)])];
    }
    case "newplace":
      if (op === "add") {
        return Math.random() < 0.5
          ? [ofWidth(2), randomInt(1, 99)] // 95 + 7, 64 + 58 → 100…198
          : [ofWidth(3), ofWidth(3)]; // 650 + 470 → 1000…1998
      }
      return [randomInt(100, 198), randomInt(1, 99)]; // 102 − 7, 121 − 56 → 2 digits
    default: return [ofWidth(2), ofWidth(2)];
  }
}

function fitsKind(kind, op, top, bottom) {
  const answer = op === "add" ? top + bottom : top - bottom;
  if (op === "subtract" && answer <= 0) return false;
  const wide = Math.max(width(top), width(bottom));
  if (kind === "newplace") return op === "add" ? width(answer) > wide : width(answer) < width(top);
  // Bottom never longer than top; the answer as wide as the longer number.
  if (width(bottom) > width(top)) return false;
  if (kind === "round" && (top % 10 || bottom % 10)) return false;
  if (kind === "zero" && !String(top).slice(1).includes("0")) return false;
  return width(answer) === wide;
}

export function generateCopyExample(kind, op, carryMode, usedPairs) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const [top, bottom] = drawKind(kind, op);
    if (!fitsKind(kind, op, top, bottom)) continue;
    if (kind !== "newplace" && carryMode !== "mixed") {
      const crosses = op === "add" ? hasCarry(top, bottom) : hasBorrow(top, bottom);
      if (crosses !== (carryMode === "carry")) continue;
    }
    const pairKey = `${op}:${top},${bottom}`;
    if (usedPairs?.has(pairKey)) continue;
    usedPairs?.add(pairKey);
    return { operation: op, top, bottom, kind };
  }
  return null;
}

// The ticked kinds take turns, the sheet's order is mixed, the same kind never
// twice in a row when it can be helped. A kind that can't be made with this
// «Перенос / заём» (round tens without a carry can't reach…) just gives way.
export function generateCopySheet(count, params) {
  const operation = params?.operation ?? "add";
  const carryMode = params?.carryMode ?? "none";
  let kinds = COPY_KINDS.filter((k) => params?.[k.key]).map((k) => k.id);
  if (!kinds.length) kinds = ["22"];
  const usedPairs = new Set();
  const order = [...kinds].sort(() => Math.random() - 0.5);
  const sheet = [];
  for (let i = 0, misses = 0; sheet.length < count && misses < count * 4; i++) {
    const op = operation === "mixed" ? (Math.random() < 0.5 ? "add" : "subtract") : operation;
    const ex = generateCopyExample(order[i % order.length], op, carryMode, usedPairs);
    if (ex) sheet.push(ex); else misses++;
  }
  for (let i = sheet.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sheet[i], sheet[j]] = [sheet[j], sheet[i]]; }
  for (let i = 1; i < sheet.length; i++) {
    if (sheet[i].kind === sheet[i - 1].kind) {
      const j = sheet.findIndex((e, k) => k > i && e.kind !== sheet[i - 1].kind);
      if (j > 0) [sheet[i], sheet[j]] = [sheet[j], sheet[i]];
    }
  }
  return sheet;
}

// «Контрольная работа» on the tablet: one example of the sheet as a trainer
// task (the child sets it up in the column and solves it).
export function columnTaskOfExample(ex) {
  return trainerTaskFrom(ex, { id: "copy", conceptId: "copy" });
}

function trainerTaskFrom(ex, card) {
  const op = ex.operation;
  const topDigits = width(ex.top), bottomDigits = width(ex.bottom);
  const digits = Math.max(topDigits, bottomDigits);
  const columns = op === "add" ? buildAddColumns(ex.top, ex.bottom, digits, bottomDigits, topDigits) : buildSubColumns(ex.top, ex.bottom, digits, bottomDigits);
  return {
    type: "column_arithmetic",
    cardId: card.id,
    conceptId: card.conceptId,
    operation: op,
    digits,
    top: ex.top,
    bottom: ex.bottom,
    result: op === "add" ? ex.top + ex.bottom : ex.top - ex.bottom,
    columns,
    steps: op === "add" ? buildAddSteps(columns) : buildSubSteps(columns),
  };
}

// ── «Числа в примере» (2026-11-15): each number of the trainer drawn as cells
// the adult taps (owner's design):
//   { top: 1…3, topZeros: [places], bottom: 1…3, bottomZeros: [places] }
// places count from the units (0 = units, 1 = tens). 340 is topZeros [0],
// 305 — [1], 400 — [0, 1]. Either number may be the longer one (25 + 326).
// The leading digit is never 0, and an unmarked cell is never 0 either — a
// zero comes only from a marked cell, so «с нулём» never turns up uninvited.
// The answer is as wide as the longer number (the trainer's answer never
// grows a place). A subtraction example cuts the bottom number to the top's
// length (`normalizeOperands(o, "subtract")`): with «−» the setting itself
// is limited so, in «Микс» only the subtraction examples are — the addition
// ones keep the longer bottom.
function cleanZeros(zeros, digits) {
  return [...new Set((Array.isArray(zeros) ? zeros : []).map(Number))]
    .filter((p) => Number.isInteger(p) && p >= 0 && p < digits - 1)
    .sort((a, b) => a - b);
}

// Settings saved earlier in the day (2026-11-15) had kinds instead of zeros.
const KIND_ZEROS = { round: [0], zero: [1] };

const clampDigits = (n, fallback) => Math.min(3, Math.max(1, Math.round(Number(n)) || fallback));

// A fixed digit (2026-11-26, owner: the same picker as «Слушай и посчитай»): `topFixed` /
// `bottomFixed` — { place: 1…9 }, only when some are set (a 0 stays in the zeros, so settings
// and tests saved before read the same). A leading place may hold a fixed digit, never a 0.
function cleanFixed(fixed, digits, zeros) {
  const out = {};
  if (!fixed || typeof fixed !== "object") return out;
  for (const key of Object.keys(fixed).map(Number).sort((a, b) => a - b)) {
    const d = Number(fixed[key]);
    if (Number.isInteger(key) && key >= 0 && key < digits && Number.isInteger(d) && d >= 1 && d <= 9 && !zeros.includes(key)) out[key] = d;
  }
  return out;
}

export function normalizeOperands(o, operation = "add") {
  const top = clampDigits(o?.top, 2);
  const bottom = Math.min(clampDigits(o?.bottom, top), operation === "add" ? 3 : top);
  const topZeros = cleanZeros(o?.topZeros ?? KIND_ZEROS[o?.topKind], top);
  const bottomZeros = cleanZeros(o?.bottomZeros ?? KIND_ZEROS[o?.bottomKind], bottom);
  const topFixed = cleanFixed(o?.topFixed, top, topZeros);
  const bottomFixed = cleanFixed(o?.bottomFixed, bottom, bottomZeros);
  return {
    top,
    topZeros,
    ...(Object.keys(topFixed).length ? { topFixed } : {}),
    bottom,
    bottomZeros,
    ...(Object.keys(bottomFixed).length ? { bottomFixed } : {}),
  };
}

// What a cell holds: "any" | 0…9 | "none" — the picker's value.
export function operandCell(o, row, place) {
  const digits = o[row];
  if (place >= digits) return "none";
  if (o[`${row}Zeros`].includes(place)) return 0;
  return o[`${row}Fixed`]?.[place] ?? "any";
}

// Puts a picked value into a cell. «нет» cuts the number below that place (the units are always
// there); a value over an empty place grows the number to it (the places between: «любая»).
export function setOperandCell(o, row, place, value, operation = "add") {
  const zerosKey = `${row}Zeros`;
  const fixedKey = `${row}Fixed`;
  let digits = o[row];
  let zeros = [...o[zerosKey]];
  const fixed = { ...(o[fixedKey] ?? {}) };
  if (value === "none") {
    if (place === 0) return normalizeOperands(o, operation);
    digits = Math.min(digits, place);
  } else {
    digits = Math.max(digits, place + 1);
    zeros = zeros.filter((p) => p !== place);
    delete fixed[place];
    if (value === 0) { if (place < digits - 1) zeros.push(place); }
    else if (value !== "any") fixed[place] = value;
  }
  return normalizeOperands({ ...o, [row]: digits, [zerosKey]: zeros, [fixedKey]: fixed }, operation);
}

// Every cell of both numbers fixed (or 0): the same example every time.
export function operandsSingle(o) {
  return ["top", "bottom"].every((row) => {
    for (let p = 0; p < o[row]; p++) if (operandCell(o, row, p) === "any") return false;
    return true;
  });
}

// The old «Разрядность» values, for settings saved before 2026-11-15.
const LEGACY_DIGITS = {
  2: [2, [], 2, []], 3: [3, [], 3, []],
  "2+1": [2, [], 1, []], "3+2": [3, [], 2, []], "3+1": [3, [], 1, []],
  round10: [2, [0], 2, [0]], round: [3, [0], 2, [0]], zero: [3, [1], 2, []],
};

export function resolveOperands(params) {
  if (params?.operands && typeof params.operands === "object") return normalizeOperands(params.operands);
  const [top, topZeros, bottom, bottomZeros] = LEGACY_DIGITS[params?.digits ?? 2] ?? LEGACY_DIGITS[2];
  return normalizeOperands({ top, topZeros, bottom, bottomZeros });
}

// `rng` — a seeded generator for «Контрольные по математике» (the same sheet from the same seed).
function drawOperand(digits, zeros, rng = Math.random, fixed = {}) {
  const int = (min, max) => min + Math.floor(rng() * (max - min + 1));
  const digit = (p, min) => fixed[p] ?? (zeros.includes(p) ? 0 : int(min, 9));
  if (digits === 1) return digit(0, 2);
  let n = 0;
  for (let p = digits - 1; p >= 0; p--) n = n * 10 + digit(p, 1);
  return n;
}

function drawOperandsPair(o, op, carryMode, usedPairs, { rng = Math.random, newPlace = false } = {}) {
  // with fixed digits there may be fewer examples than the lesson asks for: then one repeats
  // rather than the lesson coming out short
  let repeat = null;
  for (let attempt = 0; attempt < 300; attempt++) {
    const top = drawOperand(o.top, o.topZeros, rng, o.topFixed);
    const bottom = drawOperand(o.bottom, o.bottomZeros, rng, o.bottomFixed);
    const answer = op === "add" ? top + bottom : top - bottom;
    if (answer <= 0) continue;
    // the trainer's answer is as wide as the longer number; a test may let it grow or shrink a
    // place (95 + 7 = 102, 102 − 7 = 95) — `newPlace`
    if (!newPlace && width(answer) !== Math.max(width(top), width(bottom))) continue;
    if (carryMode !== "mixed") {
      const crosses = op === "add" ? hasCarry(top, bottom) : hasBorrow(top, bottom);
      if (crosses !== (carryMode === "carry")) continue;
    }
    const pairKey = `${op}:${top},${bottom}`;
    if (usedPairs?.has(pairKey)) { repeat ??= { operation: op, top, bottom }; continue; }
    usedPairs?.add(pairKey);
    return { operation: op, top, bottom };
  }
  return repeat;
}

// A carry the numbers can't have (40 + 50 with «С переносом»: round tens
// carry only into a new place) — the examples come without it rather than not
// at all; `relaxed` tells the settings screen to say so.
export function operandsExample(operands, op, carryMode, usedPairs, options) {
  const o = normalizeOperands(operands, op);
  const ex = drawOperandsPair(o, op, carryMode, usedPairs, options);
  if (ex || carryMode === "mixed") return ex;
  const loose = drawOperandsPair(o, op, "mixed", usedPairs, options);
  return loose && { ...loose, relaxed: true };
}
