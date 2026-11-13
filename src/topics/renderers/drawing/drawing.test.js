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
    await expect(importTopic(db, bytes, "1.1.53")).rejects.toThrow("1.1.54");
    await importTopic(db, bytes, "1.1.54");
    const record = await getTopicRecord(db, "drawing");
    expect(record.meta.renderer).toBe("drawing");
    expect(record.modes).toHaveLength(2);
    expect(record.modes[0]).toMatchObject({ type: "drawing_steps", evaluation: "none", finite: true, hideVideoReward: true, adultVideoReward: true });
    expect(record.modes[0].params.videoRewardEnabled.default).toBe(false);
    const tasks = generateTasks(record.modes[0], record.cards);
    expect(tasks.map(task => task.cardId)).toEqual(expect.arrayContaining(["kompot", "gonya", "korzhik", "goldfish", "parrot", "donkey"]));
    const donkey=tasks.find(task=>task.cardId === "donkey").lesson;
    expect(donkey.title).toBe("Ослик");
    expect(donkey.steps).toHaveLength(39);
    expect(donkey.progressRevision).toBe(2);
    const grassOutline=donkey.steps.findIndex(s=>s.title === "Зелёный контур травки");
    expect(donkey.steps[grassOutline]).toMatchObject({kind:"stroke",tool:"green"});
    expect(donkey.steps[grassOutline+1]).toMatchObject({kind:"color",title:"Зелёная травка",tool:"green"});
    expect(donkey.steps.findIndex(s=>s.title === "Круглая серединка цветка")).toBeLessThan(donkey.steps.findIndex(s=>s.title === "Серединка цветка"));
    expect(donkey.palette.map(tool=>tool.id)).toEqual(["black","gray","brown","yellow","green"]);
    expect(donkey.steps.find(s=>s.title === "Четыре копытца").paths).toHaveLength(4);
    expect(donkey.steps.find(s=>s.title === "Контур лепестков цветка")).toMatchObject({kind:"stroke",tool:"black"});
    const parrot = tasks.find(task => task.cardId === "parrot").lesson;
    expect(parrot.title).toBe("Попугай");
    expect(parrot.progressRevision).toBe(2);
    expect(parrot.steps.filter(s => s.title.startsWith("Пёрышки на щёчке"))).toHaveLength(2);
    expect(parrot.steps.some(s => s.title === "Маленькое пёрышко на щёчке")).toBe(false);
    expect(parrot.steps.find(s => s.title === "Листочки на веточке")).toMatchObject({kind: "stroke", tool: "light_green"});
    expect(parrot.steps).toHaveLength(41);
    expect(parrot.palette.map(tool => tool.id)).toEqual(["black", "yellow", "pink", "purple", "orange", "brown", "light_green"]);
    const waves = parrot.steps.filter(step => step.title.startsWith("Волнистые пёрышки"));
    expect(waves).toHaveLength(3);
    for (const step of waves) {
      expect(step.paths).toHaveLength(1);
      expect(step.paths[0].match(/M /g)).toHaveLength(1);
    }
    const goldfish = tasks.find(task => task.cardId === "goldfish").lesson;
    expect(goldfish.title).toBe("Золотая рыбка");
    expect(goldfish.steps).toHaveLength(45);
    expect(goldfish.steps.filter(step => step.kind === "stroke")).toHaveLength(21);
    // One contour step must model one movement; colour belongs in a later
    // pencil step, never as an instant fill of an outlined object.
    for (const step of goldfish.steps.filter(step => step.kind === "stroke")) {
      expect(step.paths).toHaveLength(1);
      expect(typeof step.paths[0]).toBe("string");
      expect(step.paths[0].match(/M /g)).toHaveLength(1);
      if (step.title.includes("плавник")) expect(step.paths[0]).not.toMatch(/Z/);
    }
    expect(goldfish.steps.find(step => step.title.includes("зрачок"))).toMatchObject({ kind: "color", tool: "black" });
    expect(goldfish.steps.filter(step => step.kind === "stroke" && step.title.startsWith("Волнистая линия чешуи"))).toHaveLength(4);
    expect(goldfish.steps.filter(step => step.kind === "stroke" && step.title.includes("плавник"))).toHaveLength(3);
    expect(goldfish.palette.map(tool => tool.id)).toEqual(["black", "yellow", "orange", "red", "light_blue"]);
    const korzhik = tasks.find(task => task.cardId === "korzhik").lesson;
    expect(korzhik.title).toBe("Коржик");
    expect(korzhik.steps).toHaveLength(58);
    expect(korzhik.progressRevision).toBe(2);
    expect(korzhik.steps.slice(0, 4).map(step => step.title)).toEqual([
      "Контур головы", "Овальный верх бескозырки", "Боковины и полоска бескозырки", "Помпон бескозырки",
    ]);
    expect(korzhik.steps.findIndex(step => step.title === "Левое ушко")).toBeGreaterThan(korzhik.steps.findIndex(step => step.title === "Боковины и полоска бескозырки"));
    for (const step of korzhik.steps.filter(step => step.kind === "stroke")) expect(step.paths.every(path => typeof path === "string")).toBe(true);
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
