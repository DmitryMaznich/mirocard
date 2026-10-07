// "Разряды числа" (place_value): number models built from coins (единицы) and
// stacks of ten (десятки). Split out of column_addition, where these three
// modes used to live as a warm-up before the column trainer.

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

export function generateIdentifyNumberTask(card, maxOnes, maxTens = 9, numberSet = "mixed") {
  let value;
  if (numberSet === "single") value = { tens: 0, ones: randomInt(1, Math.max(1, Number(maxOnes))) };
  else if (numberSet === "round") value = { tens: randomInt(1, Number(maxTens)), ones: 0 };
  else if (numberSet === "two_digit") value = randomPlaceValueNumber(maxOnes, maxTens);
  else value = randomIdentifyNumberValue(maxOnes, maxTens);
  const { tens, ones } = value;
  return {
    type: "identify_number",
    cardId: card.id,
    conceptId: card.conceptId,
    maxOnes: Number(maxOnes),
    number: tens * 10 + ones,
    model: { tens, ones },
  };
}

export function generateRegroupTask(card, maxOnes, maxTens = 9) {
  const { tens, ones } = randomPlaceValueNumber(maxOnes, maxTens);
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

export function generateTasks(modeOrObj, cards, countOrParams, maybeParams) {
  const mode = typeof modeOrObj === "string" ? modeOrObj : (modeOrObj?.type ?? modeOrObj?.id ?? "");
  const count = typeof countOrParams === "number" ? countOrParams : 15;
  const params = (countOrParams && typeof countOrParams === "object") ? countOrParams
    : (maybeParams && typeof maybeParams === "object") ? maybeParams : {};

  const allCards = cards.filter(c => c.renderer === "place_value");
  const buildNumberCards    = allCards.filter(c => c.params?.mode === "build_number");
  const identifyNumberCards = allCards.filter(c => c.params?.mode === "identify_number");
  const regroupTenCards     = allCards.filter(c => c.params?.mode === "regroup_ten");

  if (mode === "build_number") {
    if (!buildNumberCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const maxTens = params.numberRange === "teens" ? 1 : Number(params.maxTens ?? 3);
    const numericBlocks = params.numericBlocks ?? false;
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push({
        ...generateBuildNumberTask(buildNumberCards[i % buildNumberCards.length], maxOnes, maxTens, numericBlocks),
        buildApproach: params.buildApproach ?? "group",
        askComposition: Boolean(params.askComposition),
        supportMode: params.supportMode ?? "learning",
      });
    }
    return tasks;
  }

  if (mode === "identify_number") {
    if (!identifyNumberCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push({
        ...generateIdentifyNumberTask(identifyNumberCards[i % identifyNumberCards.length], maxOnes, Number(params.maxTens ?? 9), params.numberSet ?? "mixed"),
        supportMode: params.supportMode ?? "learning",
      });
    }
    return tasks;
  }

  if (mode === "regroup_ten") {
    if (!regroupTenCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push({
        ...generateRegroupTask(regroupTenCards[i % regroupTenCards.length], maxOnes, Number(params.maxTens ?? 9)),
        supportMode: params.supportMode ?? "learning",
        allowReverse: params.allowReverse !== false,
      });
    }
    return tasks;
  }

  return [];
}
