export function generatePairs(number) {
  return Array.from({ length: number + 1 }, (_, i) => [i, number - i]);
}

function shuffleArray(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

const SUBTYPE_MAP = {
  fill:      "math_houses",
  read:      "math_houses_read",
  recall:    "math_houses_recall",
  selective: "math_houses_selective",
};

function getModeType(mode) {
  return typeof mode === "string" ? mode : mode?.type ?? mode?.id ?? "math_houses";
}

function resolveActualType(modeType, params) {
  if (modeType !== "math_houses_practice") return modeType;
  return SUBTYPE_MAP[params?.subtype ?? "fill"] ?? "math_houses";
}

function getHouseNumber(card) {
  const raw = card.params?.number ?? card.params?.total ?? 5;
  return Math.max(0, Number(raw) || 5);
}

function normalizeArgs(mode, arg3, arg4) {
  const count = typeof arg3 === "number" ? arg3 : typeof arg4 === "number" ? arg4 : 15;
  const params = (
    arg3 && typeof arg3 === "object" && !Array.isArray(arg3)
      ? arg3
      : arg4 && typeof arg4 === "object" && !Array.isArray(arg4)
        ? arg4
        : {}
  );
  return {
    modeType: getModeType(mode),
    count,
    params,
  };
}

function generateHouseTask(modeType, card, params = {}) {
  const number = getHouseNumber(card);
  const shufflePairs = Boolean(params.shufflePairs);
  const pairs = shufflePairs ? shuffleArray(generatePairs(number)) : generatePairs(number);
  const baseTask = {
    type: modeType,
    cardId: card.id,
    conceptId: card.conceptId,
    number,
    total: number,
    color: card.params?.color || "#2d6fb5",
    pairs,
  };

  if (
    modeType === "math_houses_read" ||
    modeType === "math_houses" ||
    modeType === "math_houses_recall" ||
    modeType === "math_houses_grow"
  ) {
    return baseTask;
  }

  const availableCells = pairs.map((pair, pairIndex) => {
    const hideLeft = Math.random() < 0.5;
    return {
      key: `${pairIndex}:${hideLeft ? "left" : "right"}`,
      pairIndex,
      side: hideLeft ? "left" : "right",
      answer: hideLeft ? pair[0] : pair[1],
      knownValue: hideLeft ? pair[1] : pair[0],
    };
  });
  const hiddenWindowCount = Math.max(
    1,
    Math.min(
      availableCells.length,
      Number(params.hiddenWindows) || 1,
    ),
  );
  const hiddenCells = shuffleArray(availableCells)
    .slice(0, hiddenWindowCount)
    .sort((a, b) => a.pairIndex - b.pairIndex || a.side.localeCompare(b.side));
  const firstHiddenCell = hiddenCells[0];

  return {
    ...baseTask,
    type: "math_houses_selective",
    hiddenCells,
    hiddenPairIndex: firstHiddenCell.pairIndex,
    hiddenSide: firstHiddenCell.side,
    answer: firstHiddenCell.answer,
    knownValue: firstHiddenCell.knownValue,
  };
}

export function generateTasks(mode, cards, arg3, arg4) {
  if (!cards.length) return [];
  const { modeType, count, params } = normalizeArgs(mode, arg3, arg4);
  const actualType = resolveActualType(modeType, params);
  if (
    actualType === "math_houses_read" ||
    actualType === "math_houses" ||
    actualType === "math_houses_recall" ||
    actualType === "math_houses_grow"
  ) {
    return cards.map((card) => generateHouseTask(actualType, card));
  }
  return Array.from({ length: count }, (_, i) =>
    generateHouseTask(actualType, cards[i % cards.length], params)
  );
}
