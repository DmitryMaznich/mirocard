import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { generateTasks } from "./engine.js";
import JSZip from "jszip";

describe("downloadable drawing topic", () => {
  it("imports its own renderer and every drawing without changing shared loaders", async () => {
    const manifest = JSON.parse(await readFile("tools/drawing/topic.json", "utf8"));
    const bytes = await readFile(`public/decks/drawing_v${manifest.meta.version}.zip`);
    const archive = await JSZip.loadAsync(bytes);
    const db = await openDb(`drawing-test-${Date.now()}`);
    await expect(importTopic(db, bytes, "1.1.97")).rejects.toThrow("1.1.98");
    await importTopic(db, bytes, "1.1.98");
    const record = await getTopicRecord(db, "drawing");
    expect(record.meta.renderer).toBe("drawing");
    expect(record.modes).toHaveLength(4);
    expect(record.modes[3]).toMatchObject({ type: "drawing_portrait", evaluation: "none", finite: true });
    expect(record.modes[1].screenPractice).toBe(true);
    expect(record.modes[1].params).not.toHaveProperty('trackWidth');
    expect(record.modes[1].params.practiceSet.default).toBe('mixed');
    expect(record.modes[0]).toMatchObject({ type: "drawing_steps", evaluation: "none", finite: true, hideVideoReward: true, adultVideoReward: true });
    expect(record.modes[0].params.videoRewardEnabled.default).toBe(false);
    const tasks = generateTasks(record.modes[0], record.cards);
    const striped = tasks.find(task => task.cardId === 'striped_fish').lesson;
    expect(striped.finale).toMatchObject({ type: 'striped-fish', tail: [470, 150] });
    const bars = striped.steps.filter(step => step.part?.startsWith('stripe-') && step.kind === 'stroke');
    expect(bars.flatMap(step => step.paths)).toHaveLength(13);
    expect(bars.every(step => step.paths.length === 1 && step.tool === 'black' && step.paths[0].endsWith('Z'))).toBe(true);
    const colouredBars = striped.steps.filter(step => step.part?.startsWith('stripe-') && step.kind === 'color');
    expect(colouredBars).toHaveLength(13);
    expect(colouredBars.map(step => step.part)).toEqual(striped.finale.stripes);
    expect(colouredBars.map(step => step.d)).toEqual(bars.map(step => step.paths[0]));
    expect(colouredBars.map(step => step.tool)).toEqual(['red', 'orange', 'yellow', 'light_green', 'green', 'turquoise', 'light_blue', 'blue', 'purple', 'pink', 'coral', 'orange', 'yellow']);
    expect(striped.steps.slice(0, 15).every(step => step.kind === 'stroke')).toBe(true);
    expect(striped.steps.slice(15).every(step => step.kind === 'color')).toBe(true);
    expect(striped.steps.find(step => step.kind === 'color' && step.part === 'head').d).toContain('A 4 4');
    expect(await archive.file('media/striped_fish.svg').async('string')).toContain('#24486d');
    expect(tasks.map(task => task.cardId)).toEqual(expect.arrayContaining(["kompot", "gonya", "korzhik", "goldfish", "parrot", "donkey", "peppa_george", "snail", "sun_earth_moon", "jupiter_saturn", "dog", "snowman_glasses"]));
    expect(tasks.map(task => task.cardId)).toEqual(expect.arrayContaining([
      'cute_baby', 'house_tree_sun', 'peppa_collection_peppa_george',
      'peppa_collection_mummy_daddy', 'peppa_collection_suzy_danny',
      'peppa_collection_pedro_candy', 'peppa_collection_rebecca_emily', 'peppa_collection_zoe_freddy',
    ]));
    expect(tasks.find(task => task.cardId === 'house_tree_sun').lesson.paperOrientation).toBe('landscape');
    const snowman = tasks.find(task => task.cardId === "snowman_glasses").lesson;
    expect(snowman.title).toBe("Снеговик в очках");
    expect(snowman.steps).toHaveLength(41);
    expect(snowman.source.url).toContain("1pxa9_W1Dnj1BlfVCz5AwHNtdq66dzFGb");
    expect(snowman.steps.slice(0, 7).map(step => step.title)).toEqual([
      "Шарф целиком", "Складка шарфа", "Большой снежный ком",
      "Голова над шарфом — от края до края", "Целый отворот шапки на голове",
      "Верхняя часть шапки", "Круглый помпон",
    ]);
    for (const step of snowman.steps.slice(0, 7)) expect(step.paths).toHaveLength(1);
    expect(snowman.steps.findIndex(step => step.title === "Левая ручка-веточка"))
      .toBeLessThan(snowman.steps.findIndex(step => step.title === "Левая варежка на ручке"));
    expect(snowman.steps.findIndex(step => step.title === "Правая ручка-веточка"))
      .toBeLessThan(snowman.steps.findIndex(step => step.title === "Правая варежка на ручке"));
    expect(await archive.file("media/snowman_glasses.svg").async("string")).toContain(snowman.viewBox);
    for (const step of snowman.steps.filter(step => step.kind === "stroke")) {
      for (const path of step.paths) expect(path.match(/M /g)).toHaveLength(1);
    }
    const dog = tasks.find(task => task.cardId === "dog").lesson;
    expect(dog.title).toBe("Собачка");
    expect(dog.steps).toHaveLength(48);
    expect(dog.palette.map(tool => tool.id)).toEqual(["black", "yellow", "orange", "red", "green"]);
    expect(dog.source.url).toContain("1CDOHzsdyq1gN8gthBAlObKIJKxpYxxk6");
    expect(await archive.file("media/dog.svg").async("string")).toContain(dog.viewBox);
    for (const step of dog.steps.filter(step => step.kind === "stroke")) {
      for (const path of step.paths) expect(path.match(/M /g)).toHaveLength(1);
    }
    for (const [id, title, count] of [["sun_earth_moon", "Солнце, Земля и Луна", 10], ["jupiter_saturn", "Юпитер, Сатурн и спутник", 20]]) {
      const lesson = tasks.find(task => task.cardId === id).lesson;
      expect(lesson.title).toBe(title);
      expect(lesson.steps).toHaveLength(count);
      expect(lesson.source.url).toContain("1r3Y6FDQqPTwQK0JmCWX12ICzgATCCsr3");
      expect(lesson.source.objects).toHaveLength(3);
      expect(lesson.labels.map(label => label.text)).toEqual(id === "sun_earth_moon"
        ? ["Солнце", "Земля", "Луна"] : ["Юпитер", "Сатурн", "Спутник"]);
      const cover = await archive.file(`media/${id}.svg`).async('string');
      for (const label of lesson.labels) expect(cover).toContain(`>${label.text}</text>`);
      for (const step of lesson.steps.filter(s => s.kind === "stroke")) {
        for (const path of step.paths) expect(path.match(/M /g)).toHaveLength(1);
      }
    }
    const snail = tasks.find(task => task.cardId === "snail").lesson;
    expect(snail.title).toBe("Улитка");
    expect(snail.steps).toHaveLength(26);
    expect(snail.progressRevision).toBe(2);
    expect(snail.source.url).toContain("1QfPhIZi4nFFKpKyG28rTtL4pIjWhMzSx");
    expect(snail.palette.map(tool => tool.id)).toEqual(["black", "pink", "purple", "yellow", "green"]);
    for (const title of ["Контур раковины", "Контур тела и головы", "Спираль раковины"]) {
      expect(snail.steps.find(step => step.title === title).paths).toHaveLength(1);
    }
    for (const step of snail.steps.filter(s => s.kind === "stroke")) {
      for (const path of step.paths) expect(path.match(/M /g)).toHaveLength(1);
    }
    const peppa = tasks.find(task => task.cardId === "peppa_george").lesson;
    expect(peppa.title).toBe("Пеппа и Джордж");
    expect(peppa.source.url).toContain("1TXjRL5uiFjGpBmAIo9WXDKnmgehVs-tT");
    expect(peppa.steps).toHaveLength(79);
    expect(peppa.progressRevision).toBe(3);
    expect(peppa.steps[0]).toMatchObject({ kind: "stroke", title: "Голова Джорджа" });
    expect(peppa.steps.at(-1)).toMatchObject({ kind: "color", tool: "green" });
    // A single animated stroke cannot contain disconnected moves: SVG dash
    // patterns restart at each M and would reveal later lines prematurely.
    for (const step of peppa.steps.filter(s => s.kind === "stroke")) {
      for (const path of step.paths) expect(path.match(/M /g)).toHaveLength(1);
    }
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
      if (task.lesson.stepOrder === 'authored') {
        const original = JSON.parse(await readFile(`tools/drawing/lessons/${task.lesson.id}.json`, 'utf8'));
        expect(task.lesson.steps).toEqual(original.steps);
        if (task.lesson.characters) {
          const [first, second] = task.lesson.characters;
          expect(task.lesson.steps.slice(0, first.endStep).every(step => step.character === first.name)).toBe(true);
          expect(task.lesson.steps[first.endStep - 1].kind).toBe('color');
          expect(task.lesson.steps.slice(first.endStep).every(step => step.character === second.name)).toBe(true);
        }
      } else {
        expect(new Set(groups).size).toBe(groups.length);
        expect(groups).toEqual(task.lesson.palette.map(tool => tool.id));
      }
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

import { chooseCorner, signatureDate } from './signature.js';
import { it as signIt, expect as signExpect } from 'vitest';
signIt('signs with the date in words and in the emptiest corner (top right on a tie: the bottom has buttons)', () => {
  signExpect(signatureDate(new Date(2026, 10, 16))).toBe('16 ноября 2026');
  signExpect(signatureDate(new Date(2027, 0, 3))).toBe('3 января 2027');
  const view = { x: 0, y: 0, width: 1000, height: 800 }, size = { width: 260, height: 90 };
  signExpect(chooseCorner(view, { x: 100, y: 150, width: 700, height: 450 }, size, 30).id).toBe('tr');
  // The round buttons over the bottom corners count as taken.
  const buttons = [{ x: 0, y: 700, width: 120, height: 100 }, { x: 880, y: 700, width: 120, height: 100 }];
  signExpect(chooseCorner(view, { x: 0, y: 0, width: 1000, height: 600 }, size, 30, buttons).id).toBe('tr');
  // A drawing in the top right leaves the top left free; one filling the top leaves the bottom.
  signExpect(chooseCorner(view, { x: 400, y: 0, width: 600, height: 500 }, size, 30).id).toBe('tl');
  signExpect(chooseCorner(view, { x: 0, y: 0, width: 1000, height: 600 }, size, 30).id).toBe('br');
});
