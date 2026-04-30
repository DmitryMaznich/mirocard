export function generatePairs(number) {
  return Array.from({ length: number + 1 }, (_, i) => [i, number - i]);
}

function generateHouseTask(modeType, card) {
  const { number = 5 } = card.params ?? {};
  const pairs = generatePairs(number);

  if (modeType === "math_houses_read") {
    return { type: modeType, conceptId: card.conceptId, number, pairs };
  }

  const hiddenPairIndex = Math.floor(Math.random() * pairs.length);
  const hiddenSide      = Math.random() < 0.5 ? "left" : "right";
  const pair            = pairs[hiddenPairIndex];
  const answer          = hiddenSide === "left" ? pair[0] : pair[1];
  const knownValue      = hiddenSide === "left" ? pair[1] : pair[0];

  return {
    type: "math_houses",
    conceptId: card.conceptId,
    number,
    pairs,
    hiddenPairIndex,
    hiddenSide,
    answer,
    knownValue,
  };
}

export function generateTasks(modeType, cards, params, count = 15) {
  if (!cards.length) return [];
  return Array.from({ length: count }, (_, i) =>
    generateHouseTask(modeType, cards[i % cards.length])
  );
}
