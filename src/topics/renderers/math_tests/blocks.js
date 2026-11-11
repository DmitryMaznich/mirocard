// «Контрольные по математике» (math_tests): the catalogue of blocks.
// A block is one kind of task with its own settings and its own seed, so changing one block never
// changes the examples of another. Each kind says how its examples are made (`build`) and which
// settings its panel shows (`fields`). New areas (comparison, word problems, multiplication…) are
// new entries here with their own builder — the sheet, the solving screen and the PDF only know
// the item tokens:
//   { t: "num", v }  { t: "op", op: "add"|"subtract" }  { t: "eq" }
//   { t: "blank", i, kind: "num"|"sign"|"cmp" }  { t: "arrow", op, d }
// and `answers[i]` (a number, "add"/"subtract", or "<"/">"/"=") for blank i.
import {
  SECTION_INFO, MAX_NUMBERS, COUNT_MIN, COUNT_MAX, allowedChanges, normalizeSection, buildSection, makeRng,
} from "../addition_subtraction/worksheet/sections.js";
import { CMP_MAX_NUMBERS, normalizeCompare, buildCompare } from "./compare.js";

export const GROUPS = [
  { id: "plusminus", title: "Плюс и минус" },
  { id: "compare", title: "Сравнение" },
];

// coming next — shown in the picker as «Скоро»
export const SOON = [
  { id: "word", title: "Задача", sample: "картинка и текст" },
  { id: "multiply", title: "Умножение", sample: "таблица, примеры" },
  { id: "place", title: "Разряды числа", sample: "десятки и единицы" },
];

const CHANGE_LABEL = (v) => (v === 99 ? "любое" : `до ${v}`);

const COMMON = [
  { key: "count", label: "Заданий", kind: "stepper", min: COUNT_MIN, max: COUNT_MAX },
  { key: "maxNumber", label: "Числа", kind: "seg", options: () => MAX_NUMBERS.map((v) => ({ value: v, label: `до ${v}` })) },
  { key: "changeMax", label: "Изменение", kind: "seg", options: (b) => allowedChanges(b.maxNumber).map((v) => ({ value: v, label: CHANGE_LABEL(v) })) },
];
const OPS = { key: "ops", label: "Действия", kind: "seg", options: () => [{ value: "add", label: "+" }, { value: "subtract", label: "−" }, { value: "both", label: "+ и −" }] };
const STEPS = (label) => ({ key: "steps", label, kind: "seg", options: () => [2, 3, 4].map((v) => ({ value: v, label: String(v) })) });
const ZERO = { key: "includeZero", label: "С нулём", kind: "toggle" };
const COLS = { key: "cols", label: "Столбцы", kind: "seg", options: () => [{ value: "auto", label: "авто" }, { value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }] };

const sectionKind = (type, extra, sample) => ({
  group: "plusminus",
  title: SECTION_INFO[type].title,
  instruction: SECTION_INFO[type].instruction,
  sample,
  fields: [...COMMON, ...extra, ZERO, COLS],
  normalize: (b) => normalizeSection({ ...b, type }),
  build: (b) => buildSection({ ...b, type }, makeRng(b.seed)),
});

export const BLOCK_KINDS = {
  one: sectionKind("one", [OPS], "7 + 2 = ☐"),
  multi: sectionKind("multi", [OPS, STEPS("Действий в примере")], "5 + 2 − 1 = ☐"),
  missing: sectionKind("missing", [OPS, { key: "unknown", label: "Неизвестное", kind: "seg", options: () => [{ value: "right", label: "справа" }, { value: "left", label: "слева" }, { value: "mixed", label: "вперемешку" }] }], "3 + ☐ = 8"),
  sign: sectionKind("sign", [], "6 ☐ 2 = 8"),
  chain: sectionKind("chain", [OPS, STEPS("Шагов")], "4 →+3 ☐ →−2 ☐"),
};
const CMP_NUMBERS = { key: "maxNumber", label: "Числа", kind: "seg", options: () => CMP_MAX_NUMBERS.map((v) => ({ value: v, label: `до ${v}` })) };
const compareKind = (what, title, sample, extra) => ({
  group: "compare",
  title,
  instruction: "Поставь знак >, < или =",
  sample,
  fields: [COMMON[0], CMP_NUMBERS, ...extra, COLS],
  normalize: (b) => normalizeCompare(b, what),
  build: (b) => buildCompare(b, what),
});
BLOCK_KINDS.cmp_nums = compareKind("nums", "Сравни числа", "7 ○ 5", []);
BLOCK_KINDS.cmp_expr = compareKind("expr", "Сравни пример и число", "3 + 2 ○ 6", [OPS]);
BLOCK_KINDS.cmp_two = compareKind("two", "Сравни два примера", "3 + 2 ○ 4 + 1", [OPS]);

export const KIND_IDS = Object.keys(BLOCK_KINDS);

let idCounter = 0;
export function newId(prefix = "b") {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}
export const newSeed = () => 1 + Math.floor(Math.random() * 2 ** 30);

export function normalizeBlock(block) {
  const type = BLOCK_KINDS[block?.type] ? block.type : "one";
  const kind = BLOCK_KINDS[type];
  const b = { ...kind.normalize(block ?? {}), id: block?.id ?? newId(), seed: Number.isInteger(block?.seed) ? block.seed : newSeed() };
  b.cols = [1, 2, 3].includes(block?.cols) ? block.cols : "auto";
  b.title = typeof block?.title === "string" ? block.title.slice(0, 60) : "";
  b.instruction = typeof block?.instruction === "string" ? block.instruction.slice(0, 80) : "";
  return b;
}

export function newBlock(type, patch = {}) {
  return normalizeBlock({ type, ...patch, id: newId(), seed: newSeed() });
}

export const blockTitle = (b) => b.title || BLOCK_KINDS[b.type]?.title || "";
export const blockInstruction = (b) => b.instruction || BLOCK_KINDS[b.type]?.instruction || "";

// built examples are cached by the block's settings (the same object is reused while nothing changed)
const cache = new Map();
export function buildBlock(block) {
  const key = JSON.stringify(block);
  let built = cache.get(key);
  if (!built) {
    built = BLOCK_KINDS[block.type].build(block);
    if (cache.size > 400) cache.clear();
    cache.set(key, built);
  }
  return built;
}

export function isAnswerRight(answer, value) {
  if (value == null || value === "") return false;
  if (typeof answer === "number") return Number(value) === answer;
  return value === answer;
}
