import { shuffle } from "@/shared/utils/shuffle";
import { DOT_LAYOUTS } from "./dotLayout.js";
import { REAL_LIFE_SCENES } from "./realLifeScenes.js";

const MAX_ATTEMPTS = 100;

export const COMPARISON_LEVELS = [
  { id: 1, label: "До 10, разница > 4", params: { min: 1,  max: 10, minDiff: 5 } },
  { id: 2, label: "До 10",              params: { min: 1,  max: 10, minDiff: 1 } },
  { id: 3, label: "До 20",              params: { min: 1,  max: 20, minDiff: 1 } },
  { id: 4, label: "До 99",              params: { min: 10, max: 99, minDiff: 1 } },
  // «По разрядам»: pairs up to 1000 where comparing place by place disagrees
  // with the first look — see placeValuePair below.
  { id: 5, label: "По разрядам (до 1000)", params: { min: 10, max: 999, minDiff: 1, placeValue: true } },
];

// Level 5 «По разрядам»: on random pairs up to 1000 the traps hardly ever come
// up, so half the pairs are made to be traps: swapped digits (47 / 74, 482 /
// 428), the zero in another place (305 / 350, 507 / 570), more digits is more
// (99 / 100, 98 / 102), a round number against the one just below (300 / 299),
// equal hundreds with the tens deciding (482 / 438). The other half are plain
// three-digit pairs. Which number stands left is random.
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const PLACE_TRAPS = [
  () => { const t = rnd(1, 9), o = rnd(1, 9); return t === o ? null : [t * 10 + o, o * 10 + t]; },
  () => { const h = rnd(1, 9), t = rnd(1, 9), o = rnd(1, 9); return t === o ? null : [h * 100 + t * 10 + o, h * 100 + o * 10 + t]; },
  () => { const h = rnd(1, 9), d = rnd(1, 9); return [h * 100 + d, h * 100 + d * 10]; },
  () => [rnd(90, 99), rnd(100, 109)],
  () => { const h = rnd(2, 9) * 100; return [h, h - rnd(1, 9)]; },
  () => { const h = rnd(1, 9) * 100, a = rnd(1, 9), b = rnd(0, 9); return a === b ? null : [h + a * 10 + rnd(0, 9), h + b * 10 + rnd(0, 9)]; },
];
// «По разрядам» is a level of «Сравни и поставь знак» only — the other modes
// are earlier steps (quantities, the crocodile, drawing) or work on a range;
// «Контрольная работа» has its own «Числа до» and mixes the traps in itself.
export const PLACE_VALUE_MODE_IDS = ["compare_evaluate"];

// «Сравни и нажми» (compare_visual): its views in teaching order, each with
// the highest level it makes sense on. Pairs come first — matching one to one
// needs no counting, so they work on any difference up to 10. Plain dots only
// on level 1: 9 and 10 scattered dots can't be told apart by eye, the child
// would just guess. A number under the dots allows counting, so up to 20.
// Numbers alone are the bridge to the crocodile step and take any range.
export const VISUAL_MODES = [
  { value: "pairing",      maxLevel: 2 },
  { value: "dots",         maxLevel: 1 },
  { value: "dots_numbers", maxLevel: 3 },
  { value: "numbers",      maxLevel: 4 },
];

// «Как лежат точки» applies to the views with a pile of dots to judge by eye.
// Pairs keep their columns (the leftovers must be visible), numbers have no dots.
export const DOT_LAYOUT_VIEWS = ["dots", "dots_numbers"];

export function dotLayoutFor(visualMode, dotLayout) {
  if (!DOT_LAYOUT_VIEWS.includes(visualMode)) return "rows";
  return DOT_LAYOUTS.includes(dotLayout) ? dotLayout : "rows";
}

export function visualModeLevel(visualMode, level) {
  const maxLevel = VISUAL_MODES.find((v) => v.value === visualMode)?.maxLevel ?? 1;
  return Math.min(level, maxLevel);
}

export function placeValuePair(usedPairs) {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const pair = Math.random() < 0.5 ? PLACE_TRAPS[rnd(0, PLACE_TRAPS.length - 1)]() : [rnd(100, 999), rnd(100, 999)];
    if (!pair || pair[0] === pair[1]) continue;
    const [left, right] = Math.random() < 0.5 ? pair : [pair[1], pair[0]];
    const key = `${left},${right}`;
    if (usedPairs?.has(key)) continue;
    usedPairs?.add(key);
    return { left, right };
  }
  return { left: 305, right: 350 };
}

// Numbers in words, 0–999, in the three cases the phrases need: «Три меньше
// семи» (nominative, genitive), «Три равно трём» (dative). Each case lists
// units 0–19, tens 2–9 and hundreds 1–9; a number is its parts in that case.
const NUMERALS = {
  nom: {
    units: ["ноль", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять", "десять",
      "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"],
    tens: ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"],
    hundreds: ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"],
  },
  gen: {
    units: ["нуля", "одного", "двух", "трёх", "четырёх", "пяти", "шести", "семи", "восьми", "девяти", "десяти",
      "одиннадцати", "двенадцати", "тринадцати", "четырнадцати", "пятнадцати", "шестнадцати", "семнадцати", "восемнадцати", "девятнадцати"],
    tens: ["", "", "двадцати", "тридцати", "сорока", "пятидесяти", "шестидесяти", "семидесяти", "восьмидесяти", "девяноста"],
    hundreds: ["", "ста", "двухсот", "трёхсот", "четырёхсот", "пятисот", "шестисот", "семисот", "восьмисот", "девятисот"],
  },
  dat: {
    units: ["нулю", "одному", "двум", "трём", "четырём", "пяти", "шести", "семи", "восьми", "девяти", "десяти",
      "одиннадцати", "двенадцати", "тринадцати", "четырнадцати", "пятнадцати", "шестнадцати", "семнадцати", "восемнадцати", "девятнадцати"],
    tens: ["", "", "двадцати", "тридцати", "сорока", "пятидесяти", "шестидесяти", "семидесяти", "восьмидесяти", "девяноста"],
    hundreds: ["", "ста", "двумстам", "трёмстам", "четырёмстам", "пятистам", "шестистам", "семистам", "восьмистам", "девятистам"],
  },
};

export function numberInWords(n, grammaticalCase = "nom") {
  const forms = NUMERALS[grammaticalCase];
  if (!Number.isInteger(n) || n < 0 || n > 999) return String(n);
  if (n === 0) return forms.units[0];
  const parts = [];
  if (n >= 100) parts.push(forms.hundreds[Math.floor(n / 100)]);
  const rest = n % 100;
  if (rest >= 20) {
    parts.push(forms.tens[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(forms.units[rest % 10]);
  } else if (rest) {
    parts.push(forms.units[rest]);
  }
  return parts.join(" ");
}

function numNom(n) { return numberInWords(n, "nom"); }
function numGen(n) { return numberInWords(n, "gen"); }
function numDat(n) { return numberInWords(n, "dat"); }
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

  // The crocodile and the drawn sign stand between the two numbers, so the
  // phrase reads that record left to right: 3 < 7 is «3 меньше 7», never «7 больше 3».
  if (task.type === "compare_first_number" || task.type === "compare_sign" || task.type === "compare_draw_sign" || (task.type === "compare_evaluate" && task.showLabels)) {
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
// Every distinct (op, value, includeEqual) comparison possible for this
// level's range, cycled in a fresh shuffled order before repeating —
// otherwise op/value were drawn independently at random per task, and with
// as few as 16 combos at the lower levels, runs of the same comparison
// ("< 5" several cards in a row, just with different distractor tiles)
// were common by plain chance. Mirrors shuffledSceneCycle()'s same fix for
// REAL_LIFE_SCENES below. value sits strictly inside (min, max) for both
// ops — a value equal to the range's own boundary (e.g. "more than 1"
// when min is 1) would leave every other number fitting the constraint,
// so there'd be no real non-fitting distractor left to offer.
//
// includeEqual doubles the cycle: every (op, value) pair appears once with
// value itself planted among the wrong tiles and once without, so a
// session is guaranteed real practice with "у кого больше" boundary
// mistake — tapping the number that's neither больше nor меньше, just
// equal — not left to chance the way a per-task coin flip would be.
function* shuffledApplyComboCycle(min, max) {
  const combos = [];
  for (let value = min + 1; value <= max - 1; value++) {
    for (const op of ["more", "less"]) {
      for (const includeEqual of [true, false]) {
        combos.push({ op, value, includeEqual });
      }
    }
  }
  for (;;) {
    for (const combo of shuffle(combos)) yield combo;
  }
}

function generateApplyGenerateTask(min, max, op, value, includeEqual, twoFit = false) {
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

  // Usually one tile fits; on some tasks two do (twoFit), so the child sees
  // that «больше 6» is not one number and can't settle it by elimination.
  const fitting = shuffledRest.filter(fits);
  const correct = fitting.slice(0, twoFit && fitting.length >= 2 ? 2 : 1);
  const nonFitting = shuffledRest.filter((n) => !fits(n));
  const wrongCount = 4 - correct.length;
  // value itself is never in `rest`, so it's never drawn by chance — plant
  // it deliberately on an includeEqual task. It's neither больше nor
  // меньше than itself, so it's always a genuinely wrong tile; being the
  // exact number just spoken back at the child (not just "some other
  // number") is what makes it worth testing on purpose rather than only
  // when it happens to come up.
  const wrong = includeEqual ? [value, ...nonFitting.slice(0, wrongCount - 1)] : nonFitting.slice(0, wrongCount);
  const options = shuffle([...correct, ...wrong]);

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
// size always matches the number that belongs in it either way. min/max
// are the level's own full range (not just the spread of the count drawn
// numbers) — CompareApply.jsx's scale hint drags across this whole range,
// so a "1" task still feels like a small step near the low end of "1–10"
// rather than being one extreme of its own private 2-number span.
function generateApplyOrderTask(min, max, count, direction) {
  const nums = new Set();
  while (nums.size < count) {
    nums.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  const ascending = [...nums].sort((a, b) => a - b);
  const sorted = direction === "desc" ? ascending.reverse() : ascending;
  return { taskType: "order", numbers: shuffle([...nums]), sorted, direction: direction === "desc" ? "desc" : "asc", min, max };
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
//
// mirror: the picture is shown flipped (CompareRealLife.jsx), so the two
// sides swap — names, counts and every per-side field — before anything
// else is derived; the bank doubles without a new picture, and the boy is
// not always on the left.
//
// phrase: the verdict's step on the speech ladder — "short" («У Маши
// больше»), "item" («У Маши больше яблок») or "full" (default, «У Маши
// больше яблок, чем у Пети»).
const REAL_LIFE_SIDE_FIELDS = [["left", "right"], ["nameA", "nameB"], ["nameANom", "nameBNom"], ["genderA", "genderB"], ["nameALoc", "nameBLoc"]];
export const REAL_LIFE_PHRASES = ["short", "item", "full"];

function mirrorScene(scene) {
  const out = { ...scene };
  for (const [a, b] of REAL_LIFE_SIDE_FIELDS) { out[a] = scene[b]; out[b] = scene[a]; }
  return out;
}

function realLifeTaskFromScene(sourceScene, askDirection, { mirror = false, phrase = "full" } = {}) {
  const scene = mirror ? mirrorScene(sourceScene) : sourceScene;
  const dataFact = scene.left === scene.right ? "equal" : scene.left > scene.right ? "more" : "less";
  // Most scenes count discrete objects ("больше яблок?"); a few compare a
  // continuous amount inside a container instead (water in a glass, porridge
  // in a bowl) — those carry containerPhrase ("в стакане") and need it
  // threaded into both the question and the verdict, or "У кого больше
  // воды?" reads as if the child should count something.
  const where = scene.containerPhrase ? `${scene.containerPhrase} ` : "";
  const askWord = askDirection === "less" ? "меньше" : "больше";

  let correctAnswer;
  if (dataFact === "equal") correctAnswer = "equal";
  else if (askDirection === "less") correctAnswer = dataFact === "more" ? "b" : "a";
  else correctAnswer = dataFact === "more" ? "a" : "b";

  // Russian grammar forces a 3-way split here, not just "who vs. what":
  // - "who" (default): both sides are animate (a child, an animal) — "У
  //   кого больше ног?" / "У мальчика".
  // - "what": inanimate but an externally attached/appended part (wheels,
  //   windows, petals, sails, buttons) — "у кого" would be wrong (that's
  //   the animate genitive interrogative), Russian wants "у чего".
  // - "where": inanimate AND an internal/sequential part of a composite
  //   whole (floors of a building, cars of a train, steps of a staircase)
  //   — even "у чего" reads as a translation-ese calque here; a native
  //   speaker asks "где" and answers "в доме"/"на лестнице" (locative,
  //   not possessive) — see feedback thread on the leg/wheel/floor scene
  //   batch, 2026-09-07: "не говорят у чего меньше ступенек — говорят,
  //   где меньше, и отвечают в большой лестнице/в маленькой лестнице."
  const askKind = scene.askKind ?? "who";

  let instruction, labelA, labelB, verdictText;
  if (askKind === "where") {
    const prep = scene.prep;
    instruction = `Где ${where}${askWord} ${scene.item}?`;
    labelA = `${cap(prep)} ${scene.nameALoc}`;
    labelB = `${cap(prep)} ${scene.nameBLoc}`;
    const [winLoc, loseLoc] = correctAnswer === "a" ? [scene.nameALoc, scene.nameBLoc] : [scene.nameBLoc, scene.nameALoc];
    verdictText = dataFact === "equal"
      ? { short: "Поровну.", item: `${cap(scene.item)} ${where}поровну.`,
          full: `${cap(prep)} ${scene.nameALoc} и ${prep} ${scene.nameBLoc} ${where}${scene.item} поровну.` }[phrase]
      : { short: `${cap(prep)} ${winLoc} ${askWord}.`, item: `${cap(prep)} ${winLoc} ${where}${askWord} ${scene.item}.`,
          full: `${cap(prep)} ${winLoc} ${where}${askWord} ${scene.item}, чем ${prep} ${loseLoc}.` }[phrase];
  } else {
    const interrogative = askKind === "what" ? "чего" : "кого";
    instruction = `У ${interrogative} ${where}${askWord} ${scene.item}?`;
    labelA = `У ${scene.nameA}`;
    labelB = `У ${scene.nameB}`;
    const [win, lose] = correctAnswer === "a" ? [scene.nameA, scene.nameB] : [scene.nameB, scene.nameA];
    verdictText = dataFact === "equal"
      ? { short: "Поровну.", item: `${cap(scene.item)} ${where}поровну.`,
          full: `У ${scene.nameA} и ${scene.nameB} ${where}${scene.item} поровну.` }[phrase]
      : { short: `У ${win} ${askWord}.`, item: `У ${win} ${where}${askWord} ${scene.item}.`,
          full: `У ${win} ${where}${askWord} ${scene.item}, чем у ${lose}.` }[phrase];
  }

  return {
    left: scene.left, right: scene.right,
    // nameA/nameB stay genitive ("мальчика", not the ready-made "У
    // мальчика" — kept for tests/debugging even though the UI now reads
    // labelA/labelB instead); nameANom/nameBNom are the plain nominative
    // form ("Петя", not "Пети") for labeling the character directly on the
    // scene image. labelA/labelB are the ready-to-render answer-button text
    // (genitive "У X" or locative "В/На X" depending on askKind —
    // CompareRealLife.jsx doesn't need to know which).
    nameA: scene.nameA, nameB: scene.nameB,
    nameANom: scene.nameANom, nameBNom: scene.nameBNom,
    genderA: scene.genderA, genderB: scene.genderB,
    item: scene.item, containerPhrase: scene.containerPhrase, askKind,
    prep: scene.prep, nameALoc: scene.nameALoc, nameBLoc: scene.nameBLoc,
    correctAnswer, instruction, verdictText, labelA, labelB, image: scene.image, mirror,
  };
}

// «Всем хватает?»: an option of «Сравни в жизни» (owner's call, 2026-11-02 —
// not a step of its own), its hardest part for now. Everyday one-to-one —
// children and chairs, cups and saucers... — built from separate sprites
// (tools/comparison/media/enough/*.webp, scripts/generate-enough-sprites.mjs),
// so the count on screen is always the task's count.
//
// The child answers the everyday question — «Всем детям хватает стульев?»,
// Хватает / Не хватает — and then why (owner's calls, 2026-11-02: no «Чего
// больше?» question, no «поровну», and no sentences on the screen — too
// much text): «Почему стульев не хватает?» with «Детей больше / Стульев
// больше / Детей меньше / Стульев меньше / Сколько детей, столько и
// стульев». The options continue «Потому что…» shown above them (owner's
// call), so they start in lower case and the answer reads as one sentence:
// «Потому что детей больше». Two of the four comparisons say the same thing in other words
// («детей больше» = «стульев меньше»), and either counts. «Сколько …,
// столько и …» is on every card, so its presence never gives the equal case
// away.
//
// Each set carries its Russian (genitive plural of both sides, the dative of
// the characters, the action), `mover` — what the action moves:
// the object by default («Дай каждому ребёнку стул»), the character when the
// action is about it («Поставь каждую чашку на блюдце», «…машинку в гараж»:
// owner's catch, 2026-11-02 — the garage must not drive onto the car) — and
// `place`: where the moved picture goes inside its partner's box (anchor,
// offset in box heights, size as a share of the box, in front or behind).
export const ENOUGH_SETS = [
  { id: "chairs", who: "kid", thing: "chair", whoGen: "детей", thingGen: "стульев", whoDat: "детям",
    matchHint: "Дай каждому ребёнку стул",
    place: { anchor: "bottom", dy: 0.08, size: 0.62, front: true } },
  { id: "cups", who: "cup", thing: "saucer", whoGen: "чашек", thingGen: "блюдец", whoDat: "чашкам",
    matchHint: "Поставь каждую чашку на блюдце",
    mover: "who", place: { anchor: "bottom", dy: -0.4, size: 0.8, front: true } },
  { id: "dogs", who: "dog", thing: "bone", whoGen: "собак", thingGen: "косточек", whoDat: "собакам",
    matchHint: "Дай каждой собаке косточку",
    place: { anchor: "bottom", dy: 0.12, size: 0.6, front: true } },
  { id: "rabbits", who: "rabbit", thing: "carrot", whoGen: "кроликов", thingGen: "морковок", whoDat: "кроликам",
    matchHint: "Дай каждому кролику морковку",
    place: { anchor: "bottom", dy: 0.12, size: 0.55, front: true } },
  { id: "cars", who: "car", thing: "garage", whoGen: "машинок", thingGen: "гаражей", whoDat: "машинкам",
    matchHint: "Поставь каждую машинку в гараж",
    mover: "who", place: { anchor: "bottom", dy: -0.15, size: 0.72, front: true } },
  { id: "hats", who: "kid", thing: "hat", whoGen: "детей", thingGen: "шапок", whoDat: "детям",
    matchHint: "Надень каждому ребёнку шапку",
    place: { anchor: "top", dy: -0.14, size: 0.3, front: true } },
];
// «Всем хватает?» in «Сравни в жизни»: off or on. The matching (each one
// gets its object) is the check after a wrong answer only (owner's call,
// 2026-11-02 — a child who answered right has nothing to check). The old
// "check" / "answer" orders of 2.51–2.55 both read as on.
export const ENOUGH_OPTIONS = ["off", "on"];
export function normalizeEnoughOption(value) {
  if (value === "check" || value === "answer") return "on";
  return ENOUGH_OPTIONS.includes(value) ? value : "off";
}
const ENOUGH_SPRITE_VARIANTS = 6;

// One card: 3–6 characters; the outcome is given by the caller, which cycles
// evenly through «не хватает» (1 or 2 short), «поровну» and «лишние» (1 or 2
// extra), so no answer is the safe guess.
function generateEnoughTask(set, outcome) {
  const who = 3 + Math.floor(Math.random() * 4);
  const diff = outcome === "equal" ? 0 : (Math.random() < 0.5 ? 1 : 2) * (outcome === "lack" ? -1 : 1);
  const things = Math.min(7, Math.max(2, who + diff));
  const variants = shuffle(Array.from({ length: ENOUGH_SPRITE_VARIANTS }, (_, i) => i + 1));
  const whoSprites = Array.from({ length: who }, (_, i) => `media/enough/${set.who}_${variants[i % variants.length]}.webp`);
  const cap = (w) => w[0].toUpperCase() + w.slice(1);
  const short = who - things, extra = things - who;
  const whyQuestion = `Почему ${set.thingGen} ${short > 0 ? "не хватает" : "хватает"}?`;
  const whyOptions = [
    { id: "whoMore", label: `${set.whoGen} больше` },
    { id: "thingMore", label: `${set.thingGen} больше` },
    { id: "whoLess", label: `${set.whoGen} меньше` },
    { id: "thingLess", label: `${set.thingGen} меньше` },
    { id: "same", label: `сколько ${set.whoGen}, столько и ${set.thingGen}` },
  ];
  const whyRight = short > 0 ? ["whoMore", "thingLess"] : extra > 0 ? ["thingMore", "whoLess"] : ["same"];
  return {
    set: set.id, who, things, enough: things >= who,
    whoSprites, thingSprite: `media/enough/${set.thing}.webp`, mover: set.mover ?? "thing", place: set.place,
    enoughQuestion: `Всем ${set.whoDat} хватает ${set.thingGen}?`,
    matchHint: set.matchHint,
    instruction: `Всем ${set.whoDat} хватает ${set.thingGen}?`,
    whyQuestion, whyOptions, whyRight,
  };
}

// The «Всем хватает?» cards of a «Сравни в жизни» session: sets and outcomes
// each cycle through their own shuffled bag.
function* enoughTaskCycle(conceptId) {
  let sets = [], outcomes = [];
  for (;;) {
    if (!sets.length) sets = shuffle(ENOUGH_SETS);
    if (!outcomes.length) outcomes = shuffle(["lack", "equal", "spare"]);
    yield { type: "compare_enough", conceptId, ...generateEnoughTask(sets.pop(), outcomes.pop()) };
  }
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

// «Контрольная работа»: a sheet is one test. Not one level but a mix
// of every step up to the chosen ceiling, so a test «до 100» still checks
// numbers up to 10 and 20; the top range gets the most rows. Every sheet has
// pairs on «равно» (one in short sheets, two from six rows), and from «до 100»
// the traps the ladder teaches: swapped digits (47 / 74), same tens (43 / 48);
// «до 1000» adds the place-value traps (305 / 350, 99 / 100, 300 / 299).
export const TEST_RANGES = [10, 20, 100, 1000];

const TEST_BANDS = {
  10:   [{ share: 1,   min: 1,  max: 10 }],
  20:   [{ share: 0.4, min: 1,  max: 10 }, { share: 0.6, min: 1, max: 20, over: 10 }],
  100:  [{ share: 0.2, min: 1,  max: 10 }, { share: 0.3, min: 1, max: 20, over: 10 }, { share: 0.5, min: 10, max: 99, traps: "tens" }],
  1000: [{ share: 0.2, min: 1,  max: 20 }, { share: 0.3, min: 10, max: 99, traps: "tens" }, { share: 0.5, min: 100, max: 999, traps: "places" }],
};

const TENS_TRAPS = [
  () => { const t = rnd(1, 9), o = rnd(1, 9); return t === o ? null : [t * 10 + o, o * 10 + t]; },
  () => { const t = rnd(1, 9), a = rnd(0, 9), b = rnd(0, 9); return a === b ? null : [t * 10 + a, t * 10 + b]; },
];

function testPair(band, used) {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    let pair;
    if (band.traps === "places") { const p = placeValuePair(null); pair = [p.left, p.right]; }
    else if (band.traps === "tens" && Math.random() < 0.5) pair = TENS_TRAPS[rnd(0, TENS_TRAPS.length - 1)]();
    else pair = [rnd(band.min, band.max), rnd(band.min, band.max)];
    if (!pair || pair[0] === pair[1]) continue;
    // «до 20» rows are the teens: at least one number over 10.
    if (band.over && Math.max(...pair) <= band.over) continue;
    const key = `${pair[0]},${pair[1]}`;
    if (used.has(key) || used.has(`${pair[1]},${pair[0]}`)) continue;
    used.add(key);
    return { left: pair[0], right: pair[1] };
  }
  return { left: band.min, right: band.max };
}

export function generateTestSheet(range, count) {
  const bands = TEST_BANDS[range] ?? TEST_BANDS[20];
  const used = new Set();
  const equalCount = count >= 6 ? 2 : 1;
  const rows = [];
  // Rows per band by share, the rest to the top band.
  const unequal = count - equalCount;
  const perBand = bands.map((b) => Math.floor(unequal * b.share));
  perBand[perBand.length - 1] += unequal - perBand.reduce((a, b) => a + b, 0);
  bands.forEach((band, i) => { for (let k = 0; k < perBand[i]; k++) rows.push(testPair(band, used)); });
  const top = bands[bands.length - 1];
  for (let k = 0; k < equalCount; k++) {
    let v, tries = 0;
    do { v = rnd(top.over ? top.over + 1 : top.min, top.max); tries++; } while (used.has(`${v},${v}`) && tries < MAX_ATTEMPTS);
    used.add(`${v},${v}`);
    rows.push({ left: v, right: v });
  }
  return shuffle(rows).map(({ left, right }) => ({ left, right, question: getFirstNumberRelation(left, right) }));
}

// sessionParams: { level?, question?: "more"|"less"|"mix", showEqual?: boolean, wordsVerdict?: boolean, visualMode?: "dots"|"dots_numbers"|"numbers"|"pairing", dotLayout?: "rows"|"scatter"|"lure" (compare_visual, dots views only), examplesCount?: number, showLabels?: boolean, taskType?: "generate"|"order", numbersCount?: number (3-5, "order" only), orderDirection?: "asc"|"desc" ("order" only), phrase?: "short"|"item"|"full" (compare_real_life), enough?: "off"|"on" (compare_real_life: «Всем хватает?» cards; old "check"/"answer" = on) }
export function generateTasks(mode, cards, count = 20, sessionParams = {}) {
  if (!cards.length) return [];

  if (mode.type === "compare_real_life") {
    const card = resolveComparisonCard(mode, cards, sessionParams);
    if (!card) return [];
    const questionMode = sessionParams.question ?? "more";
    const phrase = REAL_LIFE_PHRASES.includes(sessionParams.phrase) ? sessionParams.phrase : "full";
    const cycle = shuffledSceneCycle();
    // «Всем хватает?» on: its cards go in turn with the picture scenes.
    const enoughCycle = normalizeEnoughOption(sessionParams.enough) === "on" ? enoughTaskCycle(card.conceptId) : null;
    const tasks = [];
    for (let i = 0; i < count; i++) {
      if (enoughCycle && i % 2 === 1) { tasks.push(enoughCycle.next().value); continue; }
      const askDirection = questionMode === "mix" ? (Math.random() < 0.5 ? "more" : "less") : questionMode;
      // Half of the showings are mirrored — always on, nothing to set.
      const t = realLifeTaskFromScene(cycle.next().value, askDirection, { mirror: Math.random() < 0.5, phrase });
      tasks.push({ type: mode.type, conceptId: card.conceptId, allowEqual: true, ...t });
    }
    return tasks;
  }

  if (mode.type === "compare_apply") {
    const applyTaskType = sessionParams.taskType ?? "generate";
    const numbersCount  = applyTaskType === "order"
      ? Math.max(3, Math.min(5, sessionParams.numbersCount ?? 3))
      : 3;
    const levelDef      = COMPARISON_LEVELS.find((l) => l.id === (sessionParams.level === 5 ? 4 : sessionParams.level ?? 2)) ?? COMPARISON_LEVELS[1];
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
        const { op, value, includeEqual } = comboCycle.next().value;
        base = generateApplyGenerateTask(min, max, op, value, includeEqual, i % 3 === 2);
      }
      tasks.push({ type: mode.type, conceptId: card.conceptId, instruction, ...base });
    }
    return tasks;
  }

  if (mode.id === "compare_test") {
    const card = resolveComparisonCard(mode, cards, sessionParams);
    if (!card) return [];
    const range = TEST_RANGES.includes(sessionParams.testRange) ? sessionParams.testRange : 20;
    const examples = Math.max(4, Math.min(10, Number(sessionParams.examplesCount ?? 8)));
    // One sheet per task: each sheet is a test of its own with its own
    // result, and the lesson goes on sheet after sheet like any other —
    // a reward may need several sheets.
    return Array.from({ length: count }, () => ({
      type: mode.type,
      items: generateTestSheet(range, examples),
      conceptId: card.conceptId,
      style: sessionParams.style ?? "sign",
      instruction: "Поставь правильный знак между числами",
      isTest: true,
    }));
  }

  const { question = "more", level = 2, wordsVerdict = false, visualMode = "dots" } = sessionParams;
  const dotLayout = mode.type === "compare_visual" ? dotLayoutFor(visualMode, sessionParams.dotLayout) : "rows";
  // The lure's strongest task is «поровну» that looks unequal, so it comes
  // with the = square, like pairs do.
  const showEqual = dotLayout === "lure" ? true : (sessionParams.showEqual ?? false);

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

  const levelId    = mode.type === "compare_visual"
    ? visualModeLevel(visualMode, level)
    : level === 5 && !PLACE_VALUE_MODE_IDS.includes(mode.id) ? 4 : level;
  const levelDef   = COMPARISON_LEVELS.find((l) => l.id === levelId) ?? COMPARISON_LEVELS[1];
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
      ({ left, right } = baseParams.placeValue
        ? placeValuePair(usedPairs)
        : generateComparisonTask({ ...baseParams, allowEqual: false }, usedPairs));
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
      ? (visualMode === "numbers" ? "Если числа одинаковые — нажми жёлтый квадрат" : "Если поровну — нажми на жёлтый квадрат")
      : null;

    // Level 5: after a mistake the renderer shows both numbers by places
    // (PlaceHint) — not in «Контрольная работа».
    const placeHint = Boolean(baseParams.placeValue) && mode.id !== "compare_test";
    // What the crocodile step asks to tap. An equal pair asks the same as the
    // others, so the wording never gives away that this pair is the equal one.
    const ask = taskQuestion === "equal" ? (question === "less" ? "less" : "more") : taskQuestion;
    // Lure: every other task in each group (equal pairs first, then the rest)
    // is drawn to mislead, the others honestly — always misleading would just
    // teach «pick the small dots».
    const lure = dotLayout === "lure" && (isEqual ? i : i - equalTarget) % 2 === 0;
    tasks.push({ type: mode.type, left, right, conceptId: card.conceptId, question: taskQuestion, ask, showEqual, wordsVerdict, visualMode, instruction: taskInstruction(taskQuestion), equalHint, showLabels, style, placeHint,
      ...(mode.type === "compare_visual" ? { dotLayout, lure } : {}) });
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
