import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const MOCK_RECORD = {
  groups: [
    {
      id: "soup",
      items: [
        { id: "soup_pour", phrase: "Чем наливают суп?", image: "media/soup_pour.webp" },
        { id: "soup_eat",  phrase: "Чем едят суп?",      image: "media/soup_eat.webp"  },
        { id: "soup_cook", phrase: "В чём варят суп?",   image: "media/soup_cook.webp" },
      ],
      distractors: [
        { id: "d_fork",  image: "media/d_fork.webp"  },
        { id: "d_plate", image: "media/d_plate.webp" },
      ],
    },
    {
      id: "cut",
      items: [
        { id: "cut_bread", phrase: "Чем режут хлеб?",   image: "media/cut_bread.webp" },
        { id: "cut_paper", phrase: "Чем режут бумагу?", image: "media/cut_paper.webp" },
        { id: "cut_nails", phrase: "Чем режут ногти?",  image: "media/cut_nails.webp" },
      ],
      distractors: [
        { id: "d_pencil", image: "media/d_pencil.webp" },
        { id: "d_ruler",  image: "media/d_ruler.webp"  },
      ],
    },
  ],
};

describe("generateTasks", () => {
  it("returns [] for unknown mode type", () => {
    expect(generateTasks({ type: "unknown" }, MOCK_RECORD)).toEqual([]);
  });

  it("returns one task per group for mode type 'match'", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    expect(tasks).toHaveLength(2);
  });

  it("each task has type 'match', groupId, items, and images", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    const task = tasks.find(t => t.groupId === "soup");
    expect(task.type).toBe("match");
    expect(task.items).toHaveLength(3);
    expect(task.images).toHaveLength(5);
  });

  it("images contains both correct and distractor entries", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    const task = tasks.find(t => t.groupId === "soup");
    const correct = task.images.filter(i => !i.isDistractor);
    const wrong   = task.images.filter(i =>  i.isDistractor);
    expect(correct).toHaveLength(3);
    expect(wrong).toHaveLength(2);
  });

  it("correct image ids match item ids", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    const task = tasks.find(t => t.groupId === "soup");
    const correctIds = task.images.filter(i => !i.isDistractor).map(i => i.id);
    expect(correctIds.sort()).toEqual(["soup_cook", "soup_eat", "soup_pour"]);
  });

  it("handles missing groups gracefully", () => {
    expect(generateTasks({ type: "match" }, {})).toEqual([]);
  });
});
