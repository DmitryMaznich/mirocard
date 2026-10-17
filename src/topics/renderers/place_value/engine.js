import { numberNameOptions, numberNamesNumber } from "./numberNames.js";
// "Разряды числа" (place_value): number models built from coins (единицы) and
// stacks of ten (десятки). Split out of column_addition, where these three
// modes used to live as a warm-up before the column trainer.

// «Какое число дальше?» after `n` (counting by tens): the right one and the two
// mistakes that matter — a unit added instead of a ten (91), and the one of
// this number: 90 → 900 (heard «девяносто» → «девятьсот»), 100 → 1010 («сто
// десять» written as heard), elsewhere a hundred added instead of a ten
// (190 → 290: the first digit taken for «the one that grows»).
export function countTensOptions(n) {
  const right = n + 10;
  const special = n === 90 ? 900 : n % 100 === 0 ? Number(`${n / 10}10`) : n + 100;
  const options = [right, n + 1, special];
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  return options;
}

// «Какое число перед?» before `n` (n >= 100): the right one, a unit taken
// instead of a ten (100 → 99) and a hundred taken instead (100 → 0, 140 → 40).
export function countTensPrevOptions(n) {
  const options = [n - 10, n - 1, n - 100];
  for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  return options;
}

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


// The params a session runs with: a saved value the mode no longer offers
// («Круглые сотни» saved in «1. Двузначные: читаем и пишем» before the hundreds got their
// own items) falls back to the mode's default, and the mode's `preset` (the
// range of the numbered items, topicLoader.js) wins over anything saved.
export function modeParams(modeOrObj, params) {
  if (!modeOrObj || typeof modeOrObj !== "object") return params;
  const out = { ...params };
  for (const [key, def] of Object.entries(modeOrObj.params ?? {})) {
    if (def?.type === "enum" && key in out && !def.values?.includes(out[key])) out[key] = def.default;
  }
  const type = modeOrObj.type ?? modeOrObj.id;
  return withHints(type, internalParams(type, { ...out, ...(modeOrObj.preset ?? {}) }));
}

// «Контрольная работа: до 100» / «Контрольная работа: сотни» (type "pv_test"): the skills and
// pictures the adult switched on, tasks mixed, no hints (supportMode
// "independent"), one answer each — a mistake moves on (SessionScreen's
// instant-incorrect path), the session ends after the last task (`finite`).
// Each task is counted by skill and picture (`targetConceptId` "skill:view"),
// for the result by skill and by picture (SessionSummary.jsx).
// docs/place-value-methodology.md, раздел 16.
export const CHECK_VIEWS = { coins: "Монеты", scheme: "Схема", table: "Таблица" };
const PICTURES = ["coins", "scheme", "table"];
export const CHECK_SKILLS = {
  to100: [
    { key: "s100_names", label: "Двузначные: читаем и пишем", hint: "на слух и словами", modeId: "number_names", type: "number_names", params: () => ({ set: "mix100", task: pick(["choose", "read", "write"]) }) },
    { key: "s100_identify", label: "Какое это число?", modeId: "identify_number", type: "identify_number", views: PICTURES, params: () => ({ range: "to100", maxTens: 9, maxOnes: 9, numberSet: "two_digit", layout: "places" }) },
    { key: "s100_build", label: "Собери число", modeId: "build_number", type: "build_number", views: PICTURES, params: () => ({ range: "to100", maxTens: 9, maxOnes: 9, numberRange: "custom", prompt: "mix" }) },
    { key: "s100_parts", label: "Разрядные слагаемые", hint: "цифрами и словами", modeId: "place_parts", type: "place_parts", params: () => ({ range: "to100", maxTens: 9, direction: "mix", prompt: "mix" }) },
    // Coins are too slow for a check (coins moved one by one): scheme and table only.
    { key: "s100_exchange", label: "Плюс и минус через десяток", modeId: "exchange_ten", type: "exchange_ten", views: ["scheme", "table"], params: () => ({ range: "to100", maxTens: 9, operation: "mixed", secondNumber: "one" }) },
  ],
  to1000: [
    { key: "s1000_names", label: "Трёхзначные: читаем и пишем", hint: "на слух и словами", modeId: "number_names_hundreds", type: "number_names", params: () => ({ set: "mix1000", task: pick(["choose", "read", "write"]) }) },
    { key: "s1000_count", label: "Какое число дальше и перед?", hint: "счёт десятками через сотню", modeId: "count_tens", type: "count_tens", params: () => ({ range: "to1000", task: pick(["next", "prev"]) }) },
    { key: "s1000_identify", label: "Сотни: какое это число?", modeId: "identify_hundreds", type: "identify_number", views: PICTURES, params: () => ({ range: "to1000" }) },
    { key: "s1000_build", label: "Сотни: собери число", modeId: "build_hundreds", type: "build_number", views: PICTURES, params: () => ({ range: "to1000", prompt: "mix" }) },
    { key: "s1000_parts", label: "Разрядные слагаемые до 1000", hint: "цифрами и словами", modeId: "place_parts_hundreds", type: "place_parts", params: () => ({ range: "to1000", direction: "mix", prompt: "mix" }) },
    { key: "s1000_exchange", label: "Плюс и минус через сотню", modeId: "exchange_hundred", type: "exchange_ten", views: ["scheme", "table"], params: () => ({ range: "to1000", operation: "mixed" }) },
  ],
};
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const shuffled = (items) => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

export function generateCheckTasks(cards, params) {
  const part = params.part === "to1000" ? "to1000" : "to100";
  const prefix = part === "to1000" ? "p1000_" : "p100_";
  const skills = CHECK_SKILLS[part].filter((s) => params[s.key]);
  const pictures = PICTURES.filter((v) => params[`${prefix}${v}`]);
  const count = Number(params.count) === 15 ? 15 : 10;
  if (!skills.length) return [];
  // Each skill gets its share; its pictures take turns (the adult's pictures it
  // has, else the first it has — exchange on coins becomes the scheme).
  const plan = [];
  const viewTurns = new Map(skills.map((s) => {
    if (!s.views) return [s.key, [null]];
    const own = s.views.filter((v) => pictures.includes(v));
    return [s.key, shuffled(own.length ? own : [s.views[0]])];
  }));
  for (let i = 0; i < count; i++) {
    const skill = skills[i % skills.length];
    const turns = viewTurns.get(skill.key);
    plan.push({ skill, view: turns[Math.floor(i / skills.length) % turns.length] });
  }
  // Mixed order, the same skill never twice in a row when it can be helped.
  let order = shuffled(plan);
  for (let i = 1; i < order.length; i++) {
    if (order[i].skill === order[i - 1].skill) {
      const j = order.findIndex((p, k) => k > i && p.skill !== order[i - 1].skill);
      if (j > 0) [order[i], order[j]] = [order[j], order[i]];
    }
  }
  return order.map(({ skill, view }, i) => {
    const task = generateTasks(skill.type, cards, 1, { ...skill.params(), ...(view ? { view } : {}), supportMode: "independent" })[0];
    return task && {
      ...task,
      cardId: `${task.cardId}#${i}`,
      check: true,
      singleResponse: true,
      checkSkill: skill.key,
      checkView: view,
      targetConceptId: `${skill.key}:${view ?? "none"}`,
    };
  }).filter(Boolean);
}

// A check's result by skill and by picture, from the session's per-task
// statistics ("skill:picture" → first-answer total/correct).
export function checkResultRows(concepts) {
  const skills = new Map();
  const views = new Map();
  for (const [key, { total = 0, correct = 0 } = {}] of Object.entries(concepts ?? {})) {
    const [skill, view] = key.split(":");
    const add = (map, k) => { const r = map.get(k) ?? { total: 0, correct: 0 }; map.set(k, { total: r.total + total, correct: r.correct + correct }); };
    add(skills, skill);
    if (view && view !== "none") add(views, view);
  }
  return { skills, views };
}

// The parent's settings are few and plain («Числа: до 50», «С подвохом»,
// docs/place-value-methodology.md, раздел 15); the generators below still speak
// the detailed ones (maxTens, numberSet, layout…). This maps one onto the other —
// over anything an older version saved under the detailed names.
function internalParams(type, params) {
  const tensFor = (numbers) => (numbers === "to100" ? 9 : 4);
  if (type === "identify_number") {
    return { ...params, maxTens: tensFor(params.numbers), maxOnes: 9,
      numberSet: params.trick ? "mixed" : "two_digit", layout: params.trick ? "mix" : "places" };
  }
  if (type === "build_number") {
    return { ...params, maxOnes: 9, numberRange: params.numbers === "teens" ? "teens" : "custom", maxTens: tensFor(params.numbers) };
  }
  if (type === "place_parts") return { ...params, maxTens: params.numbers === "to50" ? 4 : 9 };
  if (type === "exchange_ten") return { ...params, maxTens: 9 };
  return params;
}

// Hints are always on in the modes now; working without them is the checks'
// job («Контрольная работа: до 100», «Контрольная работа: сотни»). An «Проверка» saved in a mode
// before that doesn't carry over.
function withHints(type, params) {
  return type === "pv_test" ? params : { ...params, supportMode: "learning" };
}

export function generateTasks(modeOrObj, cards, countOrParams, maybeParams) {
  const mode = typeof modeOrObj === "string" ? modeOrObj : (modeOrObj?.type ?? modeOrObj?.id ?? "");
  const count = typeof countOrParams === "number" ? countOrParams : 15;
  const params = modeParams(modeOrObj, (countOrParams && typeof countOrParams === "object") ? countOrParams
    : (maybeParams && typeof maybeParams === "object") ? maybeParams : {});

  const allCards = cards.filter(c => c.renderer === "place_value");
  if (mode === "pv_test") return generateCheckTasks(allCards.length ? allCards : cards, params);
  const buildNumberCards    = allCards.filter(c => c.params?.mode === "build_number");
  const identifyNumberCards = allCards.filter(c => c.params?.mode === "identify_number");
  const exchangeCards       = allCards.filter(c => c.params?.mode === "exchange_ten");
  const groupTenCards       = allCards.filter(c => c.params?.mode === "group_ten");

  // «Числа: до 1000» — three-digit numbers for «Какое это число?» and «Собери
  // число» (HundredsTasks.jsx). On coins at most 5 hundreds (up to 599: more
  // plates don't fit a phone). A quarter have no tens and some no ones — the
  // placeholder zero (305, 340) is the point.
  if ((mode === "build_number" || mode === "identify_number") && params.range === "to1000") {
    const cards = mode === "build_number" ? buildNumberCards : identifyNumberCards;
    if (!cards.length) return [];
    const view = ["scheme", "table", "number"].includes(params.view) && !(mode === "identify_number" && params.view === "number") ? params.view : "coins";
    const maxHundreds = view === "coins" ? 5 : 9;
    const tasks = [];
    for (let i = 0; i < count; i++) {
      const hundreds = randomInt(1, maxHundreds);
      const r = Math.random();
      const tens = r < 0.25 ? 0 : randomInt(1, 9);
      const ones = r >= 0.25 && r < 0.4 ? 0 : randomInt(r < 0.25 ? 1 : 0, 9);
      const number = hundreds * 100 + tens * 10 + ones;
      const counts = { hundreds, tens, ones };
      const prompt = params.prompt ?? "digits";
      tasks.push({
        type: mode, cardId: cards[i % cards.length].id, conceptId: cards[i % cards.length].conceptId, number,
        ...(mode === "build_number" ? { target: counts, prompt: prompt === "mix" ? (Math.random() < 0.5 ? "digits" : "words") : prompt === "words" ? "words" : "digits" } : { model: counts, layout: "places" }),
        view, supportMode: params.supportMode ?? "learning",
      });
    }
    return tasks;
  }

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
        view: ["scheme", "table", "number"].includes(params.view) ? params.view : "coins",
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
        view: ["scheme", "table"].includes(params.view) ? params.view : "coins",
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
      showFrame: params.showFrame !== false,
      view: params.view === "scheme" ? "scheme" : "coins",
    }));
  }

  if (mode === "count_tens") {
    // «Считаем десятками»: short stretches of counting by tens across a round
    // hundred (70 → 130), the crossing in the middle — that is where the child
    // goes wrong, so it comes 4–5 times a session instead of twice in one long
    // count. The very first task of «Смотри и считай» counts 0 → 100 so the
    // first hundred is seen being born whole.
    const cards = allCards.filter((c) => c.params?.mode === "count_tens");
    const card = (i) => cards[i % cards.length] ?? { id: "count_tens", conceptId: "count_tens" };
    const next = params.task === "next";
    const top = params.range === "to1000" ? 9 : 2;
    const tasks = [];
    let lastH = null;
    for (let i = 0; i < count; i++) {
      let h;
      do h = randomInt(1, top) * 100; while (top > 1 && h === lastH);
      lastH = h;
      const base = { type: "count_tens", cardId: card(i).id, conceptId: card(i).conceptId, supportMode: params.supportMode ?? "learning", view: params.view === "scheme" ? "scheme" : "coins" };
      if (next) {
        // Half on the crossing itself (90 → ?), a quarter just after it
        // (100 → ?, where «1010» lives), a quarter in between (130 → ?).
        const roll = Math.random();
        const number = roll < 0.5 ? h - 10 : roll < 0.75 ? h : h + 10 * randomInt(1, 8);
        tasks.push({ ...base, task: "next", number, options: countTensOptions(number) });
      } else if (params.task === "prev") {
        // Half on the hundred itself (100 → ?), a quarter just after (110 → ?),
        // a quarter in between (140 → ?).
        const roll = Math.random();
        const number = roll < 0.5 ? h : roll < 0.75 ? h + 10 : h + 10 * randomInt(2, 8);
        tasks.push({ ...base, task: "prev", number, options: countTensPrevOptions(number) });
      } else if (params.task === "back") {
        // The mirror: from just above a hundred down across it (230 → 170).
        const start = h + 10 * randomInt(2, 3);
        const end = h - 10 * randomInt(3, 5);
        tasks.push({ ...base, task: "back", number: start, start, end });
      } else {
        const start = i === 0 ? 0 : h - 10 * randomInt(3, 5);
        const end = i === 0 ? 100 : h + 10 * randomInt(2, 3);
        tasks.push({ ...base, task: "count", number: start, start, end });
      }
    }
    return tasks;
  }

  if (mode === "number_names") {
    // Added after the deck shipped — same card fallback as place_parts.
    const cards = allCards.filter((c) => c.params?.mode === "number_names");
    const card = (i) => cards[i % cards.length] ?? { id: "number_names", conceptId: "number_names" };
    const tasks = [];
    let last = null;
    for (let i = 0; i < count; i++) {
      let number;
      do number = numberNamesNumber(params.set ?? "tens"); while (number === last);
      last = number;
      tasks.push({ type: "number_names", cardId: card(i).id, conceptId: card(i).conceptId, number, options: numberNameOptions(number), task: ["write", "read", "say"].includes(params.task) ? params.task : "choose", supportMode: params.supportMode ?? "learning" });
    }
    return tasks;
  }

  if (mode === "place_parts") {
    // Added after the deck shipped: installed records may have no card for it
    // yet, so fall back to a card of the same id (stats key on conceptId).
    const cards = allCards.filter((c) => c.params?.mode === "place_parts");
    const card = (i) => cards[i % cards.length] ?? { id: "place_parts", conceptId: "place_parts" };
    const maxTens = Math.min(9, Math.max(1, Number(params.maxTens ?? 9)));
    const seen = new Set();
    const tasks = [];
    for (let i = 0; i < count; i++) {
      let number = 0;
      for (let tries = 0; tries < 20; tries++) {
        // No round tens («40 = 40 + 0» teaches nothing); up to 1000 a quarter
        // have no tens (305 = 300 + 5) and none is a round hundred.
        if (params.range === "to1000") {
          const r = Math.random();
          number = randomInt(1, 9) * 100 + (r < 0.25 ? 0 : randomInt(1, 9)) * 10 + (r >= 0.25 && r < 0.35 ? 0 : randomInt(1, 9));
        } else number = randomInt(1, maxTens) * 10 + randomInt(1, 9);
        if (!seen.has(number)) break;
      }
      seen.add(number);
      const direction = params.direction === "join" ? "join" : params.direction === "mix" ? (Math.random() < 0.5 ? "split" : "join") : "split";
      const prompt = params.prompt === "words" ? "words" : params.prompt === "mix" ? (Math.random() < 0.5 ? "words" : "digits") : "digits";
      tasks.push({ type: "place_parts", cardId: card(i).id, conceptId: card(i).conceptId, number, direction, prompt, supportMode: params.supportMode ?? "learning" });
    }
    return tasks;
  }

  if (mode === "exchange_ten") {
    if (!exchangeCards.length) return [];
    // «Числа: до 1000»: one crossing of a hundred, the second number round
    // tens (190 + 20, 210 − 30); half the tasks cross, half don't. Scheme or
    // table only — on coins a hundred-exchange doesn't fit a phone.
    if (params.range === "to1000") {
      const flags = exchangeFlags(count);
      return flags.map((cross, i) => {
        const op = params.operation === "get" ? "get" : params.operation === "mixed" ? (Math.random() < 0.5 ? "get" : "give") : "give";
        const kT = randomInt(1, 9);
        let h, t;
        if (op === "get") {
          h = randomInt(1, 8);
          t = cross ? randomInt(Math.max(1, 10 - kT), 9) : randomInt(0, 9 - kT);
        } else {
          h = randomInt(cross ? 2 : 1, 9);
          t = cross ? randomInt(0, kT - 1) : randomInt(kT, 9);
        }
        const o = randomInt(0, 9);
        const number = h * 100 + t * 10 + o, k = kT * 10;
        const card = exchangeCards[i % exchangeCards.length];
        return { type: "exchange_ten", cardId: card.id, conceptId: card.conceptId, op, k, number, start: { hundreds: h, tens: t, ones: o },
          result: op === "get" ? number + k : number - k, needsExchange: cross, view: params.view === "table" ? "table" : "scheme",
          supportMode: params.supportMode ?? "learning" };
      });
    }
    const flags = exchangeFlags(count);
    const tasks = [];
    for (let i = 0; i < count; i++) {
      tasks.push({
        ...generateExchangeTask(exchangeCards[i % exchangeCards.length], params, flags[i]),
        supportMode: params.supportMode ?? "learning",
        view: ["scheme", "table"].includes(params.view) ? params.view : "coins",
      });
    }
    return tasks;
  }

  return [];
}

// «Плюс и минус через десяток»: the model of `number` plus an action with a reason —
// «Отдай k» (give) or «Получи k» (get). generateTasks passes `needsExchange`
// so that half of a session needs an exchange (break a ten when there aren't
// enough ones / build a ten when ones reach ten) and half doesn't — the child
// has to decide each time. Results stay within 1..99.
// `secondNumber: "two"` makes the second number two-digit (52 − 27, 38 + 24;
// never a round ten, so there are always ones to work); the crossing then
// depends on its ones only.
export function generateExchangeTask(card, params = {}, needsExchange = true) {
  const maxTens = Math.min(9, Math.max(1, Number(params.maxTens ?? 5)));
  const operation = params.operation ?? "give";
  const twoDigit = params.secondNumber === "two";
  const op = operation === "mixed" ? (Math.random() < 0.5 ? "give" : "get") : operation === "get" ? "get" : "give";
  const exchangeOf = (tens, ones, k) => (op === "give" ? k % 10 > ones : ones + (k % 10) >= 10);
  const resultOf = (tens, ones, k) => (op === "give" ? tens * 10 + ones - k : tens * 10 + ones + k);
  let tens = twoDigit ? 2 : 1, ones = 0, k = twoDigit ? 11 : 1;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const t = randomInt(twoDigit ? 2 : 1, Math.max(twoDigit ? 2 : 1, maxTens)), o = randomInt(0, 9);
    const n = twoDigit ? randomInt(11, 89) : randomInt(1, 9);
    if (n % 10 === 0) continue;
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

// «Собери десяток»: how many loose coins lie in the heap. Ranges follow the
// methodology: 11–19 (one stack), 20–49, round tens (nothing left over), or a
// mix. Nothing above 49 — the point is grouping, and counting 60 coins one by
// one only tires the child. Numbers don't repeat until the pool runs out.
const GROUP_TEN_RANGES = {
  teens: () => Array.from({ length: 9 }, (_, i) => 11 + i),
  to49: () => Array.from({ length: 30 }, (_, i) => 20 + i).filter((n) => n % 10 !== 0),
  round: () => [20, 30, 40],
  to99: () => Array.from({ length: 50 }, (_, i) => 50 + i).filter((n) => n % 10 !== 0),
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
