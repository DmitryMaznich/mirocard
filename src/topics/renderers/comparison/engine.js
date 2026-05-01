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

export function getVerdict(task) {
  if (task.question === "equal" || task.left === task.right) {
    return `Одинаково! ${task.left} = ${task.right}`;
  }
  const bigger  = Math.max(task.left, task.right);
  const smaller = Math.min(task.left, task.right);
  return task.question === "more"
    ? `${bigger} больше ${smaller}`
    : `${smaller} меньше ${bigger}`;
}

// sessionParams: { question?: "more"|"less"|"mix", showEqual?: boolean, cardId?: string }
export function generateTasks(mode, cards, count = 20, sessionParams = {}) {
  if (!cards.length) return [];
  const { question = "more", showEqual = false, cardId } = sessionParams;
  const card       = cards.find((c) => c.id === (cardId ?? mode.defaultCardId)) ?? cards[0];
  const baseParams = card.params ?? {};
  const tasks      = [];

  const equalTarget = showEqual ? Math.round(count * 0.3) : 0;

  for (let i = 0; i < count; i++) {
    let left, right;
    if (i < equalTarget) {
      // Equal task: same value on both sides
      const val = Math.floor(Math.random() * ((baseParams.max ?? 10) - (baseParams.min ?? 1) + 1)) + (baseParams.min ?? 1);
      left = right = val;
    } else {
      ({ left, right } = generateComparisonTask({ ...baseParams, allowEqual: false }));
    }

    const isEqual = left === right;
    let taskQuestion;
    if (isEqual) {
      taskQuestion = "equal";
    } else if (question === "mix") {
      taskQuestion = Math.random() < 0.5 ? "more" : "less";
    } else {
      taskQuestion = question;
    }

    tasks.push({ type: mode.type, left, right, conceptId: card.conceptId, question: taskQuestion });
  }
  return shuffle(tasks);
}
