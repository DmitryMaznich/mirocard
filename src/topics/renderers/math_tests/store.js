// «Контрольные по математике»: a test document, where it is kept, and the ready sheets.
// A test is { id, title, format, paper, nameLine, videoPrize, blocks, updatedAt, lastResult }.
// It is kept on this device (localStorage) and in the account (`math_tests:t:<id>` kv documents via
// the `accountKv` prop); the newer copy wins. A deleted test stays as { id, deleted: true } so the
// deletion reaches the other devices.
import { normalizeBlock, newBlock, newId } from "./blocks.js";
import { FORMATS, PAPERS } from "./layout.js";

export const KV_PREFIX = "math_tests:t:";
const LOCAL_KEY = "mirocard:math_tests:tests";

export function normalizeTest(t) {
  return {
    id: t?.id ?? newId("t"),
    title: typeof t?.title === "string" ? t.title.slice(0, 60) : "Контрольная работа",
    format: FORMATS[t?.format] ? t.format : "a4",
    paper: PAPERS[t?.paper] ? t.paper : "cell",
    nameLine: t?.nameLine !== false,
    videoPrize: t?.videoPrize !== false,
    blocks: Array.isArray(t?.blocks) ? t.blocks.map(normalizeBlock) : [],
    updatedAt: Number(t?.updatedAt) || Date.now(),
    lastResult: t?.lastResult && Number.isFinite(t.lastResult.right) ? t.lastResult : null,
  };
}

export function newTest(patch = {}) {
  return normalizeTest({ title: "Новая контрольная", blocks: [newBlock("one")], ...patch, id: newId("t"), updatedAt: Date.now() });
}

// ready sheets — a copy is made when one is opened, the original stays as it is
export const LIBRARY = [
  {
    id: "warmup5", group: "Плюс и минус", title: "Разминка до 5", note: "одно действие, знак",
    blocks: [{ type: "one", maxNumber: 5, changeMax: 3, count: 8 }, { type: "sign", maxNumber: 5, changeMax: 3, count: 6 }],
  },
  {
    id: "check10", group: "Плюс и минус", title: "Проверочная до 10", note: "все пять видов заданий",
    blocks: [
      { type: "one", maxNumber: 10, changeMax: 5, count: 8 },
      { type: "multi", maxNumber: 10, changeMax: 3, count: 6, steps: 2 },
      { type: "missing", maxNumber: 10, changeMax: 5, count: 6 },
      { type: "chain", maxNumber: 10, changeMax: 3, count: 3, steps: 3 },
      { type: "sign", maxNumber: 10, changeMax: 5, count: 6 },
    ],
  },
  {
    id: "chains20", group: "Плюс и минус", title: "Цепочки до 20", note: "несколько действий, цепочка",
    blocks: [
      { type: "multi", maxNumber: 20, changeMax: 5, count: 8, steps: 3 },
      { type: "chain", maxNumber: 20, changeMax: 5, count: 4, steps: 4 },
    ],
  },
  {
    id: "unknown10", group: "Плюс и минус", title: "Неизвестное и знак до 10", note: "найди число, поставь знак",
    blocks: [
      { type: "missing", maxNumber: 10, changeMax: 5, count: 8, unknown: "mixed" },
      { type: "sign", maxNumber: 10, changeMax: 5, count: 8 },
    ],
  },
  {
    id: "column100", group: "В столбик", title: "Столбик до 100", note: "сложение и вычитание, с переносом и без",
    blocks: [{ type: "column", operands: { top: 2, bottom: 2 }, ops: "both", regroup: "mixed", count: 8, newPlace: false }],
  },
  {
    id: "column1000", group: "В столбик", title: "Столбик до 1000", note: "трёхзначные, переносы и займы",
    blocks: [
      { type: "column", operands: { top: 3, bottom: 3 }, ops: "add", regroup: "with", count: 4 },
      { type: "column", operands: { top: 3, bottom: 2 }, ops: "subtract", regroup: "with", count: 4 },
    ],
  },
  // from «Контрольная работа» of the «Столбик» topic (moved here 2026-11-16): the example in a line,
  // the child sets it up in a column in the notebook
  {
    id: "columnCopy100", group: "В столбик", title: "Запиши в столбик до 100", note: "пример строкой — столбик в тетради",
    blocks: [
      { type: "column", form: "line", operands: { top: 2, bottom: 2 }, ops: "both", regroup: "mixed", count: 6, newPlace: false },
      { type: "column", form: "line", operands: { top: 2, bottom: 1 }, ops: "both", regroup: "mixed", count: 4, newPlace: false },
    ],
  },
  {
    id: "columnCopy1000", group: "В столбик", title: "Запиши в столбик до 1000", note: "трёхзначные строкой — столбик в тетради",
    blocks: [
      { type: "column", form: "line", operands: { top: 3, bottom: 3 }, ops: "both", regroup: "mixed", count: 4 },
      { type: "column", form: "line", operands: { top: 3, bottom: 2 }, ops: "both", regroup: "mixed", count: 4 },
      { type: "column", form: "line", operands: { top: 3, bottom: 1 }, ops: "both", regroup: "mixed", count: 2 },
    ],
  },
  {
    id: "columnZeros", group: "В столбик", title: "Столбик: круглые и с нулём", note: "340 + 50, 305 − 7, 400 − 126",
    blocks: [
      { type: "column", operands: { top: 3, topZeros: [0], bottom: 2, bottomZeros: [0] }, ops: "both", regroup: "mixed", count: 4 },
      { type: "column", operands: { top: 3, topZeros: [1], bottom: 1 }, ops: "subtract", regroup: "with", count: 2 },
      { type: "column", operands: { top: 3, topZeros: [0, 1], bottom: 3 }, ops: "subtract", regroup: "with", count: 2 },
    ],
  },
  {
    id: "compare10", group: "Сравнение", title: "Сравни до 10", note: "числа, пример и число, два примера",
    blocks: [
      { type: "cmp_nums", maxNumber: 10, count: 6 },
      { type: "cmp_expr", maxNumber: 10, count: 8 },
      { type: "cmp_two", maxNumber: 10, count: 6 },
    ],
  },
  {
    id: "compare100", group: "Сравнение", title: "Сравни до 100", note: "двузначные числа и примеры до 20",
    blocks: [
      { type: "cmp_nums", maxNumber: 100, count: 9 },
      { type: "cmp_expr", maxNumber: 20, count: 8 },
      { type: "cmp_two", maxNumber: 20, count: 6 },
    ],
  },
  // from «7. Контрольная работа» of «Сравнение» (moved here 2026-11-16): a sheet mixes the steps up
  // to its ceiling, so «до 1000» still checks numbers up to 20 and 100
  {
    id: "compare20", group: "Сравнение", title: "Сравни до 20", note: "числа до 10 и до 20, примеры до 20",
    blocks: [
      { type: "cmp_nums", maxNumber: 10, count: 4 },
      { type: "cmp_nums", maxNumber: 20, count: 6 },
      { type: "cmp_expr", maxNumber: 20, count: 6 },
    ],
  },
  {
    id: "compare1000", group: "Сравнение", title: "Сравни до 1000", note: "двузначные и трёхзначные, 305 и 350, 99 и 100",
    blocks: [
      { type: "cmp_nums", maxNumber: 20, count: 3 },
      { type: "cmp_nums", maxNumber: 100, count: 6 },
      { type: "cmp_nums", maxNumber: 1000, count: 9 },
    ],
  },
];

export function testFromLibrary(entry) {
  return newTest({ title: entry.title, blocks: entry.blocks.map((b) => newBlock(b.type, b)) });
}

export function libraryPreview(entry) {
  // a stable preview (fixed seeds) for the «Готовые листы» thumbnails
  return normalizeTest({ id: `lib:${entry.id}`, title: entry.title, blocks: entry.blocks.map((b, i) => normalizeBlock({ ...b, id: `lib${i}`, seed: 1000 + i })) });
}

function readLocal() {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function writeLocal(map) {
  try { window.localStorage.setItem(LOCAL_KEY, JSON.stringify(map)); } catch { /* full or private: the account copy remains */ }
}

export function loadLocalTests() {
  return Object.values(readLocal());
}

export function saveTest(test, accountKv) {
  const doc = { ...test, updatedAt: Date.now() };
  const map = readLocal();
  map[doc.id] = doc;
  writeLocal(map);
  try { accountKv?.put?.(`${KV_PREFIX}${doc.id}`, doc); } catch { /* offline: the app's queue */ }
  return doc;
}

export function deleteTest(id, accountKv) {
  const doc = { id, deleted: true, updatedAt: Date.now() };
  const map = readLocal();
  map[id] = doc;
  writeLocal(map);
  try { accountKv?.put?.(`${KV_PREFIX}${id}`, doc); } catch { /* offline */ }
}

// device copies merged with the account's (newer wins); deleted ones dropped
export async function loadTests(accountKv) {
  const map = readLocal();
  try {
    const remote = (await accountKv?.list?.(KV_PREFIX)) ?? [];
    let changed = false;
    for (const { value } of remote) {
      if (!value?.id) continue;
      const mine = map[value.id];
      if (!mine || (Number(value.updatedAt) || 0) > (Number(mine.updatedAt) || 0)) {
        map[value.id] = value;
        changed = true;
      }
    }
    if (changed) writeLocal(map);
  } catch { /* offline or signed out: this device's tests */ }
  return Object.values(map).filter((t) => !t.deleted).map(normalizeTest).sort((a, b) => b.updatedAt - a.updatedAt);
}
