const POSITIONS = ["units", "tens", "hundreds"];

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
function buildAddColumns(top, bottom, digits, bottomDigits = digits) {
  const td = getDigits(top, digits);
  const bd = getDigits(bottom, digits);
  const cols = [];
  let carry = 0;
  for (let i = 0; i < digits; i++) {
    const sum = td[i] + bd[i] + carry;
    const writeDigit = sum % 10;
    const carryOut = Math.floor(sum / 10);
    cols.push({ position: POSITIONS[i], topDigit: td[i], bottomDigit: bd[i], hasBottomDigit: i < bottomDigits, carryIn: carry, carryOut, writeDigit });
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
    // The zero in the middle was settled when the column below it borrowed
    // (the school's order: the hundreds give first, 3 → 2, then the 0 of the
    // tens becomes 10 and gives one, 9): only its result is left.
    if (col.throughZero) {
      if (next || col.writeDigit !== 0) steps.push({ cellType: "result", position: col.position, digit: col.writeDigit });
      continue;
    }
    if (col.borrowOut > 0 && next?.throughZero) {
      const far = columns[i + 2];
      steps.push({ cellType: "borrow", position: col.position, digit: 1 });
      steps.push({ cellType: "result", position: col.position, digit: col.writeDigit });
      steps.push({ cellType: "crossout", position: far.position, digit: null });
      steps.push({ cellType: "adjust", position: far.position, digit: far.topDigit - 1 });
      steps.push({ cellType: "crossout", position: next.position, digit: null });
      steps.push({ cellType: "adjust", position: next.position, digit: 9 });
      continue;
    }
    if (col.borrowOut > 0 && next) {
      // "borrow" sits at the column that RECEIVES the extra ten (the one that
      // was short) — the child types "1" here to acknowledge the borrow.
      steps.push({ cellType: "borrow", position: col.position, digit: 1 });
    }
    // 102 − 7 = 95: a leading zero is not written.
    if (!next && i > 0 && col.writeDigit === 0) continue;
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

function generateAddTask(carryMode, digits, card, usedPairs, bottomDigits = digits, roundTens = false) {
  for (let attempt = 0; attempt < 100; attempt++) {
    let top, bottom;
    if (roundTens) {
      // "Круглые дес.": both operands are plain multiples of 10 (units digit
      // genuinely 0 for both, not a phantom column). The sum must never
      // exceed 100 — see the `top + bottom > 100` reject below — so "с
      // переносом" here means exactly "reaching 100" (e.g. 40+60=100), not
      // climbing arbitrarily into the hundreds (60+70=130 is NOT allowed).
      top = randomInt(1, 9) * 10;
      bottom = randomInt(1, 9) * 10;
    } else if (bottomDigits < digits) {
      // Mixed width ("2-зн. + 1-зн."): the search space is small (≤90×9), so
      // plain random + retry-on-mismatch below is simpler than hand-tuning
      // ranges the way the uniform-width branches do.
      top = randomInt(10 ** (digits - 1), 10 ** digits - 1);
      bottom = randomInt(1, 10 ** bottomDigits - 1);
    } else if (digits === 2) {
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
    const columns = buildAddColumns(top, bottom, digits, bottomDigits);
    const hasCarry = columns.some(c => c.carryOut > 0);
    if (carryMode === "none" && hasCarry) continue;
    if (carryMode === "carry" && !hasCarry) continue;
    // Neither "Круглые дес." nor "2-зн. + 1-зн." should ever spill a digit
    // past the grid's own width — 60+70=130 and 97+4=101 both broke this the
    // same way (a carry cascading past the last real column, e.g. 97's tens
    // digit being 9 pushes a units carry straight into hundreds). Plain
    // uniform-width digits (2 or 3) already stay in-range by construction in
    // the branches above, so these rejects only ever fire for these two.
    // Round-tens' own cap is the round number itself (100), one higher than
    // "2+1"'s (99 — same ceiling as plain 2-значные addition), since
    // round-tens carryMode:"carry" is specifically about reaching exactly
    // that boundary (40+60=100), not staying strictly under it.
    if (roundTens && top + bottom > 10 ** digits) continue;
    if (bottomDigits < digits && top + bottom > 10 ** digits - 1) continue;
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

function generateSubTask(carryMode, digits, card, usedPairs, bottomDigits = digits, roundTens = false) {
  for (let attempt = 0; attempt < 100; attempt++) {
    let top, bottom;
    if (roundTens) {
      // Round-tens subtraction never borrows: units are 0−0 for both, and
      // top's tens digit is constructed to always be ≥ bottom's (strictly
      // greater — same "never a 0 result" convention as the other branches).
      // carryMode is therefore meaningless here; see the skip below.
      const topTens = randomInt(2, 9);
      const bottomTens = randomInt(1, topTens - 1);
      top = topTens * 10;
      bottom = bottomTens * 10;
    } else if (bottomDigits < digits) {
      // top (2-зн.) is always ≥ 10 > 9 ≥ bottom (1-зн.), so top > bottom is
      // guaranteed without extra range-juggling — same retry-on-mismatch
      // reasoning as the addition branch above.
      top = randomInt(10 ** (digits - 1), 10 ** digits - 1);
      bottom = randomInt(1, 10 ** bottomDigits - 1);
    } else if (digits === 2) {
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
    const columns = buildSubColumns(top, bottom, digits, bottomDigits);
    const hasBorrow = columns.some(c => c.borrowOut > 0);
    // A round-tens borrow is structurally impossible — filtering on carryMode
    // here would make carryMode:"carry" retry all 100 attempts and always
    // fail, starving the session of tasks. carryMode simply doesn't apply.
    if (!roundTens) {
      if (carryMode === "none" && hasBorrow) continue;
      if (carryMode === "carry" && !hasBorrow) continue;
    }
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

// "2+1" and "round10" are the two non-numeric `digits` values. "2+1" is a
// shorthand for "top is 2-значное, bottom is 1-значное" (uneven width);
// "round10" means both operands are plain multiples of 10 (even width, both
// digits real — no bottomDigits narrowing needed). Grid width (digits) stays 2.
function resolveDigitsParam(digitsParam) {
  const mixedWidth = digitsParam === "2+1";
  const roundTens = digitsParam === "round10";
  const digits = mixedWidth || roundTens ? 2 : Number(digitsParam ?? 2);
  const bottomDigits = mixedWidth ? 1 : digits;
  return { digits, bottomDigits, roundTens };
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
  const { digits, bottomDigits, roundTens } = resolveDigitsParam(params.digits);
  const kind = TRAINER_KINDS[params.digits];

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
    const task = kind ? trainerTaskOfKind(kind, op, carryMode, card, usedPairs)
      : op === "add"
        ? generateAddTask(carryMode, digits, card, usedPairs, bottomDigits, roundTens)
        : generateSubTask(carryMode, digits, card, usedPairs, bottomDigits, roundTens);
    if (task) { tasks.push(task); idx++; }
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

// «Разрядность» of the trainer that come from the sheet's kinds (3 + 2, 3 + 1,
// круглые до 1000, с нулём): numbers as in the check, the grid as wide as the
// top number — the answer never grows a place here (no «Новый разряд»).
const TRAINER_KINDS = { "3+2": "32", "3+1": "31", round: "round", zero: "zero" };

function trainerTaskOfKind(kind, op, carryMode, card, usedPairs) {
  const ex = generateCopyExample(kind, op, carryMode, usedPairs);
  return ex && trainerTaskFrom(ex, card);
}

function trainerTaskFrom(ex, card) {
  const op = ex.operation;
  const digits = width(ex.top), bottomDigits = width(ex.bottom);
  const columns = op === "add" ? buildAddColumns(ex.top, ex.bottom, digits, bottomDigits) : buildSubColumns(ex.top, ex.bottom, digits, bottomDigits);
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
