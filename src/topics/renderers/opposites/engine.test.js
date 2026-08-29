import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  { id: "big_dog",    conceptId: "big_small", pole: "left",  objectId: "dog",   objectLabel: "собака", poleLabel: "большой",   nominativeLabel: "большая",   instructionLabel: "большую",    poleLabelNeutral: "большое",   poleLabelPlural: "большие",   image: "media/big_dog.webp" },
  { id: "small_dog",  conceptId: "big_small", pole: "right", objectId: "dog",   objectLabel: "собака", poleLabel: "маленький", nominativeLabel: "маленькая", instructionLabel: "маленькую",  poleLabelNeutral: "маленькое", poleLabelPlural: "маленькие", image: "media/small_dog.webp" },
  { id: "big_cat",    conceptId: "big_small", pole: "left",  objectId: "cat",   objectLabel: "кошка",  poleLabel: "большой",   nominativeLabel: "большая",   instructionLabel: "большую",    poleLabelNeutral: "большое",   poleLabelPlural: "большие",   image: "media/big_cat.webp" },
  { id: "small_cat",  conceptId: "big_small", pole: "right", objectId: "cat",   objectLabel: "кошка",  poleLabel: "маленький", nominativeLabel: "маленькая", instructionLabel: "маленькую",  poleLabelNeutral: "маленькое", poleLabelPlural: "маленькие", image: "media/small_cat.webp" },
  { id: "big_ball",   conceptId: "big_small", pole: "left",  objectId: "ball",  objectLabel: "мяч",    poleLabel: "большой",   nominativeLabel: "большой",   instructionLabel: "большой",    poleLabelNeutral: "большое",   poleLabelPlural: "большие",   image: "media/big_ball.webp" },
  { id: "small_ball", conceptId: "big_small", pole: "right", objectId: "ball",  objectLabel: "мяч",    poleLabel: "маленький", nominativeLabel: "маленький", instructionLabel: "маленький",  poleLabelNeutral: "маленькое", poleLabelPlural: "маленькие", image: "media/small_ball.webp" },
  { id: "wet_stone",  conceptId: "wet_dry",   pole: "left",  objectId: "stone", objectLabel: "камень", poleLabel: "мокрый",    nominativeLabel: "мокрый",    instructionLabel: "мокрый",     poleLabelNeutral: "мокрое",    poleLabelPlural: "мокрые",    image: "media/wet_stone.webp" },
  { id: "dry_stone",  conceptId: "wet_dry",   pole: "right", objectId: "stone", objectLabel: "камень", poleLabel: "сухой",     nominativeLabel: "сухой",     instructionLabel: "сухой",      poleLabelNeutral: "сухое",     poleLabelPlural: "сухие",     image: "media/dry_stone.webp" },
  { id: "wet_leaf",   conceptId: "wet_dry",   pole: "left",  objectId: "leaf",  objectLabel: "лист",   poleLabel: "мокрый",    nominativeLabel: "мокрый",    instructionLabel: "мокрый",     poleLabelNeutral: "мокрое",    poleLabelPlural: "мокрые",    image: "media/wet_leaf.webp" },
  { id: "dry_leaf",   conceptId: "wet_dry",   pole: "right", objectId: "leaf",  objectLabel: "лист",   poleLabel: "сухой",     nominativeLabel: "сухой",     instructionLabel: "сухой",      poleLabelNeutral: "сухое",     poleLabelPlural: "сухие",     image: "media/dry_leaf.webp" },
];

describe("generateTasks — find_opposite (image)", () => {
  it("returns one task per objectId", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2 });
    expect(tasks).toHaveLength(5);
  });

  it("each task has stimulusType=image", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, {});
    expect(tasks.every(t => t.stimulusType === "image")).toBe(true);
  });

  it("each task has stimulusCard and options array", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, {});
    for (const t of tasks) {
      expect(t.stimulusCard).toBeDefined();
      expect(Array.isArray(t.options)).toBe(true);
    }
  });

  it("exactly one option is the target", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 4 });
    for (const t of tasks) {
      expect(t.options.filter(o => o.isTarget)).toHaveLength(1);
    }
  });

  it("target card is the opposite pole of the same objectId", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2 });
    for (const t of tasks) {
      const target = t.options.find(o => o.isTarget);
      expect(target.card.objectId).toBe(t.stimulusCard.objectId);
      expect(target.card.pole).not.toBe(t.stimulusCard.pole);
    }
  });

  it("with distractorCount=2, options has 3 items", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2 });
    for (const t of tasks) {
      expect(t.options).toHaveLength(3);
    }
  });

  it("with distractorCount=4, options has at most 5 items", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 4 });
    for (const t of tasks) {
      expect(t.options.length).toBeLessThanOrEqual(5);
    }
  });

  it("sameConcept=false: distractors from different conceptIds", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2, sameConcept: false });
    for (const t of tasks) {
      for (const d of t.options.filter(o => !o.isTarget)) {
        expect(d.card.conceptId).not.toBe(t.stimulusCard.conceptId);
      }
    }
  });

  it("sameConcept=true: distractors from same conceptId, different objectId", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2, sameConcept: true });
    for (const t of tasks) {
      for (const d of t.options.filter(o => !o.isTarget)) {
        expect(d.card.conceptId).toBe(t.stimulusCard.conceptId);
        expect(d.card.objectId).not.toBe(t.stimulusCard.objectId);
      }
    }
  });
});

describe("generateTasks — find_opposite (text)", () => {
  it("returns one task per concept", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { stimulusType: "text" });
    expect(tasks).toHaveLength(2); // 2 concepts in CARDS
  });

  it("each task has stimulusType=text and stimulusLabel", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { stimulusType: "text" });
    for (const t of tasks) {
      expect(t.stimulusType).toBe("text");
      expect(typeof t.stimulusLabel).toBe("string");
      expect(t.stimulusLabel.length).toBeGreaterThan(0);
    }
  });

  it("exactly one option is the target", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { stimulusType: "text", distractorCount: 2 });
    for (const t of tasks) {
      expect(t.options.filter(o => o.isTarget)).toHaveLength(1);
    }
  });

  it("target card is the opposite pole to stimulusLabel's pole", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { stimulusType: "text", distractorCount: 2 });
    for (const t of tasks) {
      const target = t.options.find(o => o.isTarget);
      expect(target.card.conceptId).toBe(t.stimulusCard.conceptId);
      expect(target.card.pole).not.toBe(t.stimulusCard.pole);
    }
  });

  it("sameConcept=true: distractors are same pole as stimulus label", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { stimulusType: "text", distractorCount: 2, sameConcept: true });
    for (const t of tasks) {
      for (const d of t.options.filter(o => !o.isTarget)) {
        expect(d.card.conceptId).toBe(t.stimulusCard.conceptId);
        expect(d.card.pole).toBe(t.stimulusCard.pole);
      }
    }
  });

  it("sameConcept=false: distractors from different conceptIds", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { stimulusType: "text", distractorCount: 2, sameConcept: false });
    for (const t of tasks) {
      for (const d of t.options.filter(o => !o.isTarget)) {
        expect(d.card.conceptId).not.toBe(t.stimulusCard.conceptId);
      }
    }
  });
});

describe("generateTasks — choose_two, grammatical concord", () => {
  it("instructs using the target card's own instructionLabel, not a fixed neuter form", () => {
    const tasks = generateTasks({ type: "choose_two" }, CARDS, 10, {});
    const dogTask = tasks.find(t => t.options.some(o => o.card.objectId === "dog" && o.isTarget));
    expect(dogTask.instructionLabel).toBe("большую"); // big_dog, feminine "собака"
    const ballTask = tasks.find(t => t.options.some(o => o.card.objectId === "ball" && o.isTarget));
    expect(ballTask.instructionLabel).toBe("большой"); // big_ball, masculine "мяч"
    expect(dogTask.poleLabelNeutral).toBeUndefined();
  });
});

describe("generateTasks — find_all, plural instruction", () => {
  it("targetLabel is the plural form, not the singular neuter form", () => {
    const findAllCards = CARDS.filter(c => c.conceptId === "big_small");
    const tasks = generateTasks({ type: "find_all" }, findAllCards, 10, { gridSize: 4 });
    for (const t of tasks) {
      const expectedPlural = t.targetPole === "left" ? "большие" : "маленькие";
      expect(t.targetLabel).toBe(expectedPlural);
    }
  });
});

describe("generateTasks — choose_two, positive-pole-first sequencing", () => {
  it("repsPerPair=1 (default): always asks for the left (positive) pole", () => {
    const tasks = generateTasks({ type: "choose_two" }, CARDS, 10, {});
    for (const t of tasks) {
      expect(t.targetPole).toBe("left");
    }
  });

  it("repsPerPair=2: asks both poles for every object", () => {
    const tasks = generateTasks({ type: "choose_two" }, CARDS, 10, { repsPerPair: 2 });
    const polesByObject = {};
    for (const t of tasks) {
      const targetCard = t.options.find(o => o.isTarget).card;
      (polesByObject[targetCard.objectId] ??= new Set()).add(t.targetPole);
    }
    for (const poles of Object.values(polesByObject)) {
      expect([...poles].sort()).toEqual(["left", "right"]);
    }
  });
});
