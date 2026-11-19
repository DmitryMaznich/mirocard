import { describe, it, expect } from "vitest";
import { generateTasks, lottoBoard, distractors } from "./engine";
import WORDS_JSON from "../../../../tools/phonetic_analysis/words.json";

const WORDS = WORDS_JSON.words;
const ALL = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЫЭЮЯ".split("");
const cards = (letters) => letters.map((L) => ({ id: `letter_${L}`, conceptId: L, letter: L }));
const run = (type, letters = ALL, params = {}) => generateTasks({ type, words: WORDS }, cards(letters), 0, params);

describe("scheme steps", () => {
  it("«Где звук?» Начало или конец: all cells open, the sound is first or last, about half each", () => {
    const tasks = run("pa_where", ALL, { position: "edges" });
    expect(tasks).toHaveLength(40);
    for (const t of tasks) {
      expect(t.layout).toBe("cells");
      expect(t.closed).toBeUndefined();
      expect([0, t.letters.length - 1]).toContain(t.answer);
      expect(t.letters[t.answer]).toBe(t.letter);
    }
    expect(tasks.filter((t) => t.answer === 0)).toHaveLength(20);
  });

  it("«Где звук?» carries the letter's sound when the deck has one", () => {
    const mode = { type: "pa_where", words: WORDS, sounds: { А: "sounds/а.mp3" } };
    const tasks = generateTasks(mode, cards(["А", "М"]), 0, { position: "all" });
    for (const t of tasks) expect(t.sound).toBe(t.letter === "А" ? "sounds/а.mp3" : undefined);
  });

  it("lotto «Картинки на буквы»: 9 letter squares, 9 pictures, the squares are exactly the pictures' first letters", () => {
    for (const t of run("pa_lotto", ALL, { direction: "pictures" })) {
      expect(t.type).toBe("pa_lotto_reverse");
      expect(t.pictures).toHaveLength(9);
      expect([...t.letters].sort()).toEqual(t.pictures.map((w) => w.firstLetter).sort());
    }
  });

  it("lotto «Буква: последняя»: each card is the word's last letter, and only clean last sounds", () => {
    for (const direction of ["letters", "pictures"]) {
      for (const t of run("pa_lotto", ALL, { by: "last", direction })) {
        expect(t.by).toBe("last");
        const words = t.board ?? t.pictures;
        for (const w of words) {
          expect(w.lottoLetter).toBe(w.word.at(-1).toUpperCase());
          expect(w.targets.find((x) => x.position === "end")?.letter).toBe(w.lottoLetter);
        }
        expect(words.map((w) => w.word)).not.toContain("мышь");
      }
    }
  });

  it("lotto with only 2 learned letters: the board is full, the letters repeat", () => {
    const t = run("pa_lotto", ["М", "С"])[0];
    expect(t.board).toHaveLength(9);
    expect(new Set(t.cards)).toEqual(new Set(["М", "С"]));
  });

  it("«Буквы в клетки» Последняя буква: the answer is the last cell, where the letter really is", () => {
    for (const t of run("pa_all_letters", ALL, { scope: "last" })) {
      expect(t.answer).toBe(t.letters.length - 1);
      expect(t.letters[t.answer]).toBe(t.letter);
    }
  });

  it("«Где звук?» Везде: the chip's cell holds the letter; about half are inside the word", () => {
    const tasks = run("pa_where", ALL, { position: "all" });
    for (const t of tasks) expect(t.letters[t.answer]).toBe(t.letter);
    expect(tasks.filter((t) => t.answer > 0 && t.answer < t.letters.length - 1).length).toBeGreaterThanOrEqual(16);
  });

  it("only learned letters are asked", () => {
    const learned = ["М", "С", "К"];
    for (const [type, params] of [["pa_where", { position: "edges" }], ["pa_where", { position: "all" }], ["pa_all_letters", { scope: "last" }]]) {
      for (const t of run(type, learned, params)) {
        if (t.type === "pa_need_more") continue;
        expect(learned).toContain(t.letter);
      }
    }
  });

  it("«Буквы в клетки» Всё слово: words made only of learned letters", () => {
    const learned = ["К", "О", "Т", "С", "М", "Н"];
    for (const t of run("pa_all_letters", learned, { scope: "word" })) {
      expect(t.letters.every((c) => learned.includes(c))).toBe(true);
      for (const c of t.letters) expect(t.tray).toContain(c);
    }
  });

  it("asks for more letters instead of failing silently", () => {
    expect(run("pa_all_letters", ["Б"], { scope: "last" })[0].type).toBe("pa_need_more");
  });
});

describe("lotto", () => {
  it("9 pictures and a card for each: the cards are exactly the pictures' first letters", () => {
    for (let i = 0; i < 20; i += 1) {
      const b = lottoBoard(WORDS.filter((w) => w.emoji), ALL);
      expect(b.board).toHaveLength(9);
      expect(new Set(b.board.map((w) => w.id)).size).toBe(9);
      expect([...b.cards].sort()).toEqual(b.board.map((w) => w.firstLetter).sort());
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
