import { describe, expect, it } from "vitest";
import { generateTasks } from "./engine";

const cards = [
  { id: "in-1", conceptId: "spatial_in", relation: "in", image: "in-1", contrastImage: "out-1" },
  { id: "in-2", conceptId: "spatial_in", relation: "in", image: "in-2", contrastImage: "out-2" },
  { id: "on-1", conceptId: "spatial_on", relation: "on", image: "on-1", contrastImage: "under-1" },
  { id: "under-1", conceptId: "spatial_under", relation: "under", image: "under-1", contrastImage: "on-1" },
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
  });

  it("interleaves selected relations in a regular mode", () => {
    const tasks = generateTasks(
      { type: "spatial_recognize" },
      cards,
      500,
      { relations: ["spatial_in", "spatial_on", "spatial_under"] },
    );

    expect(tasks).toHaveLength(cards.length);
    expect(new Set(tasks.map((task) => task.card.relation))).toEqual(new Set(["in", "on", "under"]));
    for (let index = 1; index < tasks.length; index += 1) {
      expect(tasks[index].card.relation).not.toBe(tasks[index - 1].card.relation);
    }
  });

  it("uses all relations when the multi-select is left on «Все»", () => {
    const tasks = generateTasks({ type: "spatial_respond" }, cards, 500, { relations: [] });
    expect(new Set(tasks.map((task) => task.card.relation))).toEqual(new Set(["in", "on", "under"]));
  });
});
