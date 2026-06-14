import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const MOCK_RECORD = {
  groups: [
    {
      id: "soup",
      items: [
        { id: "soup_pour", phrase: "Чем наливают суп?",  answer: "Суп наливают половником" },
        { id: "soup_eat",  phrase: "Чем едят суп?",       answer: "Суп едят ложкой"         },
        { id: "soup_cook", phrase: "В чём варят суп?",    answer: "Суп варят в кастрюле"    },
      ],
    },
    {
      id: "cut",
      items: [
        { id: "cut_bread", phrase: "Чем режут хлеб?",   answer: "Хлеб режут ножом"       },
        { id: "cut_paper", phrase: "Чем режут бумагу?", answer: "Бумагу режут ножницами" },
        { id: "cut_nails", phrase: "Чем режут ногти?",  answer: "Ногти режут щипчиками"  },
      ],
    },
  ],
};

describe("generateTasks", () => {
  it("returns [] for unknown mode type", () => {
    expect(generateTasks({ type: "unknown" }, MOCK_RECORD)).toEqual([]);
  });

  it("returns one task per group", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    expect(tasks).toHaveLength(2);
  });

  it("each task has type, groupId, items, and answers", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    const task = tasks.find(t => t.groupId === "soup");
    expect(task.type).toBe("match");
    expect(task.items).toHaveLength(3);
    expect(task.answers).toHaveLength(3);
  });

  it("answer ids match item ids", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    const task = tasks.find(t => t.groupId === "soup");
    const answerIds = task.answers.map(a => a.id).sort();
    expect(answerIds).toEqual(["soup_cook", "soup_eat", "soup_pour"]);
  });

  it("answers carry the correct text", () => {
    const tasks = generateTasks({ type: "match" }, MOCK_RECORD);
    const task = tasks.find(t => t.groupId === "soup");
    const pour = task.answers.find(a => a.id === "soup_pour");
    expect(pour.text).toBe("Суп наливают половником");
  });

  it("handles missing groups gracefully", () => {
    expect(generateTasks({ type: "match" }, {})).toEqual([]);
  });
});
