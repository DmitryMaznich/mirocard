import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { generateTasks } from "./engine.js";

describe("downloadable drawing topic", () => {
  it("imports its own renderer and every drawing without changing shared loaders", async () => {
    const manifest = JSON.parse(await readFile("tools/drawing/topic.json", "utf8"));
    const bytes = await readFile(`public/decks/drawing_v${manifest.meta.version}.zip`);
    const db = await openDb(`drawing-test-${Date.now()}`);
    await expect(importTopic(db, bytes, "1.1.6")).rejects.toThrow("1.1.7");
    await importTopic(db, bytes, "1.1.7");
    const record = await getTopicRecord(db, "drawing");
    expect(record.meta.renderer).toBe("drawing");
    expect(record.modes).toHaveLength(1);
    expect(record.modes[0]).toMatchObject({ type: "drawing_steps", evaluation: "none", finite: true });
    const tasks = generateTasks(record.modes[0], record.cards);
    expect(tasks.map(task => task.cardId)).toEqual(expect.arrayContaining(["kompot", "gonya", "korzhik"]));
    const korzhik = tasks.find(task => task.cardId === "korzhik").lesson;
    expect(korzhik.title).toBe("Коржик");
    expect(korzhik.steps).toHaveLength(54);
    expect(korzhik.palette.map(tool => tool.id)).toEqual(["black", "orange", "brown", "light_blue", "beige"]);
    const gonya = tasks.find(task => task.cardId === "gonya").lesson;
    expect(gonya.steps).toHaveLength(42);
    expect(gonya.steps.slice(0, 21).every(step => step.kind === "stroke")).toBe(true);
    expect(gonya.steps.slice(21).every(step => step.kind === "color")).toBe(true);
    for (const task of tasks) {
      const order = task.lesson.steps.map(step => step.tool);
      const groups = order.filter((tool, i) => i===0 || order[i-1]!==tool);
      expect(new Set(groups).size).toBe(groups.length);
      expect(groups).toEqual(task.lesson.palette.map(tool => tool.id));
      for (const step of task.lesson.steps.filter(step => step.kind === "color")) {
        expect(step.fill).toBe(task.lesson.palette.find(tool => tool.id===step.tool).color);
      }
    }
    expect(gonya.steps.findIndex(step => step.tool === "light_blue")).toBeLessThan(gonya.steps.findIndex(step => step.tool === "blue"));
    expect(tasks[0]).toMatchObject({ type: "drawing_lesson", cardId: "kompot", conceptId: "kompot" });
    expect(tasks[0].lesson.steps).toHaveLength(42);
    expect(tasks[0].lesson.steps.slice(0, 20).every(step => step.kind === "stroke")).toBe(true);
    expect(tasks[0].lesson.steps.slice(20).every(step => step.kind === "color")).toBe(true);
    expect(tasks[0].lesson.steps[18].title).toContain("уса слева");
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
