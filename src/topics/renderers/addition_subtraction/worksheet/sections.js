// «Контрольная работа» (operation_worksheet): a test built from sections.
// A section is one kind of task with its own settings and number of items;
// the whole sheet is generated from the config and a seed, so the screen, the
// PDF and a saved test show exactly the same examples until «Новые примеры».
//
// An item is a row of tokens:
//   { t: "num", v }           a printed number
//   { t: "op", op }           + or − ("add" | "subtract")
//   { t: "eq" }               =
//   { t: "blank", i, kind }   a box the child fills; kind "num" | "sign"
//   { t: "arrow", op, d }     number chain: →(+3)→
// and `answers[i]` holds what blank i expects (a number, or "add"/"subtract").

export const SECTION_TYPES = ["one", "multi", "missing", "sign", "chain"];

export const SECTION_INFO = {
  one:     { title: "Пример в одно действие",       instruction: "Реши примеры" },
  multi:   { title: "Пример в несколько действий",  instruction: "Реши примеры. Считай по порядку" },
  missing: { title: "Найди неизвестное",            instruction: "Впиши пропущенное число" },
  sign:    { title: "Поставь знак",                 instruction: "Поставь знак + или −" },
  chain:   { title: "Числовая цепочка",             instruction: "Заполни цепочку" },
};

export const MAX_NUMBERS = [5, 10, 20];
export const CHANGE_VALUES = [1, 3, 5, 10, 99]; // 99 = «любое»
export const COUNT_MIN = 2;
export const COUNT_MAX = 12;

export function defaultSection(type) {
  const base = { type, count: 6, maxNumber: 10, changeMax: 3, ops: "both", includeZero: false };
  if (type === "one") return { ...base, count: 8 };
  if (type === "multi") return { ...base, steps: 2 };
  if (type === "missing") return { ...base, unknown: "mixed" };
  if (type === "chain") return { ...base, count: 4, steps: 3 };
  return base;
}

export function defaultConfig() {
  return {
    title: "Контрольная работа",
    seed: 1,
    sections: [defaultSection("one"), defaultSection("multi"), defaultSection("missing"), defaultSection("chain")],
  };
}

// «Максимальное изменение» never above the numbers' range; «любое» only up to 20.
export function allowedChanges(maxNumber) {
  return CHANGE_VALUES.filter((v) => (v === 99 ? maxNumber > 10 : v <= maxNumber));
}

export function normalizeSection(section) {
  const type = SECTION_TYPES.includes(section?.type) ? section.type : "one";
  const def = defaultSection(type);
  const s = { ...def, ...section, type };
  s.count = Math.max(COUNT_MIN, Math.min(COUNT_MAX, Math.round(Number(s.count) || def.count)));
  if (!MAX_NUMBERS.includes(s.maxNumber)) s.maxNumber = def.maxNumber;
  const changes = allowedChanges(s.maxNumber);
  if (!changes.includes(s.changeMax)) s.changeMax = changes.filter((v) => v !== 99 && v <= s.changeMax).at(-1) ?? changes.at(-1);
  if (!["add", "subtract", "both"].includes(s.ops)) s.ops = "both";
  if (type === "sign") s.ops = "both";
  if ((type === "multi" || type === "chain") && ![2, 3, 4].includes(s.steps)) s.steps = def.steps;
  if (type === "missing" && !["right", "left", "mixed"].includes(s.unknown)) s.unknown = "mixed";
  s.includeZero = Boolean(s.includeZero);
  return s;
}

export function normalizeConfig(config) {
  const def = defaultConfig();
  const sections = Array.isArray(config?.sections) && config.sections.length
    ? config.sections.map(normalizeSection)
    : def.sections;
  return {
    title: typeof config?.title === "string" && config.title.trim() ? config.title.slice(0, 60) : def.title,
    seed: Number.isInteger(config?.seed) ? config.seed : def.seed,
    sections,
  };
}

// Small seeded generator (mulberry32): the same seed gives the same sheet.
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const apply = (a, op, d) => (op === "add" ? a + d : a - d);

function opsOf(section) {
  return section.ops === "add" ? ["add"] : section.ops === "subtract" ? ["subtract"] : ["add", "subtract"];
}
const changeCap = (s) => Math.max(1, Math.min(s.maxNumber - 1, s.changeMax));
const minOf = (s) => (s.includeZero ? 0 : 1);

// One action a ± d = r with every number inside [min, max] and d ≤ changeMax.
function oneAction(rng, s, op = pick(rng, opsOf(s))) {
  const min = minOf(s);
  const cap = changeCap(s);
  const d = int(rng, 1, cap);
  if (op === "add") {
    if (s.maxNumber - d < min) return null;
    const a = int(rng, min, s.maxNumber - d);
    return { a, op, d, r: a + d };
  }
  if (d + min > s.maxNumber) return null;
  const a = int(rng, d + min, s.maxNumber);
  return { a, op, d, r: a - d };
}

// A walk of `steps` actions, every partial inside the range, no step undoing the previous one.
function walk(rng, s, steps) {
  const min = minOf(s);
  const cap = changeCap(s);
  const allowed = opsOf(s);
  let current = int(rng, min, s.maxNumber);
  const start = current;
  const moves = [];
  for (let i = 0; i < steps; i += 1) {
    const choices = allowed.filter((op) => (op === "add" ? current + 1 <= s.maxNumber : current - 1 >= min));
    if (!choices.length) return null;
    const op = pick(rng, choices);
    const room = Math.min(cap, op === "add" ? s.maxNumber - current : current - min);
    let d = int(rng, 1, room);
    const prev = moves[i - 1];
    if (prev && prev.op !== op && prev.d === d) {
      if (room === 1) return null;
      d = d === room ? d - 1 : d + 1;
    }
    current = apply(current, op, d);
    moves.push({ op, d, value: current });
  }
  return { start, moves };
}

const num = (v) => ({ t: "num", v });
const opTok = (op) => ({ t: "op", op });
const EQ = { t: "eq" };
const blank = (i, kind = "num") => ({ t: "blank", i, kind });

const BUILDERS = {
  one(rng, s) {
    const x = oneAction(rng, s);
    return x && { tokens: [num(x.a), opTok(x.op), num(x.d), EQ, blank(0)], answers: [x.r] };
  },
  multi(rng, s) {
    const w = walk(rng, s, s.steps);
    if (!w) return null;
    const tokens = [num(w.start)];
    for (const m of w.moves) tokens.push(opTok(m.op), num(m.d));
    tokens.push(EQ, blank(0));
    return { tokens, answers: [w.moves.at(-1).value] };
  },
  missing(rng, s, index) {
    const x = oneAction(rng, s);
    if (!x) return null;
    const side = s.unknown === "mixed" ? (index % 2 === 0 ? "right" : "left") : s.unknown;
    if (side === "left") return { tokens: [blank(0), opTok(x.op), num(x.d), EQ, num(x.r)], answers: [x.a] };
    return { tokens: [num(x.a), opTok(x.op), blank(0), EQ, num(x.r)], answers: [x.d] };
  },
  sign(rng, s) {
    const x = oneAction(rng, s, pick(rng, ["add", "subtract"]));
    return x && { tokens: [num(x.a), blank(0, "sign"), num(x.d), EQ, num(x.r)], answers: [x.op] };
  },
  chain(rng, s) {
    const w = walk(rng, s, s.steps);
    if (!w) return null;
    const tokens = [num(w.start)];
    w.moves.forEach((m, i) => tokens.push({ t: "arrow", op: m.op, d: m.d }, blank(i)));
    return { tokens, answers: w.moves.map((m) => m.value) };
  },
};

const itemKey = (item) => item.tokens.map((t) => (t.t === "num" ? t.v : t.t === "op" ? t.op : t.t === "arrow" ? `${t.op}${t.d}` : t.t)).join(" ");

export function buildSection(section, rng) {
  const s = normalizeSection(section);
  const items = [];
  const seen = new Set();
  let attempts = 0;
  while (items.length < s.count && attempts < s.count * 60) {
    attempts += 1;
    const item = BUILDERS[s.type](rng, s, items.length);
    if (!item) continue;
    const key = itemKey(item);
    // Repeats are allowed only when the settings can't give enough different items.
    if (seen.has(key) && attempts < s.count * 30) continue;
    seen.add(key);
    items.push(item);
  }
  return { ...s, ...SECTION_INFO[s.type], items };
}

export function buildWorksheet(config) {
  const c = normalizeConfig(config);
  const rng = makeRng(c.seed);
  const sections = c.sections.map((s) => buildSection(s, rng));
  return { title: c.title, seed: c.seed, sections, total: sections.reduce((n, s) => n + s.items.length, 0) };
}

export function isAnswerCorrect(item, i, value) {
  return value != null && value !== "" && item.answers[i] === value;
}

export function itemCorrect(item, values = []) {
  return item.answers.every((a, i) => values[i] === a);
}
