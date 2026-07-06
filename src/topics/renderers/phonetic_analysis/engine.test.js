import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  {
    id: "word_кот", word: "кот", emoji: "🐱", image: "media/word_кот.svg",
    targetLetterFirst: "к", targetLetterLast: "т",
    positionWords: [{ targetLetter: "к", position: "start" }, { targetLetter: "т", position: "end" }],
    blanks: [{ blankIndex: 2, targetLetter: "т" }],
    difficultyTier: 1,
  },
  {
    id: "word_ваза", word: "ваза", emoji: "🏺", image: "media/word_ваза.svg",
    targetLetterFirst: "в", // targetLetterLast намеренно отсутствует — безударное конечное "а"
    positionWords: [{ targetLetter: "в", position: "start" }, { targetLetter: "з", position: "middle" }],
    blanks: [{ blankIndex: 2, targetLetter: "з" }],
    difficultyTier: 1,
  },
  {
    id: "word_чай", word: "чай", emoji: "🍵", image: "media/word_чай.svg",
    targetLetterFirst: "ч", targetLetterLast: "й",
    positionWords: [{ targetLetter: "ч", position: "start" }],
    blanks: [{ blankIndex: 0, targetLetter: "ч" }],
    difficultyTier: 1,
  },
];

describe("generateTasks — first_sound", () => {
  it("produces one task per word", () => {
    expect(generateTasks("first_sound", CARDS)).toHaveLength(3);
  });

  it("each task has 3 options with exactly one target matching targetLetter (uppercased)", () => {
    for (const t of generateTasks("first_sound", CARDS)) {
      expect(t.type).toBe("first_sound");
      expect(t.options).toHaveLength(3);
      const targets = t.options.filter((o) => o.isTarget);
      expect(targets).toHaveLength(1);
      expect(targets[0].letter).toBe(t.targetLetter.toUpperCase());
    }
  });
});

describe("generateTasks — last_sound", () => {
  it("skips words without targetLetterLast (ваза)", () => {
    const tasks = generateTasks("last_sound", CARDS);
    expect(tasks).toHaveLength(2);
    expect(tasks.some((t) => t.word === "ваза")).toBe(false);
  });
});

describe("generateTasks — sound_position", () => {
  it("produces one task per positionWords entry (2+2+1=5)", () => {
    expect(generateTasks("sound_position", CARDS)).toHaveLength(5);
  });

  it("correctPosition is one of start/middle/end", () => {
    for (const t of generateTasks("sound_position", CARDS)) {
      expect(["start", "middle", "end"]).toContain(t.correctPosition);
    }
  });
});

describe("generateTasks — missing_letter", () => {
  it("produces one task per blanks entry", () => {
    expect(generateTasks("missing_letter", CARDS)).toHaveLength(3);
  });

  it("options are lowercase and include the target letter", () => {
    for (const t of generateTasks("missing_letter", CARDS)) {
      expect(t.options.every((o) => o.letter === o.letter.toLowerCase())).toBe(true);
      expect(t.options.some((o) => o.isTarget && o.letter === t.targetLetter)).toBe(true);
    }
  });
});
