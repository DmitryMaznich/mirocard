import { describe, it, expect } from "vitest";
import { generateTasks, pickDistractors } from "./engine";

const word = (conceptId, sl, ru, n, extra = {}) => ({
  id: `${conceptId}_${n}`,
  conceptId,
  primary: n === 1,
  image: `media/${conceptId}_${n}.webp`,
  word: { sl, ru },
  audio: { sl: `audio/sl/${conceptId}.mp3`, ru: `audio/ru/${conceptId}.mp3` },
  group: "malica",
  ...extra,
});

const CARDS = [
  ...[1, 2, 3].map((n) => word("voda", "voda", "вода", n)),
  ...[1, 2, 3].map((n) => word("sok", "sok", "сок", n)),
  ...[1, 2, 3].map((n) => word("sir", "sir", "сыр", n)),
];

const DISTRACTORS = [
  { id: "zoga_1", conceptId: "zoga", image: "media/zoga_1.webp", word: { sl: "žoga" }, group: "igrisce" },
  { id: "knjiga_1", conceptId: "knjiga", image: "media/knjiga_1.webp", word: { sl: "knjiga" }, group: "razred" },
  { id: "svincnik_1", conceptId: "svincnik", image: "media/svincnik_1.webp", word: { sl: "svinčnik" }, group: "razred" },
  { id: "kapa_1", conceptId: "kapa", image: "media/kapa_1.webp", word: { sl: "kapa" }, group: "garderoba" },
];

const FIND = { type: "bw_find", audioOrder: "sl", optionCount: 3, distractors: DISTRACTORS };

describe("bilingual_words engine", () => {
  it("«Показ пары»: one task per word", () => {
    const tasks = generateTasks({ type: "bw_pair" }, CARDS, 500, {});
    expect(tasks).toHaveLength(3);
    expect(new Set(tasks.map((t) => t.conceptId))).toEqual(new Set(["voda", "sok", "sir"]));
    expect(tasks.every((t) => t.type === "bw_pair" && t.card.audio.sl)).toBe(true);
  });

  it("«Найди»: the session length setting, never the same word twice in a row", () => {
    for (let run = 0; run < 30; run++) {
      const tasks = generateTasks(FIND, CARDS, 500, { taskCount: 10 });
      expect(tasks).toHaveLength(10);
      for (let i = 1; i < tasks.length; i++) expect(tasks[i].conceptId).not.toBe(tasks[i - 1].conceptId);
    }
  });

  it("a word's next appearance shows its next picture", () => {
    const tasks = generateTasks(FIND, CARDS, 500, { taskCount: 6 });
    const voda = tasks.filter((t) => t.conceptId === "voda").map((t) => t.card.id);
    expect(voda).toHaveLength(2);
    expect(voda[0]).toBe("voda_1");
    expect(voda[1]).not.toBe("voda_1");
  });

  it("one target plus distractors from other situations", () => {
    const tasks = generateTasks(FIND, CARDS, 500, { taskCount: 9 });
    for (const task of tasks) {
      expect(task.options).toHaveLength(3);
      expect(task.options.filter((o) => o.isTarget)).toHaveLength(1);
      expect(task.options.find((o) => o.isTarget).card.conceptId).toBe(task.conceptId);
      for (const o of task.options.filter((x) => !x.isTarget)) expect(o.card.group).not.toBe("malica");
    }
  });

  it("step В keeps both words, Г/Д Slovenian only; the prompt delay setting", () => {
    expect(generateTasks({ ...FIND, audioOrder: "ru_sl", optionCount: 2 }, CARDS, 500, {})[0]).toMatchObject({ audioOrder: "ru_sl", promptDelaySec: 5 });
    expect(generateTasks(FIND, CARDS, 500, { promptDelay: 8 })[0]).toMatchObject({ audioOrder: "sl", promptDelaySec: 8 });
    expect(generateTasks({ ...FIND, optionCount: 2 }, CARDS, 500, {})[0].options).toHaveLength(2);
  });

  it("a distractor avoids the target's first sound when it can", () => {
    const target = word("sok", "sok", "сок", 1);
    for (let run = 0; run < 30; run++) {
      const picked = pickDistractors(target, DISTRACTORS, 2);
      expect(picked.map((d) => d.conceptId)).not.toContain("svincnik");
    }
  });

  it("stol and miza never share a screen", () => {
    const stol = word("stol", "stol", "стул", 1, { group: "razred", neverWith: ["miza"] });
    const pool = [
      { id: "miza_1", conceptId: "miza", image: "m.webp", word: { sl: "miza" }, group: "doma" },
      { id: "kapa_1", conceptId: "kapa", image: "k.webp", word: { sl: "kapa" }, group: "garderoba" },
    ];
    for (let run = 0; run < 20; run++) expect(pickDistractors(stol, pool, 2).map((d) => d.conceptId)).toEqual(["kapa"]);
  });

  it("«Прослушать все слова»: one list task with one card per word", () => {
    const [task] = generateTasks({ type: "bw_listen_all" }, CARDS, 500, {});
    expect(task.type).toBe("bw_listen_all");
    expect(task.cards.map((c) => c.id).sort()).toEqual(["sir_1", "sok_1", "voda_1"]);
  });
});
