// «Учим словенский», mode 1 «Одна вещь — два слова» (docs/learn-slovene.md).
// A word is a concept with 2–3 picture cards; every card carries the word in
// both languages and both recordings:
//   { conceptId, image, word: { ru, sl }, audio: { ru, sl }, group, neverWith? }
// The distractors are not words of the lesson: a distractor comes from another
// situation (not food next to food), so they live on the mode, not in `cards`,
// where the adult's word selection would filter them away:
//   mode.distractors: [{ id, conceptId, image, word: { sl }, group }]
import { shuffle } from "@/shared/utils/shuffle";

const DEFAULT_TASK_COUNT = 6;

function byConcept(cards) {
  const map = new Map();
  for (const card of cards) {
    if (!card?.conceptId || !card.word) continue;
    if (!map.has(card.conceptId)) map.set(card.conceptId, []);
    map.get(card.conceptId).push(card);
  }
  return map;
}

const firstSound = (card) => String(card.word?.sl ?? card.conceptId ?? "").trim().charAt(0).toLowerCase();

// stol and miza (стул / стол) never share a screen: `neverWith` on either side.
function clashes(a, b) {
  return (a.neverWith ?? []).includes(b.conceptId) || (b.neverWith ?? []).includes(a.conceptId);
}

// Another situation, another first sound, never a forbidden pair. If the pool
// is too small for that, the first-sound rule gives way first: a distractor
// from the same situation would teach the wrong contrast.
export function pickDistractors(target, pool, count) {
  const usable = pool.filter((d) => d.conceptId !== target.conceptId && d.group !== target.group && !clashes(d, target));
  const strict = usable.filter((d) => firstSound(d) !== firstSound(target));
  const picked = [];
  for (const candidate of [...shuffle(strict), ...shuffle(usable)]) {
    if (picked.length >= count) break;
    if (picked.some((p) => p.conceptId === candidate.conceptId || clashes(p, candidate))) continue;
    picked.push(candidate);
  }
  return picked;
}

// Concepts in a shuffled cycle, never the same word twice in a row, and each
// pass shows the next picture of a word (the child learns the word, not one photo).
function conceptSequence(concepts, length) {
  const ids = [...concepts.keys()];
  if (!ids.length) return [];
  const out = [];
  const pass = new Map(ids.map((id) => [id, 0]));
  while (out.length < length) {
    let order = shuffle(ids);
    if (order.length > 1 && order[0] === out[out.length - 1]?.conceptId) order = [...order.slice(1), order[0]];
    for (const id of order) {
      if (out.length >= length) break;
      const cards = concepts.get(id);
      const n = pass.get(id);
      pass.set(id, n + 1);
      out.push({ conceptId: id, card: cards[n % cards.length] });
    }
  }
  return out;
}

function shuffledCards(cards) {
  // The primary picture first in each concept's rotation, the others after it.
  return [...cards.filter((c) => c.primary), ...shuffle(cards.filter((c) => !c.primary))];
}

export function generateTasks(mode, cards, _sessionSize, params = {}) {
  const concepts = new Map([...byConcept(cards ?? [])].map(([id, list]) => [id, shuffledCards(list)]));
  if (!concepts.size) return [];

  if (mode?.type === "bw_listen_all") {
    return [{ type: "bw_listen_all", cards: [...concepts.values()].map((list) => list[0]) }];
  }

  if (mode?.type === "bw_pair") {
    return conceptSequence(concepts, concepts.size).map(({ conceptId, card }) => ({ type: "bw_pair", conceptId, card }));
  }

  if (mode?.type === "bw_find") {
    const optionCount = Math.max(2, Math.min(3, Number(mode.optionCount) || 2));
    const taskCount = Number(params.taskCount) || DEFAULT_TASK_COUNT;
    const pool = mode.distractors ?? [];
    return conceptSequence(concepts, taskCount).map(({ conceptId, card }) => ({
      type: "bw_find",
      conceptId,
      card,
      // «ru_sl»: both words (step В); «sl»: Slovenian only, Russian is a prompt (Г, Д).
      audioOrder: mode.audioOrder === "ru_sl" ? "ru_sl" : "sl",
      promptDelaySec: Number(params.promptDelay) || 5,
      options: shuffle([
        { card, isTarget: true },
        ...pickDistractors(card, pool, optionCount - 1).map((d) => ({ card: d, isTarget: false })),
      ]),
    }));
  }

  return [];
}
