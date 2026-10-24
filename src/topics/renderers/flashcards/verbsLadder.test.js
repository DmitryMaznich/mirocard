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
    const show = reread.modes.find((m) => m.id === "verbs_show");
    expect(show.ui.title).toBe("Покажи");
    expect(show.params.step.default).toBe(1);
    expect(reread.modes.filter((m) => m.type === "find_n" && !m.retired).map((m) => m.id)).toEqual(["verbs_show"]);
    expect(reread.modes.some((m) => m.type === "yes_no")).toBe(false);
    expect(reread.meta.groups.set5.ru).toBe("Набор 5");
    expect(reread.cards.find((c) => c.conceptId === "flies").group).toBe("set5");
    expect(reread.modes.find((m) => m.id === "verbs_intro").params.picturesPerConcept.default).toBe(4);
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
    const show = deck.modes.find((m) => m.id === "verbs_show");
    expect(readModeParams({ optionCount: 6 }, show)).toEqual({ step: 1 });
  });

  it("«Покажи» has two steps: two pictures, then four", () => {
    const show = deck.modes.find((m) => m.id === "verbs_show");
    const concepts = deriveConcepts(deck.cards).filter((c) => c.primary.wave === 1);
    const counts = [1, 2].map((step) => generateTasks("find_n", concepts, deck.cards, { step }, show)[0].options.length);
    expect(counts).toEqual([2, 4]);
    expect(show.params.step.values).toEqual([1, 2]);
    expect(show.errorless).toBe(true);
  });
});

describe("pictures", () => {
  const concepts = deriveConcepts(deck.cards).filter((c) => c.primary.wave === 1);
  it("every mode uses all pictures of a verb, even with an old saved «Картинки» value", () => {
    const show = deck.modes.find((m) => m.id === "verbs_show");
    const tasks = generateTasks("find_n", concepts, deck.cards, { step: 1, cardSet: "contrast" }, show);
    const all = deck.cards.filter((c) => c.wave === 1).length;
    expect(tasks.length).toBe(all);
  });
  it("«Знакомство» leaves out animals; later modes keep them", () => {
    const intro = deck.modes.find((m) => m.id === "verbs_intro");
    const tasks = generateTasks("intro", deriveConcepts(deck.cards), deck.cards, {}, intro);
    expect(tasks.some((t) => t.card.agent === "animal")).toBe(false);
    const show = deck.modes.find((m) => m.id === "verbs_show");
    expect(generateTasks("find_n", deriveConcepts(deck.cards), deck.cards, { step: 2 }, show).some((t) => t.options.some((o) => o.isTarget && o.card.agent === "animal"))).toBe(true);
  });
  // No answers are counted there, so a reward could never be earned: the switch is hidden.
  it("«Знакомство» has no video-reward switch", () => {
    expect(deck.modes.find((m) => m.id === "verbs_intro").hideVideoReward).toBe(true);
  });
  // «летит» has a bird and a butterfly instead: people do not fly.
  it("every verb has a boy and a mum card plus at least two other pictures", () => {
    for (const c of deriveConcepts(deck.cards)) {
      expect(c.cards.filter((card) => card.set === "contrast"), c.conceptId).toHaveLength(2);
      expect(c.cards.filter((card) => card.set === "variation").length, c.conceptId).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("«Знакомство»: pictures per verb and sets", () => {
  const intro = deck.modes.find((m) => m.id === "verbs_intro");
  const concepts = deriveConcepts(deck.cards).filter((c) => ["eats", "closes"].includes(c.conceptId));

  it("defaults to four pictures per verb, the boy and mum first", () => {
    const tasks = generateTasks("intro", concepts, deck.cards, computeDefaultParams(deck, intro), intro);
    for (const id of ["eats", "closes"]) {
      const cards = tasks.filter((t) => t.conceptId === id).map((t) => t.card);
      expect(cards).toHaveLength(4);
      expect(cards[0].primary).toBe(true);
      expect(cards[1].set).toBe("contrast");
      expect(cards.slice(2).every((card) => card.set === "variation")).toBe(true);
    }
  });

  it("«2» is the boy and mum pair, «Все» every picture but animals", () => {
    const two = generateTasks("intro", concepts, deck.cards, { picturesPerConcept: 2 }, intro);
    expect(two.every((t) => t.card.set === "contrast")).toBe(true);
    expect(two).toHaveLength(4);
    const all = generateTasks("intro", concepts, deck.cards, { picturesPerConcept: "all" }, intro);
    expect(all).toHaveLength(deck.cards.filter((c) => ["eats", "closes"].includes(c.conceptId) && c.agent !== "animal").length);
  });

  it("every verb belongs to the set of its wave, and the set names say «Набор»", () => {
    expect(Object.values(deck.meta.groups).map((g) => g.ru)).toEqual(["Набор 1", "Набор 2", "Набор 3", "Набор 4", "Набор 5"]);
    for (const c of deriveConcepts(deck.cards)) expect(c.primary.group).toBe(`set${c.primary.wave}`);
    expect(JSON.stringify(deck)).not.toMatch(/[Вв]олн[аеуыо]/);
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

  it("act_out only offers actions a child can do in the room", () => {
    const tasks = generateTasks("act_out", deriveConcepts(deck.cards), deck.cards, {});
    const ids = tasks.map((t) => t.conceptId);
    for (const id of ["sleeps", "swims", "rides", "cries", "cuts_knife", "waters_plants", "vacuums", "falls", "swings", "bathes", "builds", "writes", "flies"]) expect(ids).not.toContain(id);
    expect(ids).toHaveLength(31);
  });

  it("postures and look-alikes: no picture that also shows сидит / стоит / лежит is a wrong answer for it", () => {
    const all = deriveConcepts(deck.cards);
    for (let i = 0; i < 10; i++) {
      for (const t of generateTasks("find_n", all, deck.cards, { optionCount: 4 })) {
        for (const o of t.options.filter((option) => !option.isTarget)) {
          expect(o.card.alsoShows ?? []).not.toContain(t.targetConceptId);
        }
      }
    }
  });

  it("act_out speaks the imperative of each verb once", () => {
    const tasks = generateTasks("act_out", concepts, deck.cards, {});
    expect(tasks.map((t) => t.imperative)).toEqual(["Ешь!"]);
  });

  it("choose_all carries the verb's audio", () => {
    const tasks = generateTasks("choose_all", concepts, deck.cards, { optionCount: 4 });
    expect(tasks[0].promptAudio.ru).toMatch(/^audio\/(eats|sleeps)\.mp3$/);
  });
});
