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
    cols.push({ position: POSITIONS[i], topDigit: td[i], bottomDigit: bd[i], hasBottomDigit: i < bottomDigits, borrowIn: borrow, borrowOut, effectiveTopDigit, compareTopDigit: effective, writeDigit });
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
// digits real — no bottomDigits narrowing needed). Both generateTasks and
// generateExamples resolve either the same way: grid width (digits) stays 2.
function resolveDigitsParam(digitsParam) {
  const mixedWidth = digitsParam === "2+1";
  const roundTens = digitsParam === "round10";
  const digits = mixedWidth || roundTens ? 2 : Number(digitsParam ?? 2);
  const bottomDigits = mixedWidth ? 1 : digits;
  return { digits, bottomDigits, roundTens };
}

export function generateExamples(count, params) {
  const operation = params?.operation ?? "add";
  const carryMode = params?.carryMode ?? "none";
  const { digits, bottomDigits, roundTens } = resolveDigitsParam(params?.digits);
  const fakeCard = { id: "copy", conceptId: "copy" };
  const results = [];
  const usedPairs = new Set();
  let attempts = 0;
  while (results.length < count && attempts < count * 30) {
    attempts++;
    const op = operation === "mixed" ? (Math.random() < 0.5 ? "add" : "subtract") : operation;
    const t = op === "add"
      ? generateAddTask(carryMode, digits, fakeCard, usedPairs, bottomDigits, roundTens)
      : generateSubTask(carryMode, digits, fakeCard, usedPairs, bottomDigits, roundTens);
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

  // column_arithmetic — cards with params.mode belonged to modes that moved out
  // (fingers → addition_subtraction, coins → place_value); older decks still carry them.
  const arithmeticCards = allCards.filter(c => !c.params?.mode);
  if (!arithmeticCards.length) return [];

  const operation = params.operation ?? "add";
  const carryMode = params.carryMode ?? "none";
  const { digits, bottomDigits, roundTens } = resolveDigitsParam(params.digits);

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
      ? generateAddTask(carryMode, digits, card, usedPairs, bottomDigits, roundTens)
      : generateSubTask(carryMode, digits, card, usedPairs, bottomDigits, roundTens);
    if (task) { tasks.push(task); idx++; }
  }

  return tasks;
}
