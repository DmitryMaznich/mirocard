import { shuffle } from "@/shared/utils/shuffle";

const MAX_ATTEMPTS = 100;

export function generateComparisonTask(params) {
  const { min = 1, max = 10, minDiff = 1, allowEqual = false } = params;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const left  = Math.floor(Math.random() * (max - min + 1)) + min;
    const right = Math.floor(Math.random() * (max - min + 1)) + min;
    const diff  = Math.abs(left - right);

    if (!allowEqual && left === right) continue;
    if (allowEqual && left === right)  return { left, right };
    if (diff < minDiff) continue;
    return { left, right };
  }

  // Fallback: guaranteed valid pair
  const left  = min;
  const right = Math.min(min + (minDiff || 1), max);
  return { left, right };
}

export function generateTasks(modeType, cards, params, count = 15) {
  if (!cards.length) return [];

  const tasks = [];
  for (let i = 0; i < count; i++) {
    const card = cards[i % cards.length];
    const { left, right } = generateComparisonTask(card.params ?? {});
    tasks.push({ type: modeType, left, right, conceptId: card.conceptId });
  }
  return shuffle(tasks);
}
