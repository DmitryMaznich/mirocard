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

export function generateBuildNumberTask(card, maxOnes, maxTens) {
  const { tens, ones } = randomPlaceValueNumber(maxOnes, maxTens);
  return {
    type: "build_number",
    cardId: card.id,
    conceptId: card.conceptId,
    number: tens * 10 + ones,
    target: { tens, ones },
  };
}

// identify_number only: occasionally mixes in round tens (ones = 0, e.g.
// 30/40/50) and bare single digits (tens = 0, e.g. 7) among the regular
// two-digit draws. Left out of the shared randomPlaceValueNumber above —
// build_number has nothing new to demonstrate on a round ten, and
// exchange_ten builds its own start numbers (generateExchangeTask), so neither
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


export function generateTasks(modeOrObj, cards, countOrParams, maybeParams) {
  const mode = typeof modeOrObj === "string" ? modeOrObj : (modeOrObj?.type ?? modeOrObj?.id ?? "");
  const count = typeof countOrParams === "number" ? countOrParams : 15;
  const params = (countOrParams && typeof countOrParams === "object") ? countOrParams
    : (maybeParams && typeof maybeParams === "object") ? maybeParams : {};

  const allCards = cards.filter(c => c.renderer === "place_value");
  const buildNumberCards    = allCards.filter(c => c.params?.mode === "build_number");
  const identifyNumberCards = allCards.filter(c => c.params?.mode === "identify_number");
  const exchangeCards       = allCards.filter(c => c.params?.mode === "exchange_ten");
  const groupTenCards       = allCards.filter(c => c.params?.mode === "group_ten");

  if (mode === "build_number") {
    if (!buildNumberCards.length) return [];
    const maxOnes = Number(params.maxOnes ?? 9);
    const maxTens = params.numberRange === "teens" ? 1 : Number(params.maxTens ?? 5);
    const prompt = params.prompt ?? "digits";
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push({
        ...generateBuildNumberTask(buildNumberCards[i % buildNumberCards.length], maxOnes, maxTens),
        // «Цифрами» / «Словами» / «Микс» — how the number is given (see BuildNumberTask).
        prompt: prompt === "mix" ? (Math.random() < 0.5 ? "digits" : "words") : prompt === "words" ? "words" : "digits",
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
      const task = generateIdentifyNumberTask(identifyNumberCards[i % identifyNumberCards.length], maxOnes, Number(params.maxTens ?? 9), params.numberSet ?? "mixed");
      tasks.push({
        ...task,
        ...identifyLayout(task.number, params.layout ?? "places"),
        seed: randomInt(1, 100000),
        supportMode: params.supportMode ?? "learning",
      });
    }
    return tasks;
  }

  if (mode === "group_ten") {
    if (!groupTenCards.length) return [];
    const numbers = groupTenNumbers(params.numberRange ?? "teens", count);
    return numbers.map((number, i) => ({
      type: "group_ten",
      cardId: groupTenCards[i % groupTenCards.length].id,
      conceptId: groupTenCards[i % groupTenCards.length].conceptId,
      number,
      tens: Math.floor(number / 10),
      ones: number % 10,
      seed: randomInt(1, 100000),
      supportMode: params.supportMode ?? "learning",
      showFrame: params.showFrame !== false,
    }));
  }

  if (mode === "exchange_ten") {
    if (!exchangeCards.length) return [];
    const flags = exchangeFlags(count);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push({
        ...generateExchangeTask(exchangeCards[i % exchangeCards.length], params, flags[i]),
        supportMode: params.supportMode ?? "learning",
        showColumn: Boolean(params.showColumn),
      });
    }
    return tasks;
  }

  return [];
}

// «Обмен десятка»: the model of `number` plus an action with a reason —
// «Отдай k» (give) or «Получи k» (get). generateTasks passes `needsExchange`
// so that half of a session needs an exchange (break a ten when there aren't
// enough ones / build a ten when ones reach ten) and half doesn't — the child
// has to decide each time. Results stay within 1..99.
export function generateExchangeTask(card, params = {}, needsExchange = true) {
  const maxTens = Math.min(9, Math.max(1, Number(params.maxTens ?? 5)));
  const operation = params.operation ?? "give";
  const op = operation === "mixed" ? (Math.random() < 0.5 ? "give" : "get") : operation === "get" ? "get" : "give";
  const exchangeOf = (tens, ones, k) => (op === "give" ? k > ones : ones + k >= 10);
  const resultOf = (tens, ones, k) => (op === "give" ? tens * 10 + ones - k : tens * 10 + ones + k);
  let tens = 1, ones = 0, k = 1;
  for (let attempt = 0; attempt < 500; attempt++) {
    const t = randomInt(1, maxTens), o = randomInt(0, 9), n = randomInt(1, 9);
    const result = resultOf(t, o, n);
    if (exchangeOf(t, o, n) !== needsExchange || result < 1 || result > 99) continue;
    tens = t; ones = o; k = n;
    break;
  }
  const number = tens * 10 + ones;
  return {
    type: "exchange_ten",
    cardId: card.id,
    conceptId: card.conceptId,
    op,
    k,
    number,
    start: { tens, ones },
    result: resultOf(tens, ones, k),
    needsExchange: exchangeOf(tens, ones, k),
  };
}

function exchangeFlags(count) {
  const flags = Array.from({ length: count }, (_, i) => i % 2 === 0);
  for (let i = flags.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [flags[i], flags[j]] = [flags[j], flags[i]];
  }
  return flags;
}

// «Сложи по десять»: how many loose coins lie in the heap. Ranges follow the
// methodology: 11–19 (one stack), 20–49, round tens (nothing left over), or a
// mix. Nothing above 49 — the point is grouping, and counting 60 coins one by
// one only tires the child. Numbers don't repeat until the pool runs out.
const GROUP_TEN_RANGES = {
  teens: () => Array.from({ length: 9 }, (_, i) => 11 + i),
  to49: () => Array.from({ length: 30 }, (_, i) => 20 + i).filter((n) => n % 10 !== 0),
  round: () => [20, 30, 40],
};

export function groupTenNumbers(range, count) {
  const pool = range === "mixed"
    ? [...GROUP_TEN_RANGES.teens(), ...GROUP_TEN_RANGES.to49(), ...GROUP_TEN_RANGES.round()]
    : (GROUP_TEN_RANGES[range] ?? GROUP_TEN_RANGES.teens)();
  const out = [];
  while (out.length < count) {
    const round = [...pool];
    for (let i = round.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [round[i], round[j]] = [round[j], round[i]];
    }
    if (out.length && round[0] === out[out.length - 1] && round.length > 1) [round[0], round[1]] = [round[1], round[0]];
    out.push(...round);
  }
  return out.slice(0, count);
}

// «Какое это число?» model layouts (docs/place-value-methodology.md, режим 2):
// "places" — tens and ones in their own labelled zones; "mixed" — one shared
// zone, loose coins placed left of the stacks (catches reading left to right:
// 3 coins + 2 stacks → «32»); "over9" — one stack fewer and ten more loose
// coins (34 shown as 2 stacks + 14 coins). "mix" picks one per task. "over9"
// needs at least one ten, so it falls back to "places" for one-digit numbers.
export function identifyLayout(number, setting) {
  const tens = Math.floor(number / 10), ones = number % 10;
  const choices = ["places", "mixed", "over9"];
  let layout = setting === "mix" ? choices[randomInt(0, 2)] : choices.includes(setting) ? setting : "places";
  if (layout === "over9" && tens === 0) layout = "places";
  const model = layout === "over9" ? { tens: tens - 1, ones: ones + 10 } : { tens, ones };
  return { layout, model };
}
