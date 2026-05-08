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

function buildOperationTask(modeType, card, params = {}) {
  const operation = normalizeOperation(card.params?.operation);
  const maxNumber = Math.max(3, Math.min(DEFAULT_RAIL_SIZE, toNumber(params.maxNumber, DEFAULT_MAX_NUMBER)));
  const railSize = Math.max(maxNumber, toNumber(params.railSize, DEFAULT_RAIL_SIZE));
  const changeMax = Math.max(1, Math.min(maxNumber - 1, toNumber(params.changeMax, DEFAULT_CHANGE_MAX)));
  const includeZero = Boolean(params.includeZero);
  const associationDirection = modeType === "operation_action_from_sign"
    ? (Math.random() < 0.5 ? "sign_to_action" : "action_to_sign")
    : undefined;

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

  return shuffle(Array.from({ length: count }, (_, index) =>
    buildOperationTask(modeType, operationCards[index % operationCards.length], params)
  ));
}
