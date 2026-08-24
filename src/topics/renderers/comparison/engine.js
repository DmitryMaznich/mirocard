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

const NUM_DAT = ["", "одному", "двум", "трём", "четырём", "пяти", "шести", "семи", "восьми", "девяти", "десяти",
  "одиннадцати", "двенадцати", "тринадцати", "четырнадцати", "пятнадцати",
  "шестнадцати", "семнадцати", "восемнадцати", "девятнадцати", "двадцати"];

function numNom(n) { return NUM_NOM[n] ?? String(n); }
function numGen(n) { return NUM_GEN[n] ?? String(n); }
function numDat(n) { return NUM_DAT[n] ?? String(n); }
function cap(s)    { return s ? s[0].toUpperCase() + s.slice(1) : s; }

function isValidPair(left, right, minDiff, allowEqual) {
  if (left === right) return allowEqual;
  return Math.abs(left - right) >= minDiff;
}

export function generateComparisonTask(params, usedPairs) {
  const { min = 1, max = 10, minDiff = 1, allowEqual = false } = params;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const left  = Math.floor(Math.random() * (max - min + 1)) + min;
    const right = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!isValidPair(left, right, minDiff, allowEqual)) continue;
    // Avoid handing back the exact same pair twice within one generated batch —
    // independent random draws otherwise repeat far more often than a
    // parent/child expects, especially at the narrower difficulty levels.
    const key = `${left},${right}`;
    if (usedPairs?.has(key)) continue;
    usedPairs?.add(key);
    return { left, right };
  }

  if (usedPairs) {
    // MAX_ATTEMPTS random draws all collided with usedPairs — the pool of
    // valid pairs for this range/minDiff is small relative to how many
    // tasks are being generated (e.g. level 1's ~30 pairs vs. a 500-task
    // session). Scan for any still-unused valid pair instead of falling
    // back to one fixed pair, which used to repeat identically for every
    // remaining task once the pool ran out.
    const unused   = [];
    const allValid = [];
    for (let l = min; l <= max; l++) {
      for (let r = min; r <= max; r++) {
        if (!isValidPair(l, r, minDiff, allowEqual)) continue;
        allValid.push({ left: l, right: r });
        if (!usedPairs.has(`${l},${r}`)) unused.push({ left: l, right: r });
      }
    }
    if (unused.length) {
      const pick = unused[Math.floor(Math.random() * unused.length)];
      usedPairs.add(`${pick.left},${pick.right}`);
      return pick;
    }
    // Every valid pair has already been used at least once — a repeat is
    // unavoidable, but pick one at random rather than always the same
    // fixed pair, so which pair repeats varies from task to task.
    if (allValid.length) {
      return allValid[Math.floor(Math.random() * allValid.length)];
    }
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

  if (task.type === "compare_first_number" || (task.type === "compare_evaluate" && task.showLabels)) {
    if (task.left === task.right) {
      return words
        ? `${cap(numNom(task.left))} равно ${numDat(task.right)}`
        : `${task.left} = ${task.right}`;
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
      ? `${cap(numNom(task.left))} равно ${numDat(task.right)}`
      : `${task.left} = ${task.right}`;
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

// A number the child must PRODUCE (not just recognize) that satisfies a
// spoken constraint ("больше 6"). `value` always leaves room on the correct
// side within [min, max] so a valid answer exists.
function generateApplyGenerateTask(min, max) {
  const op = Math.random() < 0.5 ? "more" : "less";
  const value = op === "more"
    ? Math.floor(Math.random() * (max - min)) + min       // value < max
    : Math.floor(Math.random() * (max - min)) + min + 1;  // value > min
  return {
    taskType: "generate",
    op,
    value,
    min,
    max,
    promptText: op === "more" ? `Больше ${value}` : `Меньше ${value}`,
  };
}

// `count` distinct numbers, shown shuffled; the child taps them out in
// ascending order. `sorted` is the expected tap order (by value).
function generateApplyOrderTask(min, max, count) {
  const nums = new Set();
  while (nums.size < count) {
    nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  const sorted = [...nums].sort((a, b) => a - b);
  return { taskType: "order", numbers: shuffle([...nums]), sorted };
}

// sessionParams: { level?, question?: "more"|"less"|"mix", showEqual?: boolean, wordsVerdict?: boolean, visualMode?: "dots"|"dots_numbers"|"numbers"|"pairing", examplesCount?: number, showLabels?: boolean, taskType?: "generate"|"order" }
export function generateTasks(mode, cards, count = 20, sessionParams = {}) {
  if (!cards.length) return [];

  if (mode.type === "compare_apply") {
    const applyTaskType = sessionParams.taskType ?? "generate";
    const numbersCount  = 3;
    const levelDef      = COMPARISON_LEVELS.find((l) => l.id === (sessionParams.level ?? 2)) ?? COMPARISON_LEVELS[1];
    const { min, max }  = levelDef.params;
    const card          = resolveComparisonCard(mode, cards, sessionParams);
    if (!card) return [];

    const instruction = applyTaskType === "order"
      ? "Расставь числа по порядку — от меньшего к большему"
      : "Выбери число, которое подходит";

    const tasks = [];
    for (let i = 0; i < count; i++) {
      const base = applyTaskType === "order"
        ? generateApplyOrderTask(min, max, numbersCount)
        : generateApplyGenerateTask(min, max);
      tasks.push({ type: mode.type, conceptId: card.conceptId, instruction, ...base });
    }
    return tasks;
  }

  const { question = "more", showEqual = false, level = 2, wordsVerdict = false, visualMode = "dots" } = sessionParams;

  const isFirstNumber = mode.type === "compare_first_number";
  const isEvaluate    = mode.type === "compare_evaluate";
  const style         = isEvaluate ? (sessionParams.style ?? "sign") : null;
  // compare_first_number is the only evaluate-family task with a fixed
  // relationship to name ("is the first number bigger/smaller/equal?") —
  // "Сравни и поставь знак" and "Контрольная работа" always ask for the
  // real, unrigged relationship between two numbers (see the removed
  // direction-forcing below), so isVerbal only ever applies here.
  const isVerbal = isFirstNumber;

  const examplesCount = (isFirstNumber || isEvaluate)
    ? Math.max(1, Math.min(10, Number(sessionParams.examplesCount ?? 1)))
    : 1;
  const showLabels = isVerbal ? (sessionParams.showLabels !== false) : false;

  const levelDef   = COMPARISON_LEVELS.find((l) => l.id === level) ?? COMPARISON_LEVELS[1];
  const baseParams = levelDef.params;
  const card       = resolveComparisonCard(mode, cards, sessionParams);

  if (!card) return [];

  function taskInstruction(q) {
    if (isVerbal) {
      void q;
      return "Сравни первое число со вторым:";
    }
    if (isEvaluate) {
      return "Поставь правильный знак между числами";
    }
    if (mode.type === "compare_draw_sign") {
      // The sign to draw is fully determined by left vs right — "Что учим"
      // (more/less/mix) has no effect here, so don't derive an instruction
      // from it. Falls through to mode.ui.instruction in the renderer.
      return null;
    }
    const baseQ = q === "equal" ? (question === "less" ? "less" : "more") : q;
    const verb  = baseQ === "more" ? "больше" : "меньше";
    if (mode.type === "compare_sign") {
      return baseQ === "more" ? "Нажми на большее число" : "Нажми на меньшее число";
    }
    if (visualMode === "numbers") return baseQ === "more" ? "Какое число больше?" : "Какое число меньше?";
    if (visualMode === "pairing") return `Раздели точки на пары, потом покажи, где ${verb}`;
    if (visualMode === "dots") return `Где ${verb} точек?`;
    return `Где ${verb}?`;
  }

  const totalPairs  = examplesCount > 1 ? count * examplesCount : count;
  const tasks       = [];
  const equalTarget = showEqual ? Math.round(totalPairs * 0.3) : 0;
  const usedPairs    = new Set();

  for (let i = 0; i < totalPairs; i++) {
    let left, right;
    if (i < equalTarget) {
      let val, key, tries = 0;
      do {
        val = Math.floor(Math.random() * (baseParams.max - baseParams.min + 1)) + baseParams.min;
        key = `${val},${val}`;
        tries++;
      } while (usedPairs.has(key) && tries < MAX_ATTEMPTS);
      usedPairs.add(key);
      left = right = val;
    } else {
      ({ left, right } = generateComparisonTask({ ...baseParams, allowEqual: false }, usedPairs));
    }

    const isEqual = left === right;

    const taskQuestion = (isFirstNumber || isEvaluate)
      ? getFirstNumberRelation(left, right)   // always actual relationship
      : isEqual
        ? "equal"
        : question === "mix"
          ? (Math.random() < 0.5 ? "more" : "less")
          : question;

    const equalHint = showEqual
      ? (visualMode === "numbers" ? "Если числа одинаковые — нажми жёлтый квадрат" : "Если одинаково — нажми посередине")
      : null;

    tasks.push({ type: mode.type, left, right, conceptId: card.conceptId, question: taskQuestion, showEqual, wordsVerdict, visualMode, instruction: taskInstruction(taskQuestion), equalHint, showLabels, style });
  }

  if ((isFirstNumber || isEvaluate) && examplesCount > 1) {
    const shuffled = shuffle(tasks);
    const batches  = [];
    const batchInstruction = isVerbal ? "Сравни первое число со вторым:" : "Поставь правильный знак между числами";
    for (let i = 0; i + examplesCount <= shuffled.length; i += examplesCount) {
      batches.push({
        type: mode.type,
        items: shuffled.slice(i, i + examplesCount).map(({ left, right, question }) => ({ left, right, question })),
        conceptId: card.conceptId,
        showLabels,
        style,
        instruction: batchInstruction,
      });
    }
    return batches;
  }

  return shuffle(tasks);
}
