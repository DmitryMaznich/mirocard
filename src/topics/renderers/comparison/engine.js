import { shuffle } from "@/shared/utils/shuffle";
import { REAL_LIFE_SCENES } from "./realLifeScenes.js";

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

// A handful of concrete number tiles the child taps one of — one that
// satisfies a spoken constraint ("больше 6"), a few that don't. Children who
// can't reason about "any number bigger than 6" in the abstract can still
// recognize a satisfying number among a small closed set of choices, so this
// is a discrimination task, not free number generation. `value` always
// leaves room on the correct side within [min, max] so a valid tile exists.
// The boundary value itself is always one of the wrong tiles, since it's the
// most instructive near-miss for a strict "больше/меньше".
// Every distinct (op, value) comparison possible for this level's range,
// cycled in a fresh shuffled order before repeating — otherwise op/value
// were drawn independently at random per task, and with as few as 16
// combos at the lower levels, runs of the same comparison ("< 5" several
// cards in a row, just with different distractor tiles) were common by
// plain chance. Mirrors shuffledSceneCycle()'s same fix for
// REAL_LIFE_SCENES below. value sits strictly inside (min, max) for both
// ops — a value equal to the range's own boundary (e.g. "more than 1"
// when min is 1) would leave every other number fitting the constraint,
// so there'd be no real non-fitting distractor left to offer once value
// itself is dropped from the tile pool (see generateApplyGenerateTask's
// `wrong` comment).
function* shuffledApplyComboCycle(min, max) {
  const combos = [];
  for (let value = min + 1; value <= max - 1; value++) {
    combos.push({ op: "more", value });
    combos.push({ op: "less", value });
  }
  for (;;) {
    for (const combo of shuffle(combos)) yield combo;
  }
}

function generateApplyGenerateTask(min, max, op, value) {
  const fits = (n) => (op === "more" ? n > value : n < value);
  const rest = [];
  for (let n = min; n <= max; n++) if (n !== value) rest.push(n);
  // shuffle() returns a new array rather than mutating its argument —
  // without capturing the result, `rest` stayed in ascending numeric order,
  // so .find(fits) below always deterministically picked the smallest
  // valid number (== min for "less", the boundary value's successor for
  // "more") instead of a random one. At level 4 (min: 10) that made every
  // "less" task's correct tile the number 10, no matter what the spoken
  // constraint actually was.
  const shuffledRest = shuffle(rest);

  const correct = shuffledRest.find(fits);
  // Drawn only from numbers that genuinely don't fit — value itself used to
  // be forced in here as a guaranteed distractor ("you can't just repeat the
  // number"), but that put the same digits on screen twice (once as the
  // task's reference value, once as a tile) and was read as confusing
  // duplication rather than a meaningful wrong answer. Plenty of non-fitting
  // candidates exist at every level (see COMPARISON_LEVELS), so dropping it
  // doesn't reopen elimination-guessing.
  const wrong = shuffledRest.filter((n) => !fits(n)).slice(0, 3);
  const options = shuffle([correct, ...wrong]);

  return {
    taskType: "generate",
    op,
    value,
    min,
    max,
    options,
    promptText: op === "more" ? `Больше ${value}` : `Меньше ${value}`,
  };
}

// `count` distinct numbers, shown shuffled. `sorted` is the expected slot
// order — ascending (small→big) by default, or reversed for `direction:
// "desc"` — CompareApply.jsx reads `direction` to flip which end of the
// staircase (smallest box vs. largest box) is `sorted[0]`, so a box's
// size always matches the number that belongs in it either way.
function generateApplyOrderTask(min, max, count, direction) {
  const nums = new Set();
  while (nums.size < count) {
    nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  const ascending = [...nums].sort((a, b) => a - b);
  const sorted = direction === "desc" ? ascending.reverse() : ascending;
  return { taskType: "order", numbers: shuffle([...nums]), sorted, direction: direction === "desc" ? "desc" : "asc" };
}

// compare_real_life draws from a fixed bank of pre-illustrated scenes
// (realLifeScenes.js, generated by scripts/generate-reallife-scenes.mjs)
// instead of generating arbitrary numbers within a level's range — each
// scene is a full illustration with an exact, baked-in item count on each
// side, so there's no free choice of left/right to make here the way
// generateComparisonTask offers other compare_* modes.
//
// askDirection ("more" | "less") is which relationship the question is
// actually asking about — independent of `dataFact`, which side objectively
// has more. Before this, the question was always "больше" and the two
// happened to coincide; correctAnswer is the one place that separates them,
// so CompareRealLife.jsx never has to re-derive "more" vs "less" itself.
function realLifeTaskFromScene(scene, askDirection) {
  const dataFact = scene.left === scene.right ? "equal" : scene.left > scene.right ? "more" : "less";
  // Most scenes count discrete objects ("больше яблок?"); a few compare a
  // continuous amount inside a container instead (water in a glass, porridge
  // in a bowl) — those carry containerPhrase ("в стакане") and need it
  // threaded into both the question and the verdict, or "У кого больше
  // воды?" reads as if the child should count something.
  const where = scene.containerPhrase ? `${scene.containerPhrase} ` : "";
  const askWord = askDirection === "less" ? "меньше" : "больше";
  const instruction = `У кого ${where}${askWord} ${scene.item}?`;

  let correctAnswer;
  if (dataFact === "equal") correctAnswer = "equal";
  else if (askDirection === "less") correctAnswer = dataFact === "more" ? "b" : "a";
  else correctAnswer = dataFact === "more" ? "a" : "b";

  const verdictText = dataFact === "equal"
    ? `У ${scene.nameA} и ${scene.nameB} ${where}${scene.item} поровну.`
    : correctAnswer === "a"
      ? `У ${scene.nameA} ${where}${askWord} ${scene.item}, чем у ${scene.nameB}.`
      : `У ${scene.nameB} ${where}${askWord} ${scene.item}, чем у ${scene.nameA}.`;

  return {
    left: scene.left, right: scene.right,
    // nameA/nameB stay genitive (for "У ..." sentences above); nameANom/
    // nameBNom are the plain nominative form ("Петя", not "Пети") for
    // labeling the character directly on the scene image.
    nameA: scene.nameA, nameB: scene.nameB,
    nameANom: scene.nameANom, nameBNom: scene.nameBNom,
    genderA: scene.genderA, genderB: scene.genderB,
    item: scene.item, containerPhrase: scene.containerPhrase,
    correctAnswer, instruction, verdictText, image: scene.image,
  };
}

// Cycles through the whole bank in a fresh shuffled order before repeating —
// avoids the same scene appearing twice in a row while still giving every
// scene equal airtime over a long (effectively endless) session.
function* shuffledSceneCycle() {
  for (;;) {
    const batch = shuffle(REAL_LIFE_SCENES);
    for (const scene of batch) yield scene;
  }
}

// sessionParams: { level?, question?: "more"|"less"|"mix", showEqual?: boolean, wordsVerdict?: boolean, visualMode?: "dots"|"dots_numbers"|"numbers"|"pairing", examplesCount?: number, showLabels?: boolean, taskType?: "generate"|"order", numbersCount?: number (3-5, "order" only), orderDirection?: "asc"|"desc" ("order" only) }
export function generateTasks(mode, cards, count = 20, sessionParams = {}) {
  if (!cards.length) return [];

  if (mode.type === "compare_real_life") {
    const card = resolveComparisonCard(mode, cards, sessionParams);
    if (!card) return [];
    const questionMode = sessionParams.question ?? "more";
    const cycle = shuffledSceneCycle();
    const tasks = [];
    for (let i = 0; i < count; i++) {
      const askDirection = questionMode === "mix" ? (Math.random() < 0.5 ? "more" : "less") : questionMode;
      const t = realLifeTaskFromScene(cycle.next().value, askDirection);
      tasks.push({ type: mode.type, conceptId: card.conceptId, allowEqual: true, ...t });
    }
    return tasks;
  }

  if (mode.type === "compare_apply") {
    const applyTaskType = sessionParams.taskType ?? "generate";
    const numbersCount  = applyTaskType === "order"
      ? Math.max(3, Math.min(5, sessionParams.numbersCount ?? 3))
      : 3;
    const levelDef      = COMPARISON_LEVELS.find((l) => l.id === (sessionParams.level ?? 2)) ?? COMPARISON_LEVELS[1];
    const { min, max }  = levelDef.params;
    const card          = resolveComparisonCard(mode, cards, sessionParams);
    if (!card) return [];

    // The staircase's own box sizes (small→large or large→small) already
    // show which end is which — no "от меньшего/большего" suffix needed.
    const instruction = applyTaskType === "order"
      ? "Расставь числа по порядку"
      : "Выбери число";
    const orderDirection = sessionParams.orderDirection === "desc" ? "desc" : "asc";
    const comboCycle = applyTaskType === "order" ? null : shuffledApplyComboCycle(min, max);

    const tasks = [];
    for (let i = 0; i < count; i++) {
      let base;
      if (applyTaskType === "order") {
        base = generateApplyOrderTask(min, max, numbersCount, orderDirection);
      } else {
        const { op, value } = comboCycle.next().value;
        base = generateApplyGenerateTask(min, max, op, value);
      }
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
