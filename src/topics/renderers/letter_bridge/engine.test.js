import { describe, it, expect } from "vitest";
import { generateTasks, readableWords, cycle, alphabetTasks } from "./engine";

const letter = (sl, ru, group) => ({ id: sl, conceptId: sl, sl, ru, group, label: `${sl} = ${ru}` });
const G1 = ["A:А", "E:Е", "K:К", "M:М", "O:О", "T:Т"].map((p) => letter(...p.split(":"), "g1"));
const G2 = ["S:С", "R:Р", "N:Н", "I:И", "V:В", "D:Д", "J:Й"].map((p) => letter(...p.split(":"), "g2"));
const G3 = ["Č:Ч", "Š:Ш", "Ž:Ж"].map((p) => letter(...p.split(":"), "g3"));
const G4 = ["B:Б", "C:Ц", "H:Х", "P:П"].map((p) => letter(...p.split(":"), "g4"));
const WORDS = [
  { id: "sok", sl: "SOK", ru: "СОК", image: "media/sok_1.webp", audio: "audio/sl/sok.mp3" },
  { id: "voda", sl: "VODA", ru: "ВОДА", image: "media/voda_1.webp", audio: "audio/sl/voda.mp3" },
  { id: "caj", sl: "ČAJ", ru: "ЧАЙ", image: "media/caj_1.webp", audio: "audio/sl/caj.mp3" },
];
const NEAR = { S: "ŠZ", Š: "SŽ", K: "GH", T: "D", D: "T", M: "N", N: "ML", A: "OE", O: "AU", E: "IA" };

describe("letter_bridge engine", () => {
  it("«Пара букв»: one task per picked letter, shuffled", () => {
    const orders = new Set();
    for (let run = 0; run < 20; run++) {
      const tasks = generateTasks({ type: "lb_pair" }, G1, 500, {});
      expect(tasks.map((t) => t.card.sl).sort()).toEqual(["A", "E", "K", "M", "O", "T"]);
      orders.add(tasks.map((t) => t.card.sl).join(""));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("«Найди пару»: the right pair among three, never twice in a row", () => {
    for (let run = 0; run < 20; run++) {
      const tasks = generateTasks({ type: "lb_find" }, G1, 500, { taskCount: 10 });
      expect(tasks).toHaveLength(10);
      tasks.forEach((t, i) => {
        expect(t.options).toHaveLength(3);
        expect(t.options.filter((o) => o.sl === t.card.sl)).toHaveLength(1);
        if (i) expect(t.card.sl).not.toBe(tasks[i - 1].card.sl);
      });
    }
  });

  it("«Найди пару» follows the direction setting", () => {
    expect(generateTasks({ type: "lb_find" }, G1, 500, { direction: "ru_sl" })[0].dir).toBe("ru_sl");
    expect(generateTasks({ type: "lb_find" }, G1, 500, {})[0].dir).toBe("sl_ru");
    const dirs = new Set(generateTasks({ type: "lb_find" }, G1, 500, { direction: "mix", taskCount: 30 }).map((t) => t.dir));
    expect(dirs).toEqual(new Set(["sl_ru", "ru_sl"]));
  });

  it("fewer than three letters: an explanation instead of an empty session", () => {
    expect(generateTasks({ type: "lb_find" }, G1.slice(0, 2), 500, {})[0].type).toBe("lb_need_more");
  });

  it("«Ловушки»: the real pair against the look-alike twin", () => {
    const twins = { B: "В", C: "С", H: "Н", P: "Р" };
    const tasks = generateTasks({ type: "lb_trap", twins }, [...G1, ...G4], 500, { taskCount: 8 });
    expect(tasks).toHaveLength(8);
    for (const t of tasks) {
      expect(Object.keys(twins)).toContain(t.card.sl);
      expect(t.options.map((o) => o.text).sort()).toEqual([t.card.ru, twins[t.card.sl]].sort());
      expect(t.options.find((o) => o.ok).text).toBe(t.card.ru);
    }
  });

  it("«Ловушки» with no trap letter picked returns nothing, so the session falls back to all cards", () => {
    expect(generateTasks({ type: "lb_trap", twins: { P: "Р" } }, G1, 500, {})).toEqual([]);
  });

  it("«Слоги»: a recorded syllable from picked letters, by ear, against a misheard consonant and another vowel", () => {
    const SYL = Object.fromEntries(["KA", "KO", "TA", "TO", "DA", "DO", "MA", "MO", "NA", "NO", "SA", "SO"].map((s) => [s, `audio/syllables/sl/${s.toLowerCase()}.mp3`]));
    const tasks = generateTasks({ type: "lb_syll", syllables: SYL, near: NEAR }, [...G1, ...G2], 500, { taskCount: 12 });
    expect(tasks).toHaveLength(12);
    for (const t of tasks) {
      expect(t.sound).toBe(SYL[t.syl]);
      expect(t.conceptId).toBe(t.syl[0]);
      expect(t.translit).toBe([...t.syl].map((c) => [...G1, ...G2].find((x) => x.sl === c).ru).join(""));
      const texts = t.options.map((o) => o.text);
      expect(new Set(texts).size).toBe(3);
      expect(texts.every((x) => SYL[x])).toBe(true);
      expect(t.options.find((o) => o.ok).text).toBe(t.syl);
      // T/D and M/N have a near partner recorded: it is always one of the two.
      const partner = { T: "D", D: "T", M: "N" }[t.syl[0]];
      if (partner) expect(texts).toContain(partner + t.syl[1]);
      expect(texts.some((x) => x[0] === t.syl[0] && x !== t.syl)).toBe(true);
    }
  });

  it("«Слоги» without recorded syllables of the picked letters explains what to add", () => {
    const SYL = { GA: "a", GO: "b", GU: "c" };
    expect(generateTasks({ type: "lb_syll", syllables: SYL, near: NEAR }, G1, 500, {})[0].type).toBe("lb_need_more");
  });

  it("only words whose letters are all picked can be read", () => {
    expect(readableWords(WORDS, G1).map((w) => w.id)).toEqual([]);
    expect(readableWords(WORDS, [...G1, ...G2]).map((w) => w.id)).toEqual(["sok", "voda"]);
    expect(readableWords(WORDS, [...G1, ...G2, ...G3]).map((w) => w.id)).toEqual(["sok", "voda", "caj"]);
  });

  it("«Слова»: the word, its transliteration, and two pictures; explains when no word is readable", () => {
    expect(generateTasks({ type: "lb_word", words: WORDS }, G1, 500, {})[0].type).toBe("lb_need_more");
    const [t] = generateTasks({ type: "lb_word", words: WORDS }, [...G1, ...G2], 500, { hint: "faint" });
    expect(["sok", "voda"]).toContain(t.word.id);
    expect(t.translit).toBe(t.word.ru);
    expect(t.hint).toBe("faint");
    expect(t.options).toHaveLength(2);
    expect(t.options.find((o) => o.ok).word.id).toBe(t.word.id);
  });

  it("«Собери слово»: the word's letters plus near-letter extras from the picked set", () => {
    const tasks = generateTasks({ type: "lb_build", words: WORDS, near: NEAR }, [...G1, ...G2, ...G3], 500, { taskCount: 6 });
    for (const t of tasks) {
      const extra = [...t.tiles];
      for (const c of t.word.sl) extra.splice(extra.indexOf(c), 1);
      expect(extra.length).toBeLessThanOrEqual(2);
      for (const c of extra) expect(t.word.sl).not.toContain(c);
    }
  });

  it("cycle never repeats an item back to back", () => {
    for (let run = 0; run < 20; run++) {
      const out = cycle(["a", "b"], 9);
      out.forEach((x, i) => { if (i) expect(x).not.toBe(out[i - 1]); });
    }
  });

  describe("«Учим алфавит»", () => {
    const ALL = [...G1, ...G2, ...G3, ...G4];
    const MODE = { type: "lb_alphabet", blocks: [{ id: "g1", title: "Друзья" }, { id: "g2", title: "Звук тот же" }, { id: "g3", title: "Шапочки" }, { id: "g4", title: "Ловушки" }], twins: { B: "В", C: "С", H: "Н", P: "Р" } };

    it("goes block by block: 3 shown, then those 3 checked by ear twice each, a screen between blocks", () => {
      const tasks = alphabetTasks(MODE, ALL, {});
      const ends = tasks.filter((t) => t.type === "lb_block_end");
      expect(ends.map((t) => t.block)).toEqual(["g1", "g2", "g3", "g4"]);
      expect(ends.map((t) => t.next)).toEqual(["Звук тот же", "Шапочки", "Ловушки", null]);
      expect(tasks.slice(0, 3).map((t) => t.type)).toEqual(["lb_pair", "lb_pair", "lb_pair"]);
      const shown = tasks.slice(0, 3).map((t) => t.card.sl);
      const checks = tasks.slice(3, 9);
      expect(checks.every((t) => t.type === "lb_listen" && shown.includes(t.card.sl))).toBe(true);
      checks.forEach((t) => t.options.forEach((o) => expect(shown).toContain(o.sl)));
      // Every letter is shown once, in its own block.
      const pairs = tasks.filter((t) => t.type === "lb_pair");
      expect(pairs).toHaveLength(ALL.length);
      pairs.forEach((t) => expect(t.block).toBe(t.card.group));
    });

    it("the video comes for a finished block: only each block's last check carries rewardAfter; its checks carry 5 stars", () => {
      const tasks = alphabetTasks(MODE, ALL, {});
      for (const b of ["g1", "g2", "g3", "g4"]) {
        expect(tasks.filter((t) => t.block === b).reduce((n, t) => n + (t.blockStars ?? 0), 0)).toBe(5);
      }
      tasks.forEach((t, i) => {
        expect(Boolean(t.rewardAfter)).toBe(tasks[i + 1]?.type === "lb_block_end");
      });
    });

    it("traps are checked by ear against the letter they are misread as, both ways", () => {
      const checks = alphabetTasks(MODE, ALL, { startBlock: "g4" }).filter((t) => t.type === "lb_listen");
      const twinSl = { B: "V", C: "S", H: "N", P: "R" };
      expect(checks).toHaveLength(16);
      checks.forEach((t) => {
        const opts = t.options.map((o) => o.sl).sort();
        const trap = twinSl[t.card.sl] ? t.card.sl : Object.keys(twinSl).find((k) => twinSl[k] === t.card.sl);
        expect(opts).toEqual([trap, twinSl[trap]].sort());
      });
    });

    it("start block, letters per step, introduction only", () => {
      const fromG2 = alphabetTasks(MODE, ALL, { startBlock: "g2", newPerStep: 4, check: "off" });
      expect(fromG2[0].card.group).toBe("g2");
      expect(fromG2.some((t) => t.type === "lb_listen" || t.rewardAfter)).toBe(false);
      expect(fromG2.filter((t) => t.type === "lb_block_end")).toHaveLength(3);
    });
  });
});
