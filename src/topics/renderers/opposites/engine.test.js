import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";
import shippedTopic from "../../../../public/decks/opposites_draft/topic.json";

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

  it("sameConcept=true: distractors have the stimulus pole, never another valid opposite", () => {
    const tasks = generateTasks({ type: "find_opposite" }, CARDS, 10, { distractorCount: 2, sameConcept: true });
    for (const t of tasks) {
      for (const d of t.options.filter(o => !o.isTarget)) {
        expect(d.card.conceptId).toBe(t.stimulusCard.conceptId);
        expect(d.card.pole).toBe(t.stimulusCard.pole);
      }
    }
  });
});

describe("generateTasks — sort, controlled field size", () => {
  const cards = shippedTopic.cards.filter(c => c.conceptId === "big_small");

  it.each([4, 6, 8])("uses %i cards with matched objects and balanced poles", cardCount => {
    const [task] = generateTasks({ type: "sort" }, cards, 500, { cardCount });
    expect(task.cards).toHaveLength(cardCount);
    for (const zone of task.zones) {
      expect(task.cards.filter(item => item.targetZoneId === zone.id)).toHaveLength(cardCount / 2);
    }
    const objects = new Set(task.cards.map(item => item.card.objectId));
    expect(objects.size).toBe(cardCount / 2);
    for (const objectId of objects) {
      expect(task.cards.filter(item => item.card.objectId === objectId)
        .map(item => item.card.pole).sort()).toEqual(["left", "right"]);
    }
  });

  it("starts with four cards when no size is supplied", () => {
    const [task] = generateTasks({ type: "sort" }, cards, 500);
    expect(task.cards).toHaveLength(4);
  });

  it("keeps concepts separate in mixed lessons", () => {
    const tasks = generateTasks({ type: "sort" }, shippedTopic.cards, 500, { cardCount: 6 });
    expect(tasks).toHaveLength(9);
    for (const task of tasks) {
      expect(task.cards).toHaveLength(6);
      expect(new Set(task.cards.map(item => item.card.conceptId)).size).toBe(1);
    }
  });

  it("uses available complete pairs without duplicating cards or adding incomplete objects", () => {
    const partial = [...CARDS.filter(c => c.objectId === "dog"), CARDS.find(c => c.id === "big_cat")];
    const [task] = generateTasks({ type: "sort" }, partial, 500, { cardCount: 8 });
    expect(task.cards.map(item => item.card.id).sort()).toEqual(["big_dog", "small_dog"]);
  });
});

describe("generateTasks — find_opposite, unambiguous choices", () => {
  const settings = ["image", "text"].flatMap(stimulusType =>
    ["image", "text"].flatMap(distractorType =>
      [false, true].map(sameConcept => ({ stimulusType, distractorType, sameConcept }))
    )
  );

  function checkChoices(tasks, params) {
    expect(tasks.length).toBeGreaterThan(0);
    for (const task of tasks) {
      expect(task.options.length).toBeGreaterThanOrEqual(2);
      expect(task.options.length).toBeLessThanOrEqual((params.distractorCount ?? 2) + 1);
      expect(task.options.filter(o => o.isTarget)).toHaveLength(1);
      // A non-target must not express the same opposite as the target.
      const semanticAnswers = task.options.filter(o =>
        o.card.conceptId === task.stimulusCard.conceptId && o.card.pole !== task.stimulusCard.pole
      );
      expect(semanticAnswers).toHaveLength(1);
      expect(semanticAnswers[0].isTarget).toBe(true);
      const labels = task.options.map(o => params.distractorType === "text" ? o.card.poleLabel : o.card.id);
      expect(new Set(labels).size).toBe(labels.length);
    }
  }

  it.each(settings)("offers a real choice in every single-concept lesson: %j", params => {
    for (const conceptId of new Set(shippedTopic.cards.map(c => c.conceptId))) {
      const cards = shippedTopic.cards.filter(c => c.conceptId === conceptId);
      checkChoices(generateTasks({ type: "find_opposite" }, cards, 500, params), params);
    }
  });

  it.each(settings)("keeps all mixed-lesson answers distinct with six distractors requested: %j", params => {
    const settings = { ...params, distractorCount: 6 };
    checkChoices(generateTasks({ type: "find_opposite" }, shippedTopic.cards, 500, settings), settings);
  });

  it.each(settings)("works even when only one object pair is available: %j", params => {
    const cards = CARDS.filter(c => c.objectId === "dog");
    const tasks = generateTasks({ type: "find_opposite" }, cards, 500, params);
    checkChoices(tasks, params);
    expect(tasks[0].options).toHaveLength(2);
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
    const dogTask = tasks.find(t => t.options.some(o => o.card.id === "big_dog" && o.isTarget));
    expect(dogTask.instructionLabel).toBe("большую"); // big_dog, feminine "собака"
    const ballTask = tasks.find(t => t.options.some(o => o.card.id === "big_ball" && o.isTarget));
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

  it("with cards from multiple concepts, each task's grid stays within one concept (targetLabel matches every correct card)", () => {
    // CARDS spans big_small and wet_dry. A session that includes both at once
    // (e.g. a mixed review) must never build one grid mixing "маленькие" from
    // big_small with "сухие" from wet_dry under a single targetLabel — every
    // correct card in a task must belong to the same conceptId, and its
    // poleLabelPlural must equal that task's targetLabel.
    const tasks = generateTasks({ type: "find_all" }, CARDS, 10, {});
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      const correctCards = t.allCards.filter(c => t.correctCardIds.includes(c.id));
      const conceptIds = new Set(correctCards.map(c => c.conceptId));
      expect(conceptIds.size).toBe(1);
      for (const c of correctCards) {
        expect(c.poleLabelPlural).toBe(t.targetLabel);
      }
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
