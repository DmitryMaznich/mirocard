import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  { id: "mom",    type: "subject",   label: "Мама",     emoji: "👩" },
  { id: "dad",    type: "subject",   label: "Папа",     emoji: "👨" },
  { id: "wash",   type: "verb",      label: "моет",     emoji: "🧼" },
  { id: "carry",  type: "verb",      label: "несёт",    emoji: "🤲" },
  { id: "red",    type: "adjective", label: "красную",  emoji: "🔴" },
  { id: "blue",   type: "adjective", label: "синюю",    emoji: "🔵" },
  { id: "cup",    type: "object",    label: "чашку",    nominative: "чашка", emoji: "☕" },
  { id: "car",    type: "object",    label: "машинку",  nominative: "машинка", emoji: "🚗" },
];

const MODE = { id: "sentence_puzzle", type: "sentence_puzzle" };

describe("generateTasks", () => {
  it("returns exactly one task", () => {
    const tasks = generateTasks(MODE, CARDS, 15, {});
    expect(tasks).toHaveLength(1);
  });

  it("task has type sentence_puzzle", () => {
    const [task] = generateTasks(MODE, CARDS, 15, {});
    expect(task.type).toBe("sentence_puzzle");
  });

  it("groups cards by type", () => {
    const [task] = generateTasks(MODE, CARDS, 15, {});
    expect(task.subjects).toHaveLength(2);
    expect(task.verbs).toHaveLength(2);
    expect(task.adjectives).toHaveLength(2);
    expect(task.objects).toHaveLength(2);
  });

  it("includes all cards of each type regardless of sessionParams", () => {
    const [task] = generateTasks(MODE, CARDS, 15, { level: 1, structure: "simple" });
    expect(task.subjects).toHaveLength(2);
    expect(task.verbs).toHaveLength(2);
  });

  it("handles missing cards of a type gracefully", () => {
    const noObjects = CARDS.filter((c) => c.type !== "object");
    const [task] = generateTasks(MODE, noObjects, 15, {});
    expect(task.objects).toHaveLength(0);
  });

  it("returns one task even when no cards provided", () => {
    const tasks = generateTasks(MODE, [], 15, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0].subjects).toHaveLength(0);
  });
});
