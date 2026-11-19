import { describe, expect, it } from "vitest";
import { allSyllables, lookalikeSyllables, syllablesOf } from "./syllables";
import { generateTasks } from "./engine";

const cards = (letters) => [...letters].map((L) => ({ id: `letter_${L}`, conceptId: L, letter: L }));
const run = (type, letters, params) => generateTasks({ type }, cards(letters), 0, params);

describe("syllables from the learned letters", () => {
  it("every consonant with every vowel", () => {
    expect(syllablesOf([..."МСКАОУ"]).sort()).toEqual(["КА", "КО", "КУ", "МА", "МО", "МУ", "СА", "СО", "СУ"]);
  });
  it("only what Russian writing has", () => {
    const all = allSyllables();
    for (const no of ["ШЫ", "ЖЯ", "ЦЮ", "ЧЯ", "ЩЮ", "КЫ", "ГЫ", "ХЫ", "ЦЁ"]) expect(all).not.toContain(no);
    for (const yes of ["ШИ", "ЖИ", "ЧА", "ЩУ", "ЦА", "КИ"]) expect(all).toContain(yes);
    expect(all).toHaveLength(181);
  });
  it("lookalikes: the reversal first, then the same consonant or vowel", () => {
    const l = lookalikeSyllables("МА", [..."МСКНАОУ"], 5);
    expect(l[0]).toBe("АМ");
    expect(l).not.toContain("МА");
    for (const s of l.slice(1, 3)) expect(s[0] === "М" || s[1] === "А").toBe(true);
  });
});

describe("«Найди букву» with syllables", () => {
  const L = "МСКНАОУ";
  it("Легко: 3 options, the target and 2 sharing no letter with it", () => {
    for (const t of run("pa_find_letter", L, { unit: "syllables", difficulty: "easy" })) {
      expect(t.letter).toHaveLength(2);
      expect(t.options).toHaveLength(3);
      for (const o of t.options.filter((o) => o !== t.letter)) expect([...o].some((ch) => t.letter.includes(ch))).toBe(false);
    }
  });
  it("Средне: 6 different options with the target", () => {
    const t = run("pa_find_letter", L, { unit: "syllables", difficulty: "medium" })[0];
    expect(new Set(t.options).size).toBe(6);
    expect(t.options).toContain(t.letter);
  });
  it("Трудно: a 4×4 field", () => {
    const t = run("pa_find_letter", L, { unit: "syllables", difficulty: "hard" })[0];
    expect(t.field).toHaveLength(16);
    expect(t.cols).toBe(4);
    expect(t.field.filter((x) => x === t.letter)).toHaveLength(t.total);
  });
  it("a deck with recordings uses only voiced syllables", () => {
    const mode = { type: "pa_find_letter", syllableSounds: { МА: "syllables/ма.mp3", МО: "syllables/мо.mp3", СА: "syllables/са.mp3" } };
    const tasks = generateTasks(mode, cards("МСАО"), 0, { unit: "syllables", difficulty: "easy" });
    for (const t of tasks) expect(["МА", "МО", "СА"]).toContain(t.letter);
  });
  it("only vowels learned: asks for a consonant", () => {
    expect(run("pa_find_letter", "АОУ", { unit: "syllables" })[0].type).toBe("pa_need_more");
  });
});

describe("«Что пропало?»", () => {
  it("a row of 3/4/5, the gone card is in it and among 3 options, the others are not in the row", () => {
    for (const [difficulty, n] of [["easy", 3], ["medium", 4], ["hard", 5]]) {
      for (const unit of ["letters", "syllables"]) {
        for (const t of run("pa_missing", "МСКНАОУ", { unit, difficulty })) {
          expect(t.row).toHaveLength(n);
          expect(new Set(t.row).size).toBe(n);
          expect(t.row[t.missing]).toBe(t.letter);
          expect(t.options).toHaveLength(3);
          expect(t.options).toContain(t.letter);
          for (const o of t.options.filter((o) => o !== t.letter)) expect(t.row).not.toContain(o);
        }
      }
    }
  });
  it("too few letters: asks for more", () => {
    expect(run("pa_missing", "МА", { unit: "letters" })[0].type).toBe("pa_need_more");
  });
});
