import { describe, it, expect } from "vitest";
import { generateComparisonTask, generateTasks, getVerdict } from "./engine";
import { REAL_LIFE_SCENES } from "./realLifeScenes.js";

// generateComparisonTask() takes a raw params object directly — unrelated to
// the "cards" shape below (cards no longer carry their own min/max/minDiff,
// see note further down).
const EASY_PARAMS   = { min: 1, max: 10, minDiff: 3, allowEqual: false };
const MEDIUM_PARAMS = { min: 1, max: 10, minDiff: 1, allowEqual: false };
const HARD_PARAMS   = { min: 1, max: 20, minDiff: 1, allowEqual: true  };

// Real cards only carry id/conceptId/label — the number range is driven
// solely by sessionParams.level (COMPARISON_LEVELS), not by a per-card
// params object. A card only ever affects which conceptId a task is tagged
// with (used for per-concept progress tracking).
const CARD_EASY   = { id: "compare_easy",   conceptId: "compare_easy",   primary: true };
const CARD_MEDIUM = { id: "compare_medium", conceptId: "compare_medium", primary: true };
const CARD_HARD   = { id: "compare_hard",   conceptId: "compare_hard",   primary: true };

const ALL_CARDS = [CARD_EASY, CARD_MEDIUM, CARD_HARD];

const MODE_VISUAL = {
  id: "compare_visual", type: "compare_visual", evaluation: "auto",
  defaultCardId: "compare_easy",
  ui: { title: "1. Где больше?", instruction: "Нажми на сторону где больше кружков" },
};
const MODE_NUMBERS = {
  id: "compare_numbers", type: "compare_numbers", evaluation: "auto",
  defaultCardId: "compare_medium",
  ui: { title: "3. Какое больше?", instruction: "Нажми на большее число" },
};
const MODE_EQUAL = {
  id: "compare_equal", type: "compare_equal", evaluation: "auto",
  defaultCardId: "compare_hard",
  ui: { title: "5. Больше, меньше или равно?", instruction: "Нажми на большее или на =" },
};
const MODE_FIRST = {
  id: "compare_first_number", type: "compare_first_number", evaluation: "auto",
  defaultCardId: "compare_medium",
  ui: { title: "Первое число", instruction: "Посмотри на первое число" },
};
const MODE_DRAW_SIGN = {
  id: "compare_draw_sign", type: "compare_draw_sign", evaluation: "auto",
  defaultCardId: "compare_hard",
  ui: { title: "3. Нарисуй знак", instruction: "Нарисуй правильный знак пальцем" },
};
const MODE_EVALUATE = {
  id: "compare_evaluate", type: "compare_evaluate", evaluation: "auto",
  defaultCardId: "compare_hard",
  ui: { title: "4. Сравни и поставь знак", instruction: "Поставь правильный знак между числами" },
};
// "Контрольная работа" — a distinct mode entry that shares compare_evaluate's
// type/renderer/engine branch (multi-item batching), differing only in id
// and which params it exposes (examplesCount).
const MODE_TEST = {
  id: "compare_test", type: "compare_evaluate", evaluation: "auto",
  defaultCardId: "compare_hard",
  ui: { title: "7. Контрольная работа", instruction: "Реши примеры один за другим" },
};
const MODE_APPLY = {
  id: "compare_apply", type: "compare_apply", evaluation: "auto",
  defaultCardId: "compare_hard",
  ui: { title: "6. Применяем сравнение", instruction: "Выбери число или расставь по порядку" },
};
const MODE_REAL_LIFE = {
  id: "compare_real_life", type: "compare_real_life", evaluation: "auto",
  defaultCardId: "compare_medium",
  ui: { title: "8. Сравни в жизни", instruction: "У кого больше?" },
};

describe("generateComparisonTask", () => {
  it("returns left and right within [min, max]", () => {
    for (let i = 0; i < 50; i++) {
      const { left, right } = generateComparisonTask(EASY_PARAMS);
      expect(left).toBeGreaterThanOrEqual(1);
      expect(left).toBeLessThanOrEqual(10);
      expect(right).toBeGreaterThanOrEqual(1);
      expect(right).toBeLessThanOrEqual(10);
    }
  });

  it("respects minDiff when allowEqual is false", () => {
    for (let i = 0; i < 100; i++) {
      const { left, right } = generateComparisonTask(EASY_PARAMS);
      expect(Math.abs(left - right)).toBeGreaterThanOrEqual(3);
    }
  });

  it("never produces equal values when allowEqual is false", () => {
    for (let i = 0; i < 100; i++) {
      const { left, right } = generateComparisonTask(MEDIUM_PARAMS);
      expect(left).not.toBe(right);
    }
  });

  it("sometimes produces equal values when allowEqual is true", () => {
    let seenEqual = false;
    for (let i = 0; i < 200; i++) {
      const { left, right } = generateComparisonTask(HARD_PARAMS);
      if (left === right) { seenEqual = true; break; }
    }
    expect(seenEqual).toBe(true);
  });

  // Reported bug: level 1 (minDiff:5, range 1-10) only has ~30 valid ordered
  // pairs, but compare_sign requests 500 tasks in one batch. Once usedPairs
  // exhausts the pool, every subsequent draw fails all MAX_ATTEMPTS random
  // tries and used to fall back to one fixed pair (min, min+minDiff) — the
  // child saw the exact same pair (1, 6) repeat for hundreds of tasks in a
  // row instead of a mix of the already-seen pairs.
  it("does not collapse onto one fixed pair once the pool of unique pairs is exhausted", () => {
    const LEVEL_1_PARAMS = { min: 1, max: 10, minDiff: 5, allowEqual: false };
    const usedPairs = new Set();
    const overflow = [];
    for (let i = 0; i < 200; i++) {
      overflow.push(generateComparisonTask(LEVEL_1_PARAMS, usedPairs));
    }
    // Only the pairs generated after the ~30-pair pool is exhausted are at
    // risk — check the back half of the batch, where every draw is
    // guaranteed to already be a repeat of some earlier pair.
    const repeats = overflow.slice(100);
    const distinctRepeats = new Set(repeats.map((t) => `${t.left},${t.right}`));
    expect(distinctRepeats.size).toBeGreaterThan(1);
  });
});

describe("generateTasks", () => {
  it("returns requested count of tasks", () => {
    expect(generateTasks(MODE_VISUAL, ALL_CARDS, 20)).toHaveLength(20);
  });

  it("defaults to level 2 (1-10, minDiff 1) when no level is given", () => {
    for (let i = 0; i < 5; i++) {
      const tasks = generateTasks(MODE_VISUAL, ALL_CARDS, 20);
      tasks.forEach(({ left, right }) => {
        expect(left).toBeGreaterThanOrEqual(1);
        expect(left).toBeLessThanOrEqual(10);
        expect(right).toBeGreaterThanOrEqual(1);
        expect(right).toBeLessThanOrEqual(10);
      });
    }
  });

  it("level (not the card) controls the numeric range — level 4 reaches two-digit numbers", () => {
    const tasks = generateTasks(MODE_VISUAL, ALL_CARDS, 30, { level: 4 });
    tasks.forEach(({ left, right }) => {
      expect(left).toBeGreaterThanOrEqual(10);
      expect(left).toBeLessThanOrEqual(99);
      expect(right).toBeGreaterThanOrEqual(10);
      expect(right).toBeLessThanOrEqual(99);
    });
  });

  it("level 1 enforces minDiff >= 5 regardless of which card is selected", () => {
    const tasks = generateTasks(MODE_VISUAL, ALL_CARDS, 30, { level: 1, cardId: "compare_hard" });
    tasks.forEach(({ left, right }) => {
      expect(Math.abs(left - right)).toBeGreaterThanOrEqual(5);
    });
  });

  it("each task has type, left, right, conceptId, question fields", () => {
    const tasks = generateTasks(MODE_NUMBERS, ALL_CARDS, 5);
    tasks.forEach((task) => {
      expect(task).toMatchObject({
        type:      "compare_numbers",
        left:      expect.any(Number),
        right:     expect.any(Number),
        conceptId: "compare_medium",
        question:  expect.stringMatching(/^(more|less|equal)$/),
      });
    });
  });

  it("default question is 'more' — all non-equal tasks have question='more'", () => {
    const tasks = generateTasks(MODE_NUMBERS, ALL_CARDS, 20);
    tasks.forEach(({ left, right, question }) => {
      if (left !== right) expect(question).toBe("more");
    });
  });

  it("question='less' sets all non-equal tasks to 'less'", () => {
    const tasks = generateTasks(MODE_NUMBERS, ALL_CARDS, 20, { question: "less" });
    tasks.forEach(({ left, right, question }) => {
      if (left !== right) expect(question).toBe("less");
    });
  });

  it("question='mix' produces both 'more' and 'less' tasks", () => {
    const tasks = generateTasks(MODE_NUMBERS, ALL_CARDS, 40, { question: "mix" });
    const nonEqual = tasks.filter(({ left, right }) => left !== right);
    const questions = new Set(nonEqual.map((t) => t.question));
    expect(questions.has("more")).toBe(true);
    expect(questions.has("less")).toBe(true);
  });

  it("showEqual generates ~30% equal tasks", () => {
    const tasks = generateTasks(MODE_NUMBERS, ALL_CARDS, 20, { showEqual: true });
    const equalCount = tasks.filter(({ left, right }) => left === right).length;
    expect(equalCount).toBe(6); // Math.round(20 * 0.3) = 6
  });

  it("equal tasks always get question='equal'", () => {
    const tasks = generateTasks(MODE_EQUAL, ALL_CARDS, 20, { showEqual: true });
    tasks.forEach(({ left, right, question }) => {
      if (left === right) expect(question).toBe("equal");
    });
  });

  it("showEqual=false never produces equal tasks even for hard card", () => {
    for (let i = 0; i < 5; i++) {
      const tasks = generateTasks(MODE_EQUAL, ALL_CARDS, 20, { showEqual: false });
      tasks.forEach(({ left, right }) => expect(left).not.toBe(right));
    }
  });

  it("cardId override only changes which conceptId tasks are tagged with, not the number range", () => {
    const tasks = generateTasks(MODE_VISUAL, ALL_CARDS, 20, { cardId: "compare_hard" });
    tasks.forEach(({ left, right, conceptId }) => {
      expect(conceptId).toBe("compare_hard");
      // range still comes from the default level (2: 1-10), the hard card
      // does not widen it — number ranges are level-driven, not card-driven.
      expect(left).toBeLessThanOrEqual(10);
      expect(right).toBeLessThanOrEqual(10);
    });
  });

  it("falls back to cards[0] when defaultCardId is not found", () => {
    const orphanMode = { ...MODE_VISUAL, defaultCardId: "nonexistent" };
    const tasks = generateTasks(orphanMode, [CARD_EASY], 10);
    expect(tasks).toHaveLength(10);
    tasks.forEach(({ conceptId }) => expect(conceptId).toBe("compare_easy"));
  });

  it("compare_visual gives a pairing-specific instruction for visualMode=pairing", () => {
    for (const question of ["more", "less"]) {
      const tasks = generateTasks(MODE_VISUAL, ALL_CARDS, 10, { question, visualMode: "pairing" });
      const verb = question === "more" ? "больше" : "меньше";
      tasks.forEach((t) => {
        expect(t.visualMode).toBe("pairing");
        expect(t.instruction).toBe(`Раздели точки на пары, потом покажи, где ${verb}`);
      });
    }
  });

  it("compare_first_number derives question from the first number relation", () => {
    const tasks = generateTasks(MODE_FIRST, ALL_CARDS, 40, { showEqual: true });
    tasks.forEach(({ left, right, question, instruction, type }) => {
      expect(type).toBe("compare_first_number");
      expect(instruction).toMatch(/первое число/i);
      if (left === right) expect(question).toBe("equal");
      if (left < right) expect(question).toBe("less");
      if (left > right) expect(question).toBe("more");
    });
  });

  // compare_draw_sign: the sign to draw is fully determined by left vs
  // right, so "question" (more/less/mix) must not drive its instruction —
  // it used to fall through to the visual-picking wording ("Где больше?"),
  // which doesn't make sense for a drawing task and doesn't track which
  // sign is actually correct.
  it("compare_draw_sign has no per-task instruction regardless of question", () => {
    for (const question of ["more", "less", "mix"]) {
      const tasks = generateTasks(MODE_DRAW_SIGN, ALL_CARDS, 10, { question });
      tasks.forEach((task) => {
        expect(task.instruction).toBeFalsy();
      });
    }
  });

  // compare_evaluate: the child names the real relationship between two
  // numbers by choosing a sign/word, so there is nothing to "direct" —
  // rigging every pair to the same answer (the old "Где больше"/"Где
  // меньше" behavior) made the task trivially solvable without looking at
  // the numbers at all. Tasks must always reflect the real left/right
  // relationship, regardless of any (now unused) "question" value —
  // including a stale one left over from a student's old saved settings.
  it("compare_evaluate never rigs pairs toward one answer, even if a stale question param is passed", () => {
    for (const staleQuestion of ["more", "less", "mix", undefined]) {
      const tasks = generateTasks(MODE_EVALUATE, ALL_CARDS, 40, { question: staleQuestion });
      const relations = new Set(tasks.map((t) => t.question));
      expect(relations.has("more")).toBe(true);
      expect(relations.has("less")).toBe(true);
      tasks.forEach((t) => {
        const real = t.left === t.right ? "equal" : t.left > t.right ? "more" : "less";
        expect(t.question).toBe(real);
      });
    }
  });

  it("compare_evaluate has a fixed instruction independent of any question setting", () => {
    const tasks = generateTasks(MODE_EVALUATE, ALL_CARDS, 10, { question: "more" });
    tasks.forEach((t) => expect(t.instruction).toBe("Поставь правильный знак между числами"));
  });

  // "Контрольная работа" reuses compare_evaluate's type/engine branch —
  // only the mode id/params differ (examplesCount is meaningful here).
  it("compare_test (Контрольная работа) batches items like compare_evaluate does", () => {
    const batches = generateTasks(MODE_TEST, ALL_CARDS, 5, { examplesCount: 4 });
    expect(batches).toHaveLength(5);
    batches.forEach((batch) => {
      expect(batch.items).toHaveLength(4);
      batch.items.forEach((item) => {
        const real = item.left === item.right ? "equal" : item.left > item.right ? "more" : "less";
        expect(item.question).toBe(real);
      });
    });
  });

  it("compare_test supports up to 10 examples per screen", () => {
    const batches = generateTasks(MODE_TEST, ALL_CARDS, 3, { examplesCount: 10 });
    expect(batches).toHaveLength(3);
    batches.forEach((batch) => expect(batch.items).toHaveLength(10));
  });

  describe("compare_apply", () => {
    it("'generate' tasks always leave a valid answer on the constrained side", () => {
      const tasks = generateTasks(MODE_APPLY, ALL_CARDS, 60, { level: 2, taskType: "generate" });
      expect(tasks).toHaveLength(60);
      tasks.forEach((t) => {
        expect(t.taskType).toBe("generate");
        expect(["more", "less"]).toContain(t.op);
        expect(t.value).toBeGreaterThanOrEqual(t.min);
        expect(t.value).toBeLessThanOrEqual(t.max);
        // a valid answer must exist strictly on the constrained side
        if (t.op === "more") expect(t.value).toBeLessThan(t.max);
        else expect(t.value).toBeGreaterThan(t.min);
        expect(t.promptText).toBe(t.op === "more" ? `Больше ${t.value}` : `Меньше ${t.value}`);
      });
    });

    it("'generate' tasks offer a closed set of number tiles, not free entry, with at least one right and one wrong tile", () => {
      const tasks = generateTasks(MODE_APPLY, ALL_CARDS, 60, { level: 2, taskType: "generate" });
      tasks.forEach((t) => {
        expect(t.options.length).toBeGreaterThanOrEqual(2);
        expect(t.options.length).toBeLessThanOrEqual(4);
        expect(new Set(t.options).size).toBe(t.options.length);
        t.options.forEach((n) => {
          expect(n).toBeGreaterThanOrEqual(t.min);
          expect(n).toBeLessThanOrEqual(t.max);
        });
        const fits = (n) => (t.op === "more" ? n > t.value : n < t.value);
        expect(t.options.some(fits)).toBe(true);
        expect(t.options.some((n) => !fits(n))).toBe(true);
        // the boundary value itself is always offered as a near-miss distractor
        expect(t.options).toContain(t.value);
      });
    });

    // Regression: the correct tile used to be picked via an ascending,
    // never-actually-shuffled array (shuffle()'s return value was discarded
    // instead of used), so .find(fits) deterministically returned the
    // smallest number satisfying the constraint every time — always `min`
    // for "less" tasks, which is 10 at level 4. Across many tasks the
    // correct tile must vary, not collapse onto a single number.
    it("'generate' correct tile varies across tasks instead of always being the range's smallest fit", () => {
      const tasks = generateTasks(MODE_APPLY, ALL_CARDS, 100, { level: 4, taskType: "generate" });
      const lessTasks = tasks.filter((t) => t.op === "less");
      expect(lessTasks.length).toBeGreaterThan(10);
      const correctValues = lessTasks.map((t) => t.options.find((n) => n < t.value));
      expect(new Set(correctValues).size).toBeGreaterThan(1);
      // and specifically: not every correct tile is level 4's min (10)
      expect(correctValues.some((n) => n !== 10)).toBe(true);
    });

    it("'order' tasks give 3 distinct numbers by default whose sorted order matches ascending value", () => {
      const tasks = generateTasks(MODE_APPLY, ALL_CARDS, 30, { level: 3, taskType: "order" });
      expect(tasks).toHaveLength(30);
      tasks.forEach((t) => {
        expect(t.taskType).toBe("order");
        expect(t.numbers).toHaveLength(3);
        expect(new Set(t.numbers).size).toBe(3);
        expect(t.sorted).toEqual([...t.numbers].sort((a, b) => a - b));
      });
    });

    it("'order' tasks honor a requested numbersCount between 3 and 5", () => {
      for (const numbersCount of [3, 4, 5]) {
        const tasks = generateTasks(MODE_APPLY, ALL_CARDS, 20, { level: 4, taskType: "order", numbersCount });
        tasks.forEach((t) => {
          expect(t.numbers).toHaveLength(numbersCount);
          expect(new Set(t.numbers).size).toBe(numbersCount);
          expect(t.sorted).toEqual([...t.numbers].sort((a, b) => a - b));
        });
      }
    });

    it("clamps an out-of-range numbersCount to [3, 5]", () => {
      const tooFew  = generateTasks(MODE_APPLY, ALL_CARDS, 5, { level: 4, taskType: "order", numbersCount: 1 });
      const tooMany = generateTasks(MODE_APPLY, ALL_CARDS, 5, { level: 4, taskType: "order", numbersCount: 9 });
      tooFew.forEach((t) => expect(t.numbers).toHaveLength(3));
      tooMany.forEach((t) => expect(t.numbers).toHaveLength(5));
    });

    it("'order' tasks default to ascending direction", () => {
      const tasks = generateTasks(MODE_APPLY, ALL_CARDS, 20, { level: 4, taskType: "order", numbersCount: 4 });
      tasks.forEach((t) => {
        expect(t.direction).toBe("asc");
        expect(t.sorted).toEqual([...t.numbers].sort((a, b) => a - b));
      });
    });

    it("'order' tasks reverse the slot order for orderDirection: 'desc'", () => {
      const tasks = generateTasks(MODE_APPLY, ALL_CARDS, 20, { level: 4, taskType: "order", numbersCount: 4, orderDirection: "desc" });
      tasks.forEach((t) => {
        expect(t.direction).toBe("desc");
        expect(t.sorted).toEqual([...t.numbers].sort((a, b) => b - a));
      });
    });

    it("'order' instruction no longer names a direction in words (the staircase shape shows it)", () => {
      const tasks = generateTasks(MODE_APPLY, ALL_CARDS, 3, { level: 3, taskType: "order" });
      tasks.forEach((t) => expect(t.instruction).toBe("Расставь числа по порядку"));
    });

    it("defaults to 'generate' when taskType is not specified", () => {
      const tasks = generateTasks(MODE_APPLY, ALL_CARDS, 5, {});
      tasks.forEach((t) => expect(t.taskType).toBe("generate"));
    });
  });

  describe("compare_real_life", () => {
    // Draws from the fixed scene bank in realLifeScenes.js (each scene an
    // illustration with an exact, baked-in left/right amount) instead of
    // generating arbitrary numbers — level and showEqual no longer apply
    // (ParamsScreen hides both controls for this mode; see isRealLifeMode).

    it("question always reflects the real left/right relation, and the verdict names the actual bigger character", () => {
      const tasks = generateTasks(MODE_REAL_LIFE, ALL_CARDS, 60);
      expect(tasks).toHaveLength(60);
      tasks.forEach((t) => {
        const real = t.left === t.right ? "equal" : t.left > t.right ? "more" : "less";
        expect(t.question).toBe(real);
        // A few scenes compare a continuous amount inside a container (water
        // in a glass, porridge in a bowl) instead of counting discrete
        // objects — those carry containerPhrase and thread it into both
        // strings ("У кого в стакане больше воды?"), everything else uses
        // the plain "У кого больше X?" object-counting phrasing.
        const where = t.containerPhrase ? `${t.containerPhrase} ` : "";
        expect(t.instruction).toBe(`У кого ${where}больше ${t.item}?`);
        if (t.question === "more") expect(t.verdictText).toBe(`У ${t.nameA} ${where}больше ${t.item}, чем у ${t.nameB}.`);
        if (t.question === "less") expect(t.verdictText).toBe(`У ${t.nameB} ${where}больше ${t.item}, чем у ${t.nameA}.`);
        if (t.question === "equal") expect(t.verdictText).toBe(`У ${t.nameA} и ${t.nameB} ${where}${t.item} поровну.`);
      });
    });

    it("every task carries the scene's image", () => {
      const tasks = generateTasks(MODE_REAL_LIFE, ALL_CARDS, 40);
      tasks.forEach((t) => expect(t.image).toMatch(/^data:image\/jpeg;base64,/));
    });

    it("includes at least one genuinely tied scene, so 'Поровну' is sometimes the correct answer", () => {
      // Round 1-2 scenes were all left !== right — "Поровну" was only ever a
      // distractor. Round 3 added one equal scene per item specifically so
      // the concept has real positive examples, not just a trap option.
      const bankSize = REAL_LIFE_SCENES.length;
      const tasks = generateTasks(MODE_REAL_LIFE, ALL_CARDS, bankSize);
      const tied = tasks.filter((t) => t.left === t.right);
      expect(tied.length).toBeGreaterThan(0);
      tied.forEach((t) => {
        expect(t.question).toBe("equal");
        expect(t.verdictText).toBe(`У ${t.nameA} и ${t.nameB} ${t.containerPhrase ? t.containerPhrase + " " : ""}${t.item} поровну.`);
      });
    });

    it("always carries allowEqual (the UI always shows all three answer buttons now)", () => {
      const tasks = generateTasks(MODE_REAL_LIFE, ALL_CARDS, 10);
      tasks.forEach((t) => expect(t.allowEqual).toBe(true));
    });

    it("carries a gender per name so the UI can illustrate the character, not just print the name", () => {
      const tasks = generateTasks(MODE_REAL_LIFE, ALL_CARDS, 40);
      tasks.forEach((t) => {
        expect(["boy", "girl"]).toContain(t.genderA);
        expect(["boy", "girl"]).toContain(t.genderB);
      });
    });

    it("cycles through the whole scene bank before any scene repeats", () => {
      const bankSize = REAL_LIFE_SCENES.length;
      const tasks = generateTasks(MODE_REAL_LIFE, ALL_CARDS, bankSize);
      const ids = tasks.map((t) => `${t.item}:${t.left}:${t.right}:${t.nameA}`);
      expect(new Set(ids).size).toBe(bankSize);
    });
  });
});

describe("getVerdict", () => {
  it("returns 'больше' verdict for question='more'", () => {
    expect(getVerdict({ left: 7, right: 4, question: "more" })).toBe("7 больше 4");
  });

  it("returns 'меньше' verdict for question='less'", () => {
    expect(getVerdict({ left: 7, right: 4, question: "less" })).toBe("4 меньше 7");
  });

  it("returns '=' verdict for question='equal'", () => {
    expect(getVerdict({ left: 5, right: 5, question: "equal" })).toBe("5 = 5");
  });

  it("returns '=' verdict when left === right regardless of question", () => {
    expect(getVerdict({ left: 3, right: 3, question: "more" })).toBe("3 = 3");
  });

  it("returns first-number verdict for compare_first_number tasks", () => {
    expect(getVerdict({ type: "compare_first_number", left: 7, right: 9, question: "less" })).toBe("7 меньше 9");
    expect(getVerdict({ type: "compare_first_number", left: 7, right: 5, question: "more" })).toBe("7 больше 5");
  });
});
