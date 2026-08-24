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
    const tasks = generateTasks({ type: "spatial_introduction" }, cards, 500, { relation: "spatial_in", cardCount: 2 });
    expect(tasks.map((task) => task.card.id)).toEqual(["in-1", "in-2"]);
  });

  it("builds matched visual alternatives and alternates their fixed slots", () => {
    const tasks = generateTasks({ type: "spatial_recognize" }, cards, 500, { relation: "spatial_in", cardCount: 2 });
    expect(tasks[0].options.map((option) => option.isTarget)).toEqual([true, false]);
    expect(tasks[1].options.map((option) => option.isTarget)).toEqual([false, true]);
  });

  it("never mixes relations in a one-concept session", () => {
    const tasks = generateTasks({ type: "spatial_respond" }, cards, 500, { relation: "spatial_under", cardCount: 5 });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].card.relation).toBe("under");
  });
});
