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

describe("generateTasks — mirror_draw / repeat_draw", () => {
  const MIXED_CARDS = [
    { id: "m1", conceptId: "m1", primary: true, label: "Дом",   taskKind: "mirror", sourcePaths: [] },
    { id: "m2", conceptId: "m2", primary: true, label: "Лодка", taskKind: "mirror", sourcePaths: [] },
    { id: "r1", conceptId: "r1", primary: true, label: "Ракета", taskKind: "repeat", sourcePaths: [] },
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

  it("each generator still returns conceptId, card, and label", () => {
    const tasks = generateTasks("repeat_draw", MIXED_CONCEPTS, MIXED_CARDS, {});
    expect(tasks[0]).toMatchObject({ conceptId: expect.any(String), card: expect.any(Object), label: expect.any(String) });
  });
});

describe("generateTasks — yes_no", () => {
  it("generates repsPerConcept tasks per concept", () => {
    const tasks = generateTasks("yes_no", ALL_CONCEPTS, CARDS, { repsPerConcept: 2 });
    expect(tasks).toHaveLength(ALL_CONCEPTS.length * 2);
  });

  it("defaults to 1 rep per concept", () => {
    const tasks = generateTasks("yes_no", ALL_CONCEPTS, CARDS, {});
    expect(tasks).toHaveLength(ALL_CONCEPTS.length);
  });

  it("each task has isLabelCorrect field", () => {
    const tasks = generateTasks("yes_no", ALL_CONCEPTS, CARDS, { repsPerConcept: 10 });
    const correct   = tasks.filter((t) => t.isLabelCorrect).length;
    const incorrect = tasks.filter((t) => !t.isLabelCorrect).length;
    expect(correct).toBeGreaterThan(0);
    expect(incorrect).toBeGreaterThan(0);
  });
});

describe("generateTasks — find_n", () => {
  it("generates repsPerConcept tasks per concept", () => {
    const tasks = generateTasks("find_n", ALL_CONCEPTS, CARDS, { optionCount: 4 });
    expect(tasks).toHaveLength(ALL_CONCEPTS.length);
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

describe("generateTasks — choose_word_by_picture", () => {
  it("generates one task per concept (1 rep default)", () => {
    const tasks = generateTasks("choose_word_by_picture", ALL_CONCEPTS, CARDS, {});
    expect(tasks).toHaveLength(ALL_CONCEPTS.length);
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
