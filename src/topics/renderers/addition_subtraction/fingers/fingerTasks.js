import { getRemoveMode } from "./FingerSystem.js";

// «Покажи на пальцах» (fingers_show) and «Считаем на пальцах» (fingers_count).
// Moved here from column_addition, where these examples used to be deck cards;
// the card ids are kept so per-card stats stay comparable.

const ADD_PAIRS = [[1, 1], [1, 2], [2, 1], [2, 2], [2, 3], [3, 1], [3, 2], [3, 3], [3, 4], [4, 1], [4, 2], [4, 3], [4, 4], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [1, 6], [1, 7], [1, 8], [1, 9], [2, 6], [2, 7], [2, 8], [3, 6], [3, 7], [4, 6], [6, 1], [6, 2], [6, 3], [6, 4], [7, 1], [7, 2], [7, 3], [8, 1], [8, 2], [9, 1]];
const SUB_PAIRS = [[1, 1], [2, 1], [2, 2], [3, 1], [3, 2], [3, 3], [4, 1], [4, 2], [4, 3], [4, 4], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [6, 1], [6, 2], [6, 3], [6, 6], [7, 2], [7, 3], [7, 4], [8, 3], [8, 4], [9, 4], [9, 5], [10, 4], [10, 5], [7, 5], [7, 6], [7, 7], [8, 5], [8, 6], [8, 7], [8, 8], [9, 6], [9, 7], [9, 8], [9, 9], [10, 6], [10, 7], [10, 8], [10, 9], [10, 10]];

export const FINGER_CARDS = [
  ...Array.from({ length: 11 }, (_, n) => ({ id: `fshow_${n}`, conceptId: `fshow_${n}`, params: { mode: "fingers_show", n } })),
  ...ADD_PAIRS.map(([a, b]) => ({ id: `fcount_a_${a}_${b}`, conceptId: `fcount_a_${a}_${b}`, params: { mode: "fingers_count", op: "add", a, b } })),
  ...SUB_PAIRS.map(([a, b]) => ({ id: `fcount_s_${a}_${b}`, conceptId: `fcount_s_${a}_${b}`, params: { mode: "fingers_count", op: "sub", a, b } })),
];

export function generateFingersShow(card) {
  const n = card.params?.n ?? 0;
  return {
    type: "fingers_show",
    cardId: card.id,
    conceptId: card.conceptId,
    n,
  };
}

export function generateFingersCount(card) {
  const op  = card.params?.op ?? "add";
  const a   = card.params?.a ?? 0;
  const b   = card.params?.b ?? 0;
  const result = op === "add" ? a + b : a - b;
  const base = { type: "fingers_count", cardId: card.id, conceptId: card.conceptId, op, a, b, result };
  if (op === "sub") return { ...base, ...getRemoveMode(a, b) };
  return base;
}

export function generateFingerTasks(mode, count, params = {}, cards = FINGER_CARDS) {
  const fingerShowCards  = cards.filter(c => c.params?.mode === "fingers_show");
  const fingerCountCards = cards.filter(c => c.params?.mode === "fingers_count");

  if (mode === "fingers_show") {
    const pool = fingerShowCards;
    const tasks = [];
    for (let i = 0; tasks.length < count && i < pool.length * 3; i++) {
      tasks.push(generateFingersShow(pool[i % pool.length]));
    }
    return tasks;
  }

  if (mode === "fingers_count") {
    const opFilter = params.op;
    let pool = fingerCountCards;
    if (opFilter && opFilter !== "mixed") {
      pool = pool.filter(c => (c.params?.op ?? "add") === opFilter);
    }
    if (!pool.length) pool = fingerCountCards;
    const tasks = [];
    for (let i = 0; tasks.length < count && i < pool.length * 3; i++) {
      tasks.push(generateFingersCount(pool[i % pool.length]));
    }
    return tasks;
  }

  return [];
}
