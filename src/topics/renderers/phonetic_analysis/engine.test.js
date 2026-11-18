import { describe, it, expect } from "vitest";
import { generateTasks, lottoBoard, distractors } from "./engine";
import WORDS_JSON from "../../../../tools/phonetic_analysis/words.json";

const WORDS = WORDS_JSON.words;
const ALL = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ".split("");
const cards = (letters) => letters.map((L) => ({ id: `letter_${L}`, conceptId: L, letter: L }));
const run = (type, letters = ALL, params = {}) => generateTasks({ type, words: WORDS }, cards(letters), 0, params);

describe("scheme steps", () => {
  it("step 1: half the words start with the sound, answer is cell 0 or the bar", () => {
    const tasks = run("pa_sound_start", ALL, { taskCount: 10 });
    expect(tasks).toHaveLength(10);
    for (const t of tasks) {
      const pos = t.word.targets.find((x) => x.letter === t.letter).position;
      expect(t.answer).toBe(pos === "start" ? 0 : "bar");
      expect(t.word.aligned).toBe(true);
    }
    expect(tasks.filter((t) => t.answer === 0)).toHaveLength(5);
  });

  it("lotto «Картинки на буквы»: 6 letters, 4 pictures, each picture's first letter is on the board", () => {
    for (const t of run("pa_lotto", ALL, { direction: "pictures" })) {
      expect(t.type).toBe("pa_lotto_reverse");
      expect(t.pictures).toHaveLength(4);
      expect(t.letters).toHaveLength(6);
      expect(new Set(t.letters).size).toBe(6);
      for (const w of t.pictures) expect(t.letters).toContain(w.firstLetter);
      expect(new Set(t.pictures.map((w) => w.firstLetter)).size).toBe(4);
    }
  });

  it("lotto «Картинки на буквы» with only 2 learned letters still has spare letters", () => {
    const t = run("pa_lotto", ["М", "С"], { direction: "pictures" })[0];
    expect(t.pictures).toHaveLength(2);
    expect(t.letters.length).toBeGreaterThan(2);
  });

  it("step 3 and 4: the answer is the first or last cell, where the letter really is", () => {
    for (const t of [...run("pa_last_letter"), ...run("pa_start_end")]) {
      expect([0, t.letters.length - 1]).toContain(t.answer);
      expect(t.letters[t.answer]).toBe(t.letter);
    }
  });

  it("step 5: the chip's cell holds the letter; about half are inside the word", () => {
    const tasks = run("pa_where", ALL, { taskCount: 10 });
    for (const t of tasks) expect(t.letters[t.answer]).toBe(t.letter);
    expect(tasks.filter((t) => t.answer > 0 && t.answer < t.letters.length - 1).length).toBeGreaterThanOrEqual(4);
  });

  it("only learned letters are asked", () => {
    const learned = ["М", "С", "К"];
    for (const type of ["pa_sound_start", "pa_last_letter", "pa_where"]) {
      for (const t of run(type, learned)) {
        if (t.type === "pa_need_more") continue;
        expect(learned).toContain(t.letter);
      }
    }
  });

  it("step 6: words made only of learned letters", () => {
    const learned = ["К", "О", "Т", "С", "М", "Н"];
    for (const t of run("pa_all_letters", learned)) {
      expect(t.letters.every((c) => learned.includes(c))).toBe(true);
      for (const c of t.letters) expect(t.tray).toContain(c);
    }
  });

  it("asks for more letters instead of failing silently", () => {
    expect(run("pa_last_letter", ["Б"])[0].type).toBe("pa_need_more");
  });
});

describe("lotto", () => {
  it("9 pictures, 4 letters, each letter's picture is on the board and no other picture starts with it", () => {
    for (let i = 0; i < 20; i += 1) {
      const b = lottoBoard(WORDS.filter((w) => w.emoji), ALL);
      expect(b.board).toHaveLength(9);
      expect(b.pairs).toHaveLength(4);
      for (const p of b.pairs) {
        const starting = b.board.filter((w) => w.firstLetter === p.letter);
        expect(starting.map((w) => w.id)).toEqual([p.wordId]);
      }
    }
  });
});

describe("letter games", () => {
  it("find letter: easy has 3 options, medium 6", () => {
    expect(run("pa_find_letter", ALL, { difficulty: "easy" })[0].options).toHaveLength(3);
    const t = run("pa_find_letter", ALL, { difficulty: "medium" })[0];
    expect(t.options).toContain(t.letter);
    expect(t.options).toHaveLength(6);
    expect(new Set(t.options).size).toBe(6);
  });

  it("find letter «Трудно» is the 5×5 field with exactly `total` copies", () => {
    for (const t of run("pa_find_letter", ALL, { difficulty: "hard" })) {
      expect(t.type).toBe("pa_find_all");
      expect(t.field).toHaveLength(25);
      expect(t.field.filter((c) => c === t.letter)).toHaveLength(t.total);
    }
  });

  it("distractors never repeat the target", () => {
    expect(distractors("Б", ALL, 5)).not.toContain("Б");
    expect(distractors("Б", ["Б"], 2)).toHaveLength(2);
  });
});
