// «Умножение» (multiplication): task list for one lesson.
// The host pins the content package at lesson start; the UI language is never an input
// (docs/localization/authoring-language-rules.md). Each task carries a seed — the renderer
// builds the exercise from (seed, current level), so the level can move within the lesson
// (docs/multiplication-methodology.md, «переход»).
import { LEVELS } from "./mechanics.js";

export const MODE_IDS = Object.keys(LEVELS);
// A lesson is finite and visible: 8 tasks, one apple each in the strip, then the summary
// (and the end video if the adult switched it on). The host's generic count is ignored.
export const LESSON_TASKS = 8;

export function generateTasks(mode, cards, _count, params = {}, context, pack) {
  const count = LESSON_TASKS;
  if (!context || !pack || context.contentLanguage !== pack.language || context.packageId !== pack.packageId || context.contentVersion !== pack.version) {
    throw new Error("Explicit matching content package required");
  }
  if (!MODE_IDS.includes(mode.type)) throw new Error(`Unsupported multiplication mode: ${mode.type}`);
  const card = cards.find((c) => c.id === (params.cardId ?? mode.defaultCardId)) ?? cards[0];
  if (!card) return [];
  const level = params.level ?? "auto";
  if (level !== "auto" && !LEVELS[mode.type].includes(level)) throw new Error(`Invalid level: ${level}`);
  const notation = { sign: pack.messages["notation.sign"] ?? "×", order: pack.messages["notation.order"] ?? "size-first" };
  const tasks = [];
  // «Поровну?»: «=» and «≠» about half each, never more than two of the same in a row.
  let last = [];
  for (let i = 0; i < count; i++) {
    const equal = last.length >= 2 && last[0] === last[1] ? !last[0] : Math.random() < 0.5;
    last = [equal, ...last].slice(0, 2);
    tasks.push({
      type: mode.type,
      conceptId: card.conceptId,
      cardId: card.id,
      seed: Math.floor(Math.random() * 2 ** 31),
      index: i,
      total: count,
      equal,
      level,
      notation,
      messages: pack.messages,
      languageContext: context,
    });
  }
  return tasks;
}
