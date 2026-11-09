import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { generateTasks } from "./engine.js";

describe("downloadable drawing topic", () => {
  it("imports its own renderer and all 42 lesson steps without changing shared loaders", async () => {
    const bytes = await readFile("public/decks/drawing_v0.1.0.zip");
    const db = await openDb(`drawing-test-${Date.now()}`);
    await expect(importTopic(db, bytes, "1.1.6")).rejects.toThrow("1.1.7");
    await importTopic(db, bytes, "1.1.7");
    const record = await getTopicRecord(db, "drawing");
    expect(record.meta.renderer).toBe("drawing");
    expect(record.modes).toHaveLength(1);
    expect(record.modes[0]).toMatchObject({ type: "drawing_steps", evaluation: "none", finite: true });
    const tasks = generateTasks(record.modes[0], record.cards);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ type: "drawing_lesson", cardId: "kompot", conceptId: "kompot" });
    expect(tasks[0].lesson.steps).toHaveLength(42);
    expect(tasks[0].lesson.steps.slice(0, 18).every(step => step.kind === "stroke")).toBe(true);
    expect(tasks[0].lesson.steps.slice(18, 38).every(step => step.kind === "color")).toBe(true);
    expect(tasks[0].lesson.steps[38].title).toContain("уса слева");
    expect(tasks[0].lesson.steps[41].title).toContain("правого ушка");
    db.close();
  });
  it("uses the chosen drawings in their content order, with no fixed task count", () => {
    const lesson = { steps: [{ kind: "stroke", paths: ["M0 0L1 1"] }] };
    const cards = [{ id: "second", lesson }, { id: "first", lesson }, { id: "unfinished" }];
    expect(generateTasks({}, cards, 500).map(task => task.cardId)).toEqual(["second", "first"]);
    expect(generateTasks({}, [])).toEqual([]);
  });
});
