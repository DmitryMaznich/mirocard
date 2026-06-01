import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  { id: "big_dog",    conceptId: "big_small", pole: "left",  objectId: "dog",   objectLabel: "собака", nominativeLabel: "большая",   image: "media/big_dog.webp" },
  { id: "small_dog",  conceptId: "big_small", pole: "right", objectId: "dog",   objectLabel: "собака", nominativeLabel: "маленькая", image: "media/small_dog.webp" },
  { id: "big_cat",    conceptId: "big_small", pole: "left",  objectId: "cat",   objectLabel: "кошка",  nominativeLabel: "большая",   image: "media/big_cat.webp" },
  { id: "small_cat",  conceptId: "big_small", pole: "right", objectId: "cat",   objectLabel: "кошка",  nominativeLabel: "маленькая", image: "media/small_cat.webp" },
  { id: "big_ball",   conceptId: "big_small", pole: "left",  objectId: "ball",  objectLabel: "мяч",    nominativeLabel: "большой",   image: "media/big_ball.webp" },
  { id: "small_ball", conceptId: "big_small", pole: "right", objectId: "ball",  objectLabel: "мяч",    nominativeLabel: "маленький", image: "media/small_ball.webp" },
  { id: "wet_stone",  conceptId: "wet_dry",   pole: "left",  objectId: "stone", objectLabel: "камень", nominativeLabel: "мокрый",    image: "media/wet_stone.webp" },
  { id: "dry_stone",  conceptId: "wet_dry",   pole: "right", objectId: "stone", objectLabel: "камень", nominativeLabel: "сухой",     image: "media/dry_stone.webp" },
  { id: "wet_leaf",   conceptId: "wet_dry",   pole: "left",  objectId: "leaf",  objectLabel: "лист",   nominativeLabel: "мокрый",    image: "media/wet_leaf.webp" },
  { id: "dry_leaf",   conceptId: "wet_dry",   pole: "right", objectId: "leaf",  objectLabel: "лист",   nominativeLabel: "сухой",     image: "media/dry_leaf.webp" },
];

describe("generateTasks — find_opposite", () => {
  it("returns one task per objectId", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2 });
    expect(tasks).toHaveLength(5);
  });

  it("each task has type find_opposite", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, {});
    expect(tasks.every(t => t.type === "find_opposite")).toBe(true);
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

  it("with distractorCount=2, options has 3 items (1 correct + 2 distractors)", () => {
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

  it("sameConcept=false: distractors come from different conceptIds", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2, sameConcept: false });
    for (const t of tasks) {
      const distractors = t.options.filter(o => !o.isTarget);
      for (const d of distractors) {
        expect(d.card.conceptId).not.toBe(t.stimulusCard.conceptId);
      }
    }
  });

  it("sameConcept=true: distractors from same conceptId, different objectId", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2, sameConcept: true });
    for (const t of tasks) {
      const distractors = t.options.filter(o => !o.isTarget);
      for (const d of distractors) {
        expect(d.card.conceptId).toBe(t.stimulusCard.conceptId);
        expect(d.card.objectId).not.toBe(t.stimulusCard.objectId);
      }
    }
  });
});
