import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";
import { deriveConcepts } from "@/shared/utils/topicUtils";

const CARDS = [
  { id: "t1", conceptId: "tshirt", primary: true,  label: "футболка", image: "media/t1.webp", tags: ["top"] },
  { id: "t2", conceptId: "tshirt", primary: false, image: "media/t2.webp" },
  { id: "j1", conceptId: "jacket", primary: true,  label: "куртка",   image: "media/j1.webp", tags: ["top"] },
  { id: "s1", conceptId: "skirt",  primary: true,  label: "юбка",     image: "media/s1.webp", tags: ["bottom"] },
  { id: "h1", conceptId: "hat",    primary: true,  label: "шляпа",    image: "media/h1.webp", tags: ["accessory"] },
];
const ALL_CONCEPTS = deriveConcepts(CARDS);

describe("generateTasks — intro", () => {
  it("generates one task per card variation (all variations shown)", () => {
    const tasks = generateTasks("intro", ALL_CONCEPTS, CARDS, {});
    expect(tasks).toHaveLength(5);
    expect(tasks.every((t) => t.type === "intro")).toBe(true);
  });

  it("each task has conceptId, card, and label", () => {
    const tasks = generateTasks("intro", ALL_CONCEPTS, CARDS, {});
    expect(tasks[0]).toMatchObject({ type: "intro", conceptId: expect.any(String), card: expect.any(Object), label: expect.any(String) });
  });
});

describe("generateTasks — symmetry_draw modes", () => {
  const MIXED_CARDS = [
    { id: "m1", conceptId: "m1", primary: true, label: "Дом",   taskKind: "mirror", sourcePaths: [] },
    { id: "m2", conceptId: "m2", primary: true, label: "Лодка", taskKind: "mirror", sourcePaths: [] },
    { id: "r1", conceptId: "r1", primary: true, label: "Ракета", taskKind: "repeat", sourcePaths: [] },
    { id: "d1", conceptId: "d1", primary: true, label: "Собака", taskKind: "dictation", start: { col: 0, row: 0 }, commands: [] },
    { id: "c1", conceptId: "c1", primary: true, label: "Ёлка", taskKind: "coordinate", start: { col: 0, row: 0 }, points: [] },
    { id: "n1", conceptId: "n1", primary: true, label: "Навигатор", taskKind: "navigator" },
    { id: "p1", conceptId: "p1", primary: true, label: "Координаты", taskKind: "coordinates", columns: 7, rows: 7 },
  ];
  const MIXED_CONCEPTS = deriveConcepts(MIXED_CARDS);

  it("mirror_draw only includes taskKind:mirror cards", () => {
    const tasks = generateTasks("mirror_draw", MIXED_CONCEPTS, MIXED_CARDS, {});
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.type === "mirror_draw")).toBe(true);
    expect(tasks.every((t) => t.card.taskKind === "mirror")).toBe(true);
  });

  it("repeat_draw only includes taskKind:repeat cards", () => {
    const tasks = generateTasks("repeat_draw", MIXED_CONCEPTS, MIXED_CARDS, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ type: "repeat_draw", conceptId: "r1" });
    expect(tasks[0].card.taskKind).toBe("repeat");
  });

  it("graphic_dictation defaults to taskKind:dictation cards", () => {
    const tasks = generateTasks("graphic_dictation", MIXED_CONCEPTS, MIXED_CARDS, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ type: "graphic_dictation", conceptId: "d1" });
    expect(tasks[0].card.taskKind).toBe("dictation");
  });

  it("graphic_dictation uses coordinate cards when the coordinate option is chosen", () => {
    const tasks = generateTasks("graphic_dictation", MIXED_CONCEPTS, MIXED_CARDS, { dictationCommand: "coordinates" });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ type: "graphic_dictation", conceptId: "c1" });
    expect(tasks[0].card.taskKind).toBe("coordinate");
  });

  it("navigator starts with a twenty-step drill of four basic directions", () => {
    const tasks = generateTasks("navigator", MIXED_CONCEPTS, MIXED_CARDS, {});
    expect(tasks).toHaveLength(20);
    expect(tasks.every((task) => task.type === "navigator" && task.card.taskKind === "navigator")).toBe(true);
    expect(new Set(tasks.map((task) => task.direction))).toEqual(new Set(["up", "down", "left", "right"]));
    expect(tasks.every((task) => Number.isInteger(task.cells) && task.cells >= 1 && task.cells <= 3)).toBe(true);
    expect(new Set(tasks.map((task) => task.cells))).toEqual(new Set([1, 2, 3]));
  });

  it("navigator adds diagonal directions when the full set is chosen", () => {
    const tasks = generateTasks("navigator", MIXED_CONCEPTS, MIXED_CARDS, { navigatorDirections: "all" });
    expect(new Set(tasks.map((task) => task.direction))).toEqual(new Set([
      "up", "down", "left", "right", "up_left", "up_right", "down_left", "down_right",
    ]));
  });

  it("coordinates creates twenty distinct points on an 8×8 node grid", () => {
    const tasks = generateTasks("coordinates", MIXED_CONCEPTS, MIXED_CARDS, {});
    expect(tasks).toHaveLength(20);
    expect(tasks.every((task) => task.type === "coordinates" && task.card.taskKind === "coordinates")).toBe(true);
    expect(tasks.every((task) => task.target.col >= 0 && task.target.col <= 7 && task.target.row >= 0 && task.target.row <= 7)).toBe(true);
    expect(new Set(tasks.map((task) => `${task.target.col}:${task.target.row}`)).size).toBe(20);
  });

  it("each generator still returns conceptId, card, and label", () => {
    const tasks = generateTasks("repeat_draw", MIXED_CONCEPTS, MIXED_CARDS, {});
    expect(tasks[0]).toMatchObject({ conceptId: expect.any(String), card: expect.any(Object), label: expect.any(String) });
  });
});

describe("generateTasks — situation_emotion", () => {
  const EMOTION_CARDS = [
    { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
    { id: "joy_2", conceptId: "joy", primary: false, image: "media/joy_2.webp" },
    { id: "joy_situation_1", conceptId: "joy", cardType: "situation", label: "Друг подарил тебе подарок." },
    { id: "sad_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sad_1.webp" },
    { id: "sad_situation_1", conceptId: "sadness", cardType: "situation", label: "Твой друг уехал." },
    { id: "anger_1", conceptId: "anger", primary: true, label: "злость", image: "media/anger_1.webp" },
  ];
  const EMOTION_CONCEPTS = deriveConcepts(EMOTION_CARDS);

  it("produces one task per situation card, with the situation text as targetLabel", () => {
    const tasks = generateTasks("situation_emotion", EMOTION_CONCEPTS, EMOTION_CARDS, {});
    expect(tasks).toHaveLength(2);
    const joyTask = tasks.find((t) => t.targetConceptId === "joy");
    expect(joyTask).toMatchObject({ type: "situation_emotion", targetLabel: "Друг подарил тебе подарок." });
  });

  it("options include the correct emotion concept and never a situation card", () => {
    const tasks = generateTasks("situation_emotion", EMOTION_CONCEPTS, EMOTION_CARDS, { optionCount: 3 });
    for (const task of tasks) {
      expect(task.options.some((o) => o.conceptId === task.targetConceptId && o.isTarget)).toBe(true);
      expect(task.options.every((o) => o.card.cardType !== "situation")).toBe(true);
    }
  });

  it("situation cards never appear as a picture option or a standalone task in the other modes", () => {
    const introTasks = generateTasks("intro", EMOTION_CONCEPTS, EMOTION_CARDS, {});
    expect(introTasks.every((t) => t.card.cardType !== "situation")).toBe(true);
    expect(introTasks).toHaveLength(4); // joy_1, joy_2, sad_1, anger_1 - situation cards excluded

    const findNTasks = generateTasks("find_n", EMOTION_CONCEPTS, EMOTION_CARDS, { optionCount: 3 });
    for (const task of findNTasks) {
      expect(task.options.every((o) => o.card.cardType !== "situation")).toBe(true);
    }
  });

  it("a topic with no cardType field anywhere is completely unaffected (regression guard)", () => {
    const PLAIN_CARDS = [
      { id: "t1", conceptId: "tshirt", primary: true, label: "футболка", image: "media/t1.webp" },
      { id: "j1", conceptId: "jacket", primary: true, label: "куртка", image: "media/j1.webp" },
    ];
    const PLAIN_CONCEPTS = deriveConcepts(PLAIN_CARDS);
    const before = generateTasks("intro", PLAIN_CONCEPTS, PLAIN_CARDS, {});
    expect(before).toHaveLength(2);
    expect(before.map((t) => t.card.id).sort()).toEqual(["j1", "t1"]);
  });
});

describe("generateTasks — situation_intro", () => {
  const EMOTION_CARDS = [
    { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
    { id: "joy_situation_1", conceptId: "joy", cardType: "situation", label: "Друг подарил тебе игрушку.", sceneImage: "media/situation_joy_1.webp" },
    { id: "sad_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sad_1.webp" },
    { id: "sad_situation_1", conceptId: "sadness", cardType: "situation", label: "Питомец заболел.", sceneImage: "media/situation_sad_1.webp" },
  ];
  const EMOTION_CONCEPTS = deriveConcepts(EMOTION_CARDS);

  it("produces one no-evaluation task per situation card", () => {
    const tasks = generateTasks("situation_intro", EMOTION_CONCEPTS, EMOTION_CARDS, {});
    expect(tasks).toHaveLength(2);
    const joyTask = tasks.find((t) => t.conceptId === "joy");
    expect(joyTask).toMatchObject({
      type: "situation_intro",
      situationText: "Друг подарил тебе игрушку.",
      label: "радость",
    });
    expect(joyTask.card.cardType).not.toBe("situation");
  });
});

describe("situation use levels", () => {
  const CARDS = [
    { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
    { id: "joy_2", conceptId: "joy", primary: false, image: "media/joy_2.webp" },
    { id: "sad_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sad_1.webp" },
    { id: "calm_1", conceptId: "calm", primary: true, label: "спокойствие", image: "media/calm_1.webp" },
    { id: "joy_auto", conceptId: "joy", cardType: "situation", situationUse: "auto", label: "Мальчик получил игрушку.", sceneImage: "media/situation_joy_1.webp", revealCardId: "joy_2" },
    { id: "sad_auto", conceptId: "sadness", cardType: "situation", situationUse: "auto", label: "Лопнул шарик." },
    { id: "calm_discussion", conceptId: "calm", cardType: "situation", situationUse: "discussion", label: "Девочка слушает музыку." },
    { id: "calm_deferred", conceptId: "calm", cardType: "situation", situationUse: "deferred", label: "Отложенная ситуация." },
  ];
  const CONCEPTS = deriveConcepts(CARDS);

  it("uses only auto situations and their concepts in evaluated situation modes", () => {
    const forward = generateTasks("situation_emotion", CONCEPTS, CARDS, { optionCount: 4 });
    const reverse = generateTasks("emotion_situation", CONCEPTS, CARDS, { optionCount: 4 });

    expect(forward).toHaveLength(2);
    expect(reverse).toHaveLength(2);
    expect(forward.find((task) => task.targetConceptId === "joy")?.sceneImage).toBe("media/situation_joy_1.webp");
    expect(forward.every((task) => task.options.every((option) => option.conceptId !== "calm"))).toBe(true);
    expect(reverse.every((task) => task.options.every((option) => option.conceptId !== "calm"))).toBe(true);
  });

  it("keeps discussion and deferred situations in the no-evaluation introduction", () => {
    const tasks = generateTasks("situation_intro", CONCEPTS, CARDS, {});
    expect(tasks).toHaveLength(4);
    expect(tasks.some((task) => task.situationText === "Девочка слушает музыку.")).toBe(true);
    expect(tasks.some((task) => task.situationText === "Отложенная ситуация.")).toBe(true);
  });

  it("uses a situation's explicitly assigned portrait instead of a random variation", () => {
    const tasks = generateTasks("situation_intro", CONCEPTS, CARDS, {});
    expect(tasks.find((task) => task.situationText === "Мальчик получил игрушку.")?.card.id).toBe("joy_2");
  });

  it("uses a dedicated same-child portrait when the situation provides one", () => {
    const cards = CARDS.map((card) => card.id === "joy_auto"
      ? { ...card, revealImage: "media/portrait_situation_joy_1_v2.webp" }
      : card);
    const tasks = generateTasks("situation_intro", deriveConcepts(cards), cards, {});
    expect(tasks.find((task) => task.situationText === "Мальчик получил игрушку.")?.card).toMatchObject({
      id: "joy_auto_reveal",
      image: "media/portrait_situation_joy_1_v2.webp",
      conceptId: "joy",
    });
  });

  it("honours an explicit per-session situation limit", () => {
    expect(generateTasks("situation_intro", CONCEPTS, CARDS, { taskCount: 2 })).toHaveLength(2);
    expect(generateTasks("situation_emotion", CONCEPTS, CARDS, { taskCount: 1 })).toHaveLength(1);
    expect(generateTasks("emotion_situation", CONCEPTS, CARDS, { taskCount: 1 })).toHaveLength(1);
  });
});

describe("generateTasks — emotion_situation", () => {
  const EMOTION_CARDS = [
    { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
    { id: "joy_situation_1", conceptId: "joy", cardType: "situation", label: "Друг подарил тебе игрушку.", sceneImage: "media/situation_joy_1.webp" },
    { id: "sad_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sad_1.webp" },
    { id: "sad_situation_1", conceptId: "sadness", cardType: "situation", label: "Питомец заболел.", sceneImage: "media/situation_sad_1.webp" },
    { id: "anger_1", conceptId: "anger", primary: true, label: "злость", image: "media/anger_1.webp" },
    { id: "anger_situation_1", conceptId: "anger", cardType: "situation", label: "Брат сломал твою игрушку.", sceneImage: "media/situation_anger_1.webp" },
  ];
  const EMOTION_CONCEPTS = deriveConcepts(EMOTION_CARDS);

  it("produces one task per situation card, stimulus card belongs to the target emotion", () => {
    const tasks = generateTasks("emotion_situation", EMOTION_CONCEPTS, EMOTION_CARDS, { optionCount: 2 });
    expect(tasks).toHaveLength(3);
    const joyTask = tasks.find((t) => t.conceptId === "joy");
    expect(joyTask.card.conceptId).toBe("joy");
    expect(joyTask.card.cardType).not.toBe("situation");
  });

  it("options are graphical situation cards, exactly one matching the source scene", () => {
    const tasks = generateTasks("emotion_situation", EMOTION_CONCEPTS, EMOTION_CARDS, { optionCount: 2 });
    const joyTask = tasks.find((t) => t.conceptId === "joy");
    const targets = joyTask.options.filter((o) => o.isTarget);
    expect(targets).toHaveLength(1);
    expect(targets[0].label).toBe("Друг подарил тебе игрушку.");
    expect(targets[0].sceneImage).toBe("media/situation_joy_1.webp");
    expect(joyTask.options.every((option) => option.sceneImage?.startsWith("media/situation_"))).toBe(true);
    expect(joyTask.options.every((o) => !["радость", "грусть", "злость"].includes(o.label))).toBe(true);
  });
});

describe("generateTasks — emotion_control", () => {
  const CARDS = [
    { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
    { id: "sad_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sad_1.webp" },
    { id: "anger_1", conceptId: "anger", primary: true, label: "злость", image: "media/anger_1.webp" },
  ];
  const CONCEPTS = deriveConcepts(CARDS);

  it("keeps all topic labels as answer options even for a narrowed target session", () => {
    const [joyConcept] = CONCEPTS.filter((concept) => concept.conceptId === "joy");
    const tasks = generateTasks("emotion_control", [joyConcept], CARDS, {});

    expect(tasks).toHaveLength(1);
    expect(tasks[0].options.map((option) => option.label).sort()).toEqual(["грусть", "злость", "радость"]);
    expect(tasks[0].options.filter((option) => option.isTarget)).toEqual([
      expect.objectContaining({ conceptId: "joy", label: "радость" }),
    ]);
  });

  it("narrows the answer bank to optionCount when set, target always included", () => {
    const tasks = generateTasks("emotion_control", CONCEPTS, CARDS, { optionCount: 2 });

    expect(tasks).toHaveLength(3);
    for (const task of tasks) {
      expect(task.options).toHaveLength(2);
      const targets = task.options.filter((o) => o.isTarget);
      expect(targets).toHaveLength(1);
      expect(targets[0].conceptId).toBe(task.conceptId);
    }
  });
});

describe("generateTasks — yes_no", () => {
  it("generates repsPerConcept tasks per photo variation", () => {
    const tasks = generateTasks("yes_no", ALL_CONCEPTS, CARDS, { repsPerConcept: 2 });
    expect(tasks).toHaveLength(CARDS.length * 2);
  });

  it("defaults to 1 rep per photo variation", () => {
    const tasks = generateTasks("yes_no", ALL_CONCEPTS, CARDS, {});
    expect(tasks).toHaveLength(CARDS.length);
  });

  it("covers every variation of a multi-photo concept, not just one", () => {
    const tasks = generateTasks("yes_no", ALL_CONCEPTS, CARDS, {});
    const tshirtCardIds = tasks.filter((t) => t.conceptId === "tshirt").map((t) => t.card.id).sort();
    expect(tshirtCardIds).toEqual(["t1", "t2"]);
  });

  it("each task has isLabelCorrect field", () => {
    const tasks = generateTasks("yes_no", ALL_CONCEPTS, CARDS, { repsPerConcept: 10 });
    const correct   = tasks.filter((t) => t.isLabelCorrect).length;
    const incorrect = tasks.filter((t) => !t.isLabelCorrect).length;
    expect(correct).toBeGreaterThan(0);
    expect(incorrect).toBeGreaterThan(0);
  });

  it("uses a card's accusative field instead of label when present", () => {
    const cards = [
      { id: "b1", conceptId: "boredom", primary: true, label: "скука", accusative: "скуку", image: "b1.webp" },
      { id: "f1", conceptId: "fear",    primary: true, label: "страх", image: "f1.webp" },
    ];
    const concepts = deriveConcepts(cards);
    const tasks = generateTasks("yes_no", concepts, cards, { repsPerConcept: 20 });
    const boredomTasks = tasks.filter((t) => t.correctLabel === "скуку");
    expect(boredomTasks.length).toBeGreaterThan(0);
    expect(tasks.some((t) => t.correctLabel === "скука")).toBe(false);
    expect(tasks.some((t) => t.displayLabel === "скука")).toBe(false);
  });
});

describe("generateTasks — find_n", () => {
  it("generates one task per photo variation (not one random pick per concept)", () => {
    const tasks = generateTasks("find_n", ALL_CONCEPTS, CARDS, { optionCount: 4 });
    expect(tasks).toHaveLength(CARDS.length);
  });

  it("covers every variation of a concept with multiple photos, not just one", () => {
    const cards = [
      { id: "joy_1", conceptId: "joy", primary: true,  label: "радость", image: "joy_1.webp" },
      { id: "joy_2", conceptId: "joy", primary: false, image: "joy_2.webp" },
      { id: "joy_3", conceptId: "joy", primary: false, image: "joy_3.webp" },
      { id: "sad_1", conceptId: "sadness", primary: true, label: "грусть", image: "sad_1.webp" },
      { id: "sad_2", conceptId: "sadness", primary: false, image: "sad_2.webp" },
      { id: "sad_3", conceptId: "sadness", primary: false, image: "sad_3.webp" },
    ];
    const concepts = deriveConcepts(cards);
    const tasks = generateTasks("find_n", concepts, cards, { optionCount: 4 });
    const targetIds = tasks.map((t) => t.options.find((o) => o.isTarget).card.id).sort();
    expect(targetIds).toEqual(["joy_1", "joy_2", "joy_3", "sad_1", "sad_2", "sad_3"]);
  });

  it("repeats the full set of variations repsPerConcept times", () => {
    const tasks = generateTasks("find_n", ALL_CONCEPTS, CARDS, { optionCount: 4, repsPerConcept: 2 });
    expect(tasks).toHaveLength(CARDS.length * 2);
  });

  it("each task has optionCount options", () => {
    const tasks = generateTasks("find_n", ALL_CONCEPTS, CARDS, { optionCount: 4 });
    expect(tasks[0].options).toHaveLength(4);
  });

  it("exactly one option is the target", () => {
    const tasks = generateTasks("find_n", ALL_CONCEPTS, CARDS, { optionCount: 4 });
    for (const t of tasks) {
      expect(t.options.filter((o) => o.isTarget)).toHaveLength(1);
    }
  });

  it("target option conceptId matches targetConceptId", () => {
    const tasks = generateTasks("find_n", ALL_CONCEPTS, CARDS, { optionCount: 4 });
    for (const t of tasks) {
      const target = t.options.find((o) => o.isTarget);
      expect(target.conceptId).toBe(t.targetConceptId);
    }
  });

  it("clamps optionCount to available concepts", () => {
    const twoConceptCards = CARDS.filter((c) => ["tshirt", "jacket"].includes(c.conceptId));
    const twoConcepts = deriveConcepts(twoConceptCards);
    const tasks = generateTasks("find_n", twoConcepts, twoConceptCards, { optionCount: 6 });
    expect(tasks[0].options.length).toBeLessThanOrEqual(2);
  });
});

describe("generateTasks — find_n respects semantic.age when present", () => {
  const CARDS = [
    { id: "boy_1",   conceptId: "boy",   primary: true, label: "мальчик", image: "media/boy_1.webp",   semantic: { age: "child", category: "boy" } },
    { id: "girl_1",  conceptId: "girl",  primary: true, label: "девочка", image: "media/girl_1.webp",  semantic: { age: "child", category: "girl" } },
    { id: "man_1",   conceptId: "man",   primary: true, label: "мужчина", image: "media/man_1.webp",   semantic: { age: "adult", category: "man" } },
    { id: "woman_1", conceptId: "woman", primary: true, label: "женщина", image: "media/woman_1.webp", semantic: { age: "adult", category: "woman" } },
  ];
  const CONCEPTS = deriveConcepts(CARDS);

  it("2-option find_n for a child concept always distracts with the other child, never an adult", () => {
    for (let i = 0; i < 20; i++) {
      const tasks = generateTasks("find_n", CONCEPTS, CARDS, { optionCount: 2 });
      const boyTask = tasks.find((t) => t.targetConceptId === "boy");
      const distractor = boyTask.options.find((o) => !o.isTarget);
      expect(distractor.conceptId).toBe("girl");
    }
  });

  it("a topic without semantic.age is unaffected", () => {
    const plainCards = [
      { id: "t1", conceptId: "tshirt", primary: true, label: "футболка", image: "media/t1.webp" },
      { id: "j1", conceptId: "jacket", primary: true, label: "куртка", image: "media/j1.webp" },
      { id: "s1", conceptId: "skirt", primary: true, label: "юбка", image: "media/s1.webp" },
    ];
    const tasks = generateTasks("find_n", deriveConcepts(plainCards), plainCards, { optionCount: 2 });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.options.length === 2)).toBe(true);
  });
});

describe("generateTasks — choose_word_by_picture", () => {
  it("generates one task per photo variation (1 rep default)", () => {
    const tasks = generateTasks("choose_word_by_picture", ALL_CONCEPTS, CARDS, {});
    expect(tasks).toHaveLength(CARDS.length);
  });

  it("covers every variation of a multi-photo concept, not just one", () => {
    const tasks = generateTasks("choose_word_by_picture", ALL_CONCEPTS, CARDS, {});
    const tshirtCardIds = tasks.filter((t) => t.conceptId === "tshirt").map((t) => t.card.id).sort();
    expect(tshirtCardIds).toEqual(["t1", "t2"]);
  });

  it("each task has 4 label options by default", () => {
    const tasks = generateTasks("choose_word_by_picture", ALL_CONCEPTS, CARDS, {});
    expect(tasks[0].options).toHaveLength(4);
  });

  it("exactly one option is the target", () => {
    const tasks = generateTasks("choose_word_by_picture", ALL_CONCEPTS, CARDS, {});
    for (const t of tasks) {
      expect(t.options.filter((o) => o.isTarget)).toHaveLength(1);
    }
  });
});

describe("generateTasks — choose_all", () => {
  it("generates one task per concept when all its variations fit in one grid", () => {
    const tasks = generateTasks("choose_all", ALL_CONCEPTS, CARDS, { optionCount: 6 });
    expect(tasks).toHaveLength(ALL_CONCEPTS.length);
  });

  it("splits a concept's variations across multiple rounds instead of dropping the ones past the first grid", () => {
    const cards = [
      { id: "j1", conceptId: "joy", primary: true,  label: "радость", image: "j1.webp" },
      { id: "j2", conceptId: "joy", primary: false, image: "j2.webp" },
      { id: "j3", conceptId: "joy", primary: false, image: "j3.webp" },
      { id: "s1", conceptId: "sadness", primary: true, label: "грусть", image: "s1.webp" },
    ];
    const concepts = deriveConcepts(cards);
    // optionCount 4 -> maxTargets 2, joy has 3 variations -> 2 rounds (2 + 1)
    const tasks = generateTasks("choose_all", concepts, cards, { optionCount: 4 });
    const joyTasks = tasks.filter((t) => t.conceptId === "joy");
    expect(joyTasks.length).toBeGreaterThan(1);
    const coveredIds = joyTasks.flatMap((t) => t.targetCardIds).sort();
    expect(coveredIds).toEqual(["j1", "j2", "j3"]);
  });
});

describe("generateTasks — people, names, and attributes", () => {
  const PEOPLE_CARDS = [
    { id: "boy_peter", conceptId: "boy", primary: true, label: "мальчик", image: "boy_peter.webp", person: { id: "peter", name: "Петя" }, semantic: { age: "child", category: "boy" } },
    { id: "girl_olga", conceptId: "girl", primary: true, label: "девочка", image: "girl_olga.webp", person: { id: "olga", name: "Оля" }, semantic: { age: "child", category: "girl" } },
    { id: "man_igor", conceptId: "man", primary: true, label: "мужчина", image: "man_igor.webp", person: { id: "igor", name: "Игорь" }, semantic: { age: "adult", category: "man" } },
    { id: "woman_anna", conceptId: "woman", primary: true, label: "женщина", image: "woman_anna.webp", person: { id: "anna", name: "Анна" }, semantic: { age: "adult", category: "woman" } },
  ];
  const PEOPLE_CONCEPTS = deriveConcepts(PEOPLE_CARDS);

  it("asks for every named person and keeps one photo target", () => {
    const tasks = generateTasks("find_person_by_name", PEOPLE_CONCEPTS, PEOPLE_CARDS, { optionCount: 4 });
    expect(tasks).toHaveLength(PEOPLE_CARDS.length);
    expect(tasks.every((task) => task.type === "find_person_by_name")).toBe(true);

    for (const task of tasks) {
      const target = task.options.find((option) => option.isTarget);
      expect(task.options).toHaveLength(4);
      expect(task.targetLabel).toBe(`Где ${target.card.person.name}?`);
      expect(task.promptSpeech).toBe(task.targetLabel);
    }
  });

  it("offers names for the shown person", () => {
    const tasks = generateTasks("choose_name", PEOPLE_CONCEPTS, PEOPLE_CARDS, { optionCount: 4 });
    expect(tasks).toHaveLength(PEOPLE_CARDS.length);

    for (const task of tasks) {
      const target = task.options.find((option) => option.isTarget);
      expect(target.label).toBe(task.card.person.name);
      expect(task.options).toHaveLength(4);
    }
  });

  it("sorts the same people by age with exactly two groups", () => {
    const tasks = generateTasks("sort_by_attribute", PEOPLE_CONCEPTS, PEOPLE_CARDS, { sortBy: "age" });
    expect(tasks).toHaveLength(PEOPLE_CARDS.length);
    expect(tasks[0].groups).toEqual([
      { value: "child", label: "Ребёнок" },
      { value: "adult", label: "Взрослый" },
    ]);
    expect(tasks.map((task) => task.targetValue).sort()).toEqual(["adult", "adult", "child", "child"]);
  });

  it("sorts the same people by the four learned category words", () => {
    const tasks = generateTasks("sort_by_attribute", PEOPLE_CONCEPTS, PEOPLE_CARDS, { sortBy: "category" });
    expect(tasks[0].groups.map((group) => group.value)).toEqual(["boy", "girl", "man", "woman"]);
    expect(tasks.map((task) => task.targetValue).sort()).toEqual(["boy", "girl", "man", "woman"]);
  });
});

describe("generateTasks — person_intro", () => {
  const CARDS = [
    { id: "boy_peter", conceptId: "boy", primary: true, label: "мальчик", image: "media/boy_peter.webp",
      speech: "Это мальчик.", personSpeech: "Это Петя.", person: { id: "peter", name: "Петя" } },
    { id: "boy_ilya", conceptId: "boy", image: "media/boy_ilya.webp",
      speech: "Это мальчик.", personSpeech: "Это Илья.", person: { id: "ilya", name: "Илья" } },
  ];
  const CONCEPTS = deriveConcepts(CARDS);

  it("uses personSpeech as the card's speech and the person's name as the label", () => {
    const tasks = generateTasks("person_intro", CONCEPTS, CARDS, {});
    expect(tasks).toHaveLength(2);
    const peterTask = tasks.find((t) => t.card.id === "boy_peter");
    expect(peterTask).toMatchObject({ type: "person_intro", conceptId: "boy", label: "Петя" });
    expect(peterTask.card.speech).toBe("Это Петя.");
  });

  it("falls back to the card's own speech when a card has no person (regression guard)", () => {
    const noPerson = [{ id: "x1", conceptId: "x", primary: true, label: "x", image: "media/x1.webp", speech: "Это x." }];
    const tasks = generateTasks("person_intro", deriveConcepts(noPerson), noPerson, {});
    expect(tasks[0].card.speech).toBe("Это x.");
    expect(tasks[0].label).toBe("x");
  });

  it("swaps card.audio for card.personAudio, never plays the category recording under a name label", () => {
    const withAudio = [{
      id: "boy_peter", conceptId: "boy", primary: true, label: "мальчик", image: "media/boy_peter.webp",
      speech: "Это мальчик.", personSpeech: "Это Петя.", person: { id: "peter", name: "Петя" },
      audio: { ru: "audio/boy_peter.mp3" }, personAudio: { ru: "audio/boy_peter_person.mp3" },
    }];
    const tasks = generateTasks("person_intro", deriveConcepts(withAudio), withAudio, {});
    expect(tasks[0].card.audio).toEqual({ ru: "audio/boy_peter_person.mp3" });
  });

  it("clears card.audio when no personAudio recording exists yet (falls back to browser TTS of personSpeech)", () => {
    const noPersonAudio = [{
      id: "boy_peter", conceptId: "boy", primary: true, label: "мальчик", image: "media/boy_peter.webp",
      speech: "Это мальчик.", personSpeech: "Это Петя.", person: { id: "peter", name: "Петя" },
      audio: { ru: "audio/boy_peter.mp3" },
    }];
    const tasks = generateTasks("person_intro", deriveConcepts(noPersonAudio), noPersonAudio, {});
    expect(tasks[0].card.audio).toBeUndefined();
  });
});

describe("generateTasks — probeOnly cards", () => {
  const CARDS = [
    { id: "boy_1",   conceptId: "boy",  primary: true, label: "мальчик", image: "media/boy_1.webp" },
    { id: "boy_2",   conceptId: "boy",  image: "media/boy_2.webp" },
    { id: "boy_probe", conceptId: "boy", image: "media/boy_probe.webp", probeOnly: true },
    { id: "girl_1",  conceptId: "girl", primary: true, label: "девочка", image: "media/girl_1.webp" },
    { id: "girl_probe", conceptId: "girl", image: "media/girl_probe.webp", probeOnly: true },
  ];
  const CONCEPTS = deriveConcepts(CARDS);

  it("probeOnly cards never appear in intro or find_n (regular teaching modes)", () => {
    const introTasks = generateTasks("intro", CONCEPTS, CARDS, {});
    expect(introTasks.every((t) => t.card.id !== "boy_probe" && t.card.id !== "girl_probe")).toBe(true);
    expect(introTasks).toHaveLength(3); // boy_1, boy_2, girl_1 - probes excluded

    const findNTasks = generateTasks("find_n", CONCEPTS, CARDS, { optionCount: 2 });
    for (const task of findNTasks) {
      expect(task.options.every((o) => o.card.id !== "boy_probe" && o.card.id !== "girl_probe")).toBe(true);
    }
  });

  it("generalisation_probe uses only probeOnly cards", () => {
    const tasks = generateTasks("generalisation_probe", CONCEPTS, CARDS, { optionCount: 2 });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => ["boy_probe", "girl_probe"].includes(
      t.options.find((o) => o.isTarget).card.id
    ))).toBe(true);
  });

  it("a topic with no probeOnly field anywhere is unaffected (regression guard)", () => {
    const PLAIN_CARDS = [
      { id: "t1", conceptId: "tshirt", primary: true, label: "футболка", image: "media/t1.webp" },
      { id: "j1", conceptId: "jacket", primary: true, label: "куртка", image: "media/j1.webp" },
    ];
    const tasks = generateTasks("intro", deriveConcepts(PLAIN_CARDS), PLAIN_CARDS, {});
    expect(tasks).toHaveLength(2);
  });
});
