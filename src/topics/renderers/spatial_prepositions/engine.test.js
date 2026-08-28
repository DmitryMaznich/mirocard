import { describe, expect, it } from "vitest";
import { generateTasks } from "./engine";

const cards = [
  { id: "in-1", conceptId: "spatial_in", relation: "in", phrase: "в коробке", image: "in-1", contrastImage: "near-1" },
  { id: "in-2", conceptId: "spatial_in", relation: "in", phrase: "в корзине", image: "in-2", contrastImage: "near-2" },
  { id: "near-1", conceptId: "spatial_near", relation: "near", phrase: "рядом с коробкой", image: "near-1", contrastImage: "in-1" },
  { id: "near-2", conceptId: "spatial_near", relation: "near", phrase: "рядом с корзиной", image: "near-2", contrastImage: "in-2" },
  { id: "on-1", conceptId: "spatial_on", relation: "on", phrase: "на столе", image: "on-1", contrastImage: "under-1" },
  { id: "under-1", conceptId: "spatial_under", relation: "under", phrase: "под столом", image: "under-1", contrastImage: "on-1" },
];

describe("spatial prepositions engine", () => {
  it("keeps introduction cards in a fixed teaching order for one relation", () => {
    const tasks = generateTasks({ type: "spatial_introduction" }, cards, 500, { relations: ["spatial_in"] });
    expect(tasks.map((task) => task.card.id)).toEqual(["in-1", "in-2"]);
  });

  it("builds matched visual alternatives and alternates their fixed slots", () => {
    const tasks = generateTasks({ type: "spatial_recognize" }, cards, 500, { relations: ["spatial_in"] });
    expect(tasks[0].options.map((option) => option.isTarget)).toEqual([true, false]);
    expect(tasks[1].options.map((option) => option.isTarget)).toEqual([false, true]);
  });

  it("uses one selected relation in any mode", () => {
    const tasks = generateTasks({ type: "spatial_respond" }, cards, 500, { relations: ["spatial_under"] });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].card.relation).toBe("under");
    expect(tasks[0].options).toEqual([
      { id: "target", text: "под столом", isTarget: true },
      { id: "contrast", text: "на столе", isTarget: false },
    ]);
  });

  it("offers all four relations when four response tiles are selected", () => {
    const tasks = generateTasks(
      { type: "spatial_respond" },
      cards,
      500,
      { relations: ["spatial_under"], answerOptions: "4" },
    );

    expect(tasks[0].options).toEqual([
      { id: "target", text: "под столом", isTarget: true },
      { id: "contrast", text: "на столе", isTarget: false },
      { id: "relation-in", text: "в коробке", isTarget: false },
      { id: "relation-near", text: "рядом с коробкой", isTarget: false },
    ]);
  });

  it("interleaves selected relations in a regular mode", () => {
    const tasks = generateTasks(
      { type: "spatial_recognize" },
      cards,
      500,
      { relations: ["spatial_in", "spatial_on", "spatial_under"] },
    );

    expect(tasks).toHaveLength(4);
    expect(new Set(tasks.map((task) => task.card.relation))).toEqual(new Set(["in", "on", "under"]));
    for (let index = 1; index < tasks.length; index += 1) {
      expect(tasks[index].card.relation).not.toBe(tasks[index - 1].card.relation);
    }
  });

  it("uses all relations when the multi-select is left on «Все»", () => {
    const tasks = generateTasks({ type: "spatial_respond" }, cards, 500, { relations: [] });
    expect(new Set(tasks.map((task) => task.card.relation))).toEqual(new Set(["in", "near", "on", "under"]));
  });

  it("uses «рядом с» as a separately selectable relation", () => {
    const tasks = generateTasks({ type: "spatial_introduction" }, cards, 500, { relations: ["spatial_near"] });
    expect(tasks.map((task) => task.card.id)).toEqual(["near-1", "near-2"]);
  });

  it("adds the second picture set to «Покажи» and «Ответь» only when 10 is selected", () => {
    const transferCards = [
      ...cards,
      { id: "in-transfer", conceptId: "spatial_in", relation: "in", phrase: "в коробке", phase: "transfer", image: "in-transfer", contrastImage: "near-transfer" },
      { id: "near-transfer", conceptId: "spatial_near", relation: "near", phrase: "рядом с коробкой", phase: "transfer", image: "near-transfer", contrastImage: "in-transfer" },
      { id: "on-transfer", conceptId: "spatial_on", relation: "on", phrase: "на столе", phase: "transfer", image: "on-transfer", contrastImage: "under-transfer" },
      { id: "under-transfer", conceptId: "spatial_under", relation: "under", phrase: "под столом", phase: "transfer", image: "under-transfer", contrastImage: "on-transfer" },
    ];

    const standardShowTasks = generateTasks(
      { type: "spatial_recognize" },
      transferCards,
      500,
      { relations: ["spatial_in"] },
    );
    const extendedShowTasks = generateTasks(
      { type: "spatial_recognize" },
      transferCards,
      500,
      { relations: ["spatial_in"], cardsPerRelation: "10" },
    );
    const extendedResponseTasks = generateTasks(
      { type: "spatial_respond" },
      transferCards,
      500,
      { relations: ["spatial_under"], cardsPerRelation: "10" },
    );

    expect(standardShowTasks.map((task) => task.card.id)).not.toContain("in-transfer");
    expect(extendedShowTasks.map((task) => task.card.id)).toContain("in-transfer");
    expect(extendedResponseTasks.map((task) => task.card.id)).toContain("under-transfer");
  });
});
