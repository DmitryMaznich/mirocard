import { shuffle } from "@/shared/utils/shuffle";

const MAX_ATTEMPTS = 100;

export const COMPARISON_LEVELS = [
  { id: 1, label: "До 10, разница > 4", params: { min: 1,  max: 10, minDiff: 5 } },
  { id: 2, label: "До 10",              params: { min: 1,  max: 10, minDiff: 1 } },
  { id: 3, label: "До 20",              params: { min: 1,  max: 20, minDiff: 1 } },
  { id: 4, label: "До 99",              params: { min: 10, max: 99, minDiff: 1 } },
];

const NUM_NOM = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять",
  "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать",
  "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать", "двадцать"];

const NUM_GEN = ["", "одного", "двух", "трёх", "четырёх", "пяти", "шести", "семи", "восьми", "девяти", "десяти",
  "одиннадцати", "двенадцати", "тринадцати", "четырнадцати", "пятнадцати",
  "шестнадцати", "семнадцати", "восемнадцати", "девятнадцати", "двадцати"];

function numNom(n) { return NUM_NOM[n] ?? String(n); }
function numGen(n) { return NUM_GEN[n] ?? String(n); }
function cap(s)    { return s ? s[0].toUpperCase() + s.slice(1) : s; }

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

  const left  = min;
  const right = Math.min(min + (minDiff || 1), max);
  return { left, right };
}

function resolveComparisonCard(mode, cards, sessionParams) {
  if (!cards.length) return null;
  const requestedId = sessionParams.cardId ?? mode.defaultCardId;
  return cards.find((card) => card.id === requestedId) ?? cards[0];
}

function getFirstNumberRelation(left, right) {
  if (left === right) return "equal";
  return left < right ? "less" : "more";
}

export function getVerdict(task) {
  const words = task.wordsVerdict;

  if (task.type === "compare_first_number") {
    if (task.left === task.right) {
      return words
        ? `Одинаково! ${cap(numNom(task.left))} = ${numNom(task.right)}`
        : `Одинаково! ${task.left} = ${task.right}`;
    }
    if (task.left < task.right) {
      return words
        ? `${cap(numNom(task.left))} меньше ${numGen(task.right)}`
        : `${task.left} меньше ${task.right}`;
    }
    return words
      ? `${cap(numNom(task.left))} больше ${numGen(task.right)}`
      : `${task.left} больше ${task.right}`;
  }

  if (task.question === "equal" || task.left === task.right) {
    return words
      ? `Одинаково! ${cap(numNom(task.left))} = ${numNom(task.right)}`
      : `Одинаково! ${task.left} = ${task.right}`;
  }

  const bigger  = Math.max(task.left, task.right);
  const smaller = Math.min(task.left, task.right);
  if (task.question === "more") {
    return words
      ? `${cap(numNom(bigger))} больше ${numGen(smaller)}`
      : `${bigger} больше ${smaller}`;
  }
  return words
    ? `${cap(numNom(smaller))} меньше ${numGen(bigger)}`
    : `${smaller} меньше ${bigger}`;
}

// sessionParams: { level?, question?: "more"|"less"|"mix", showEqual?: boolean, wordsVerdict?: boolean, showNumbers?: boolean }
export function generateTasks(mode, cards, count = 20, sessionParams = {}) {
  if (!cards.length) return [];
  const { question = "more", showEqual = false, level = 2, wordsVerdict = false, showNumbers = false } = sessionParams;

  const levelDef   = COMPARISON_LEVELS.find((l) => l.id === level) ?? COMPARISON_LEVELS[1];
  const baseParams = levelDef.params;
  const card       = resolveComparisonCard(mode, cards, sessionParams);

  if (!card) return [];

  function taskInstruction(q) {
    if (mode.type === "compare_first_number") {
      void q;
      return "Сравни первое число со вторым и выбери правильный ответ.";
    }
    const baseQ = q === "equal" ? (question === "less" ? "less" : "more") : q;
    if (baseQ === "more") return showEqual ? "Где больше? Или одинаково?" : "Где больше?";
    return showEqual ? "Где меньше? Или одинаково?" : "Где меньше?";
  }

  const tasks       = [];
  const equalTarget = showEqual ? Math.round(count * 0.3) : 0;

  for (let i = 0; i < count; i++) {
    let left, right;
    if (i < equalTarget) {
      const val = Math.floor(Math.random() * (baseParams.max - baseParams.min + 1)) + baseParams.min;
      left = right = val;
    } else {
      ({ left, right } = generateComparisonTask({ ...baseParams, allowEqual: false }));
    }

    const isEqual      = left === right;
    const taskQuestion = mode.type === "compare_first_number"
      ? getFirstNumberRelation(left, right)
      : isEqual
        ? "equal"
        : question === "mix"
          ? (Math.random() < 0.5 ? "more" : "less")
          : question;

    tasks.push({ type: mode.type, left, right, conceptId: card.conceptId, question: taskQuestion, showEqual, wordsVerdict, showNumbers, instruction: taskInstruction(taskQuestion) });
  }
  return shuffle(tasks);
}
