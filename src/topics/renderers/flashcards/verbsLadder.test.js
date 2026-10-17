import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { generateTasks } from "./engine.js";
import { deriveConcepts, readModeParams, writeModeParams } from "@/shared/utils/topicUtils";
import { computeDefaultParams } from "@/features/session/computeDefaultParams";

const deck = JSON.parse(readFileSync("tools/verbs_v2/deck.json", "utf8"));

async function freshDb() {
  return openDb("test-" + Date.now() + Math.random());
}

// The built ZIP, not deck.json alone: install checks every referenced file, and
// this also fails when the ZIP was not rebuilt after editing deck.json.
async function installVerbs() {
  const buffer = readFileSync("tools/verbs_v2/verbs_v2.zip");
  const db = await freshDb();
  const record = await importTopic(db, buffer, "2.0.0");
  expect(record.meta.version).toBe(deck.meta.version);
  return { db, record };
}

describe("verbs_v2 deck as the app loads it", () => {
  it("keeps its own ladder: ids, order, titles and params survive install and re-read", async () => {
    const { db, record } = await installVerbs();
    const expected = deck.modes.map((m) => m.id);
    expect(record.modes.map((m) => m.id)).toEqual(expected);
    const reread = await getTopicRecord(db, "verbs_v2");
    expect(reread.modes.map((m) => m.id)).toEqual(expected);
    const find2 = reread.modes.find((m) => m.id === "verbs_find_2");
    expect(find2.ui.title).toBe("Покажи: из двух");
    expect(find2.params.distractorLevel.default).toBe("easy");
    expect(reread.modes.some((m) => m.type === "yes_no")).toBe(false);
  });

  it("every mode builds tasks for wave 1 with its default params", () => {
    const concepts = deriveConcepts(deck.cards).filter((c) => c.primary.wave === 1);
    for (const mode of deck.modes) {
      const tasks = generateTasks(mode.type, concepts, deck.cards, computeDefaultParams(deck, mode), mode);
      expect(tasks.length, mode.id).toBeGreaterThan(0);
    }
  });

  it("the three find modes keep separate settings in one synced params blob", () => {
    const [find2, find4] = ["verbs_find_2", "verbs_find_4"].map((id) => deck.modes.find((m) => m.id === id));
    let saved = {};
    saved = writeModeParams(saved, find2, { optionCount: 2, distractorLevel: "easy" });
    saved = writeModeParams(saved, find4, { optionCount: 4, distractorLevel: "medium" });
    expect(readModeParams(saved, find2)).toMatchObject({ optionCount: 2, distractorLevel: "easy" });
    expect(readModeParams(saved, find4)).toMatchObject({ optionCount: 4, distractorLevel: "medium" });
  });
});

describe("mode-scoped params", () => {
  it("leave topic-wide modes untouched", () => {
    const shared = { optionCount: 6 };
    expect(readModeParams(shared, { id: "find_n" })).toBe(shared);
    expect(writeModeParams(shared, { id: "find_n" }, { optionCount: 2 })).toEqual({ optionCount: 2 });
  });

  it("keep other keys of the blob when writing one mode", () => {
    const mode = { id: "m", paramsScope: "mode" };
    expect(writeModeParams({ figureFilters: { a: 1 }, byMode: { other: { x: 1 } } }, mode, { y: 2 }))
      .toEqual({ figureFilters: { a: 1 }, byMode: { other: { x: 1 }, m: { y: 2 } } });
    expect(readModeParams(undefined, mode)).toEqual({});
  });

  it("fall back to the mode's declared defaults before it was ever saved", () => {
    const find2 = deck.modes.find((m) => m.id === "verbs_find_2");
    expect(readModeParams({ optionCount: 6 }, find2)).toMatchObject({ optionCount: 2, distractorLevel: "easy", errorless: true });
  });
});

describe("picture sets", () => {
  const concepts = deriveConcepts(deck.cards).filter((c) => c.primary.wave === 1);
  it("contrast modes show only the boy and mum, distractors included", () => {
    const mode = deck.modes.find((m) => m.id === "verbs_find_2");
    const tasks = generateTasks("find_n", concepts, deck.cards, computeDefaultParams(deck, mode), mode);
    expect(tasks.length).toBe(concepts.length * 2);
    for (const t of tasks) for (const o of t.options) expect(o.card.set).toBe("contrast");
  });
  it("variation modes never show the contrast pair", () => {
    const mode = deck.modes.find((m) => m.id === "verbs_choose_all");
    const tasks = generateTasks("choose_all", concepts, deck.cards, computeDefaultParams(deck, mode), mode);
    for (const t of tasks) for (const c of t.allCards) expect(c.set).toBe("variation");
  });
  it("animals only appear in variation sets", () => {
    for (const c of deck.cards.filter((card) => card.agent === "animal")) expect(c.set).toBe("variation");
  });
  it("every verb has a boy and a mum card plus at least two other pictures", () => {
    for (const c of deriveConcepts(deck.cards)) {
      expect(c.cards.filter((card) => card.set === "contrast"), c.conceptId).toHaveLength(2);
      expect(c.cards.filter((card) => card.set === "variation").length, c.conceptId).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("flashcards engine additions", () => {
  const concepts = deriveConcepts(deck.cards).filter((c) => ["eats", "sleeps"].includes(c.conceptId));

  it("intro with groupByConcept shows every picture of one verb in a row", () => {
    const tasks = generateTasks("intro", concepts, deck.cards, {}, { groupByConcept: true });
    const order = tasks.map((t) => t.conceptId);
    const switches = order.filter((id, i) => i > 0 && id !== order[i - 1]).length;
    expect(switches).toBe(1);
  });

  it("act_out speaks the imperative of each verb once", () => {
    const tasks = generateTasks("act_out", concepts, deck.cards, {});
    expect(tasks.map((t) => t.imperative).sort()).toEqual(["Ешь!", "Спи!"]);
  });

  it("choose_all carries the verb's audio", () => {
    const tasks = generateTasks("choose_all", concepts, deck.cards, { optionCount: 4 });
    expect(tasks[0].promptAudio.ru).toMatch(/^audio\/(eats|sleeps)\.mp3$/);
  });
});
