import { shuffle } from "@/shared/utils/shuffle";

const DEFAULT_MAX_NUMBER = 5;
const DEFAULT_CHANGE_MAX = 1;
const DEFAULT_RAIL_SIZE = 20;

function getModeType(mode) {
  return typeof mode === "string" ? mode : mode?.type ?? mode?.id ?? "operation_result";
}

function normalizeOperation(rawOperation) {
  return rawOperation === "subtract" || rawOperation === "minus" ? "subtract" : "add";
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function randomInt(min, max) {
  const safeMin = Math.ceil(min);
  const safeMax = Math.floor(max);
  if (safeMax <= safeMin) return safeMin;
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function makeNumberOptions(answer, maxNumber, optionCount = 4) {
  const max = Math.max(1, maxNumber);
  const values = new Set([answer]);
  const offsets = shuffle([-2, -1, 1, 2, -3, 3, -4, 4]);

  for (const offset of offsets) {
    const candidate = answer + offset;
    if (candidate >= 0 && candidate <= max) values.add(candidate);
    if (values.size >= optionCount) break;
  }

  while (values.size < Math.min(optionCount, max + 1)) {
    values.add(randomInt(0, max));
  }

  return shuffle([...values]);
}

function resolveAssociationDirection(modeType, params, taskIndex) {
  if (modeType !== "operation_action_from_sign") return undefined;
  const direction = params.direction ?? "alternating";
  if (direction === "sign_to_action") return "sign_to_action";
  if (direction === "action_to_sign") return "action_to_sign";
  if (direction === "random") return Math.random() < 0.5 ? "sign_to_action" : "action_to_sign";
  return taskIndex % 2 === 0 ? "sign_to_action" : "action_to_sign";
}

function buildOperationTask(modeType, card, params = {}, taskIndex = 0) {
  const operation = normalizeOperation(card.params?.operation);
  const railSize = Math.max(3, Math.min(DEFAULT_RAIL_SIZE, toNumber(params.railSize ?? params.maxNumber, DEFAULT_RAIL_SIZE)));
  const maxNumber = railSize;
  const changeMax = Math.max(1, Math.min(maxNumber - 1, toNumber(params.changeMax, DEFAULT_CHANGE_MAX)));
  const includeZero = Boolean(params.includeZero);
  const associationDirection = resolveAssociationDirection(modeType, params, taskIndex);
  const extraParams = {
    showHelper: Boolean(params.showHelper),
    showMoveHint: Boolean(params.showMoveHint),
    showInstruction: params.showInstruction === false ? false : true,
    inputMode: params.inputMode ?? "choices",
    timer: params.timer ?? null,
  };

  let delta = randomInt(1, changeMax);
  const minResult = includeZero ? 0 : 1;
  const minStart = includeZero ? 0 : 1;

  if (operation === "add") {
    const start = randomInt(minStart, Math.max(minStart, maxNumber - delta));
    const result = start + delta;
    return {
      type: modeType,
      cardId: card.id,
      conceptId: card.conceptId,
      operation,
      sign: "+",
      action: "add",
      actionLabel: "добавь",
      start,
      delta,
      result,
      maxNumber,
      railSize,
      associationDirection,
      resultOptions: makeNumberOptions(result, maxNumber),
      ...extraParams,
    };
  }

  while (delta + minResult > maxNumber && delta > 1) delta -= 1;
  const start = randomInt(delta + minResult, maxNumber);
  const result = start - delta;

  return {
    type: modeType,
    cardId: card.id,
    conceptId: card.conceptId,
    operation,
    sign: "-",
    action: "remove",
    actionLabel: "убери",
    start,
    delta,
    result,
    maxNumber,
    railSize,
    associationDirection,
    resultOptions: makeNumberOptions(result, maxNumber),
    ...extraParams,
  };
}

function buildChainTask(card, params = {}) {
  const railSize = Math.max(3, Math.min(DEFAULT_RAIL_SIZE, toNumber(params.railSize ?? params.maxNumber, DEFAULT_RAIL_SIZE)));
  const maxNumber = railSize;
  const changeMax = Math.max(1, Math.min(Math.floor(maxNumber / 2), toNumber(params.changeMax, DEFAULT_CHANGE_MAX)));
  const includeZero = Boolean(params.includeZero);
  const minVal = includeZero ? 0 : 1;
  const extraParams = {
    showHelper: Boolean(params.showHelper),
    showMoveHint: Boolean(params.showMoveHint),
    inputMode: params.inputMode ?? "choices",
    timer: params.timer ?? null,
  };

  const B = randomInt(1, changeMax);
  const C = randomInt(1, changeMax);
  const caseIdx = Math.floor(Math.random() * 4);

  let A, opAB, signAB, opBC, signBC, intermediate, result;

  if (caseIdx === 0) {
    // A + B + C; need A + B + C <= maxNumber
    const maxA = maxNumber - B - C;
    if (maxA < minVal) return null;
    A = randomInt(minVal, maxA);
    opAB = "add"; signAB = "+"; opBC = "add"; signBC = "+";
    intermediate = A + B;
    result = intermediate + C;
  } else if (caseIdx === 1) {
    // A + B - C; need A + B <= maxNumber, A + B - C >= minVal
    const minA = Math.max(minVal, minVal + C - B);
    const maxA = maxNumber - B;
    if (maxA < minA) return null;
    A = randomInt(minA, maxA);
    opAB = "add"; signAB = "+"; opBC = "subtract"; signBC = "-";
    intermediate = A + B;
    result = intermediate - C;
  } else if (caseIdx === 2) {
    // A - B + C; need A - B >= minVal, A - B + C <= maxNumber
    const minA = B + minVal;
    const maxA = Math.min(maxNumber, maxNumber + B - C);
    if (maxA < minA) return null;
    A = randomInt(minA, maxA);
    opAB = "subtract"; signAB = "-"; opBC = "add"; signBC = "+";
    intermediate = A - B;
    result = intermediate + C;
  } else {
    // A - B - C; need A - B - C >= minVal => A >= B + C + minVal
    const minA = B + C + minVal;
    if (minA > maxNumber) return null;
    A = randomInt(minA, maxNumber);
    opAB = "subtract"; signAB = "-"; opBC = "subtract"; signBC = "-";
    intermediate = A - B;
    result = intermediate - C;
  }

  return {
    type: "operation_chain",
    cardId: card.id,
    conceptId: card.conceptId,
    A, B, C,
    opAB, signAB,
    opBC, signBC,
    intermediate,
    result,
    maxNumber,
    resultOptions: makeNumberOptions(result, maxNumber),
    ...extraParams,
  };
}

export function generateTasks(mode, cards, arg3, arg4) {
  const count = typeof arg3 === "number" ? arg3 : typeof arg4 === "number" ? arg4 : 15;
  const params = (
    arg3 && typeof arg3 === "object" && !Array.isArray(arg3)
      ? arg3
      : arg4 && typeof arg4 === "object" && !Array.isArray(arg4)
        ? arg4
        : {}
  );
  const modeType = getModeType(mode);
  const operationCards = cards.filter((card) => card.renderer === "addition_subtraction");

  if (!operationCards.length) return [];

  if (modeType === "operation_worksheet") {
    const groupCount = Math.max(2, Math.min(8, toNumber(params.groupCount, 6)));
    const perGroup = Math.max(3, Math.min(10, toNumber(params.perGroup, 6)));
    const total = groupCount * perGroup;
    const examples = [];
    let attempts = 0;
    let idx = 0;
    while (examples.length < total && attempts < total * 20) {
      attempts++;
      const card = operationCards[idx % operationCards.length];
      const ex = buildChainTask(card, params);
      if (ex !== null) { examples.push(ex); idx++; }
    }
    return [{ type: "operation_worksheet", cardId: operationCards[0].id, conceptId: operationCards[0].conceptId, examples, groupCount, perGroup }];
  }

  if (modeType === "operation_chain") {
    const result = [];
    let attempts = 0;
    while (result.length < count && attempts < count * 20) {
      attempts++;
      const card = operationCards[result.length % operationCards.length];
      const task = buildChainTask(card, params);
      if (task !== null) result.push(task);
    }
    return shuffle(result);
  }

  return shuffle(Array.from({ length: count }, (_, index) =>
    buildOperationTask(modeType, operationCards[index % operationCards.length], params, index)
  ));
}
