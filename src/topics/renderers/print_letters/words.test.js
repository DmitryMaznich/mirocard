import { describe, it, expect } from "vitest";
import topic from "../../../../tools/print_letters/topic.json";
import { copyPlan, pageOverflows } from "./model";
import {
  canWrite, plateCells, plateWords, syllableSuggestions, wordCopiesPerRow, wordLadderRows, wordLetters, wordSuggestions, wordWidthCells,
} from "./words";

const byId = Object.fromEntries(topic.cards.map((c) => [c.id, c]));

describe("print_letters syllables and words", () => {
  it("offers only what the drawn letters can write", () => {
    const syl = syllableSuggestions(byId);
    expect(syl).toContain("НИ");
    expect(syl).toContain("ТЕ");
    expect(syl).toContain("НА");
    expect(syl).not.toContain("ШЫ"); // a spelling Russian doesn't use
    expect(syl.every((s) => canWrite(s, byId))).toBe(true);
    const words = wordSuggestions(byId);
    expect(words).toContain("МАМА");
    expect(words.every((w) => canWrite(w, byId))).toBe(true);
    const only = Object.fromEntries(["Н", "Е", "Т", "И", "П", "Ш"].map((id) => [id, byId[id]]));
    expect(syllableSuggestions(only)).not.toContain("НА"); // only drawn letters are offered
    expect(wordSuggestions(only)).toEqual(["НЕТ", "ТИП", "ШИП", "ТИШЕ", "ТЕНИ"]);
  });

  it("puts every letter in its own letter-cell, a clean letter-cell between words", () => {
    const net = wordLetters("НЕТ", byId);
    expect(wordWidthCells(net, 2)).toBeCloseTo(2 + 2 + 4 / 3); // Т is wide
    const n = wordCopiesPerRow(net, "a4", false, 2, "cell", 4);
    expect(n).toBeGreaterThan(3);
    expect((n - 1) * 8 + wordWidthCells(net, 2)).toBeLessThanOrEqual(36);
  });

  it("grows the plate with the word, at most 14 cells", () => {
    expect(plateCells({ kind: "word", words: ["НИ"] })).toBe(6);
    expect(plateCells({ kind: "word", words: ["НЕТ"] })).toBe(8);
    expect(plateCells({ kind: "word", words: ["НИ", "НЕ", "ТИ", "ТЕ"] })).toBeLessThanOrEqual(14);
    expect(plateWords({ kind: "word", words: ["НИ", "НЕ", "ТИ", "ТЕ"] })).toEqual(["НИ", "НЕ"]);
  });

  it("builds a word ladder: dotted → vowel left out → fading → sample only → blank", () => {
    const rows = wordLadderRows(["НЕТ"]);
    expect(rows.map((r) => [r.elements.join(""), r.line, r.guide])).toEqual([
      ["012", "dash", "full"], ["02", "dash", "full"], ["012", "tone", "fade"], ["012", "tone", "none"], ["", "dash", "full"],
    ]);
    // only the word's first row and the «sample only» row start with a sample (the word doesn't change)
    expect(rows.map((r) => r.sample !== false)).toEqual([true, false, false, true, true]);
    expect(copyPlan(rows[0], 3)[0].variant).toBe("sample");
    expect(copyPlan(rows[1], 3).map((p) => p.variant)).toEqual(["dotted", "dotted", "dotted"]);
    expect(copyPlan({ ...rows[3], sample: false }, 3)[0].variant).toBe("sample"); // «sample only» keeps it
    const fade = copyPlan(rows[2], 6);
    expect(fade[0].opacity).toBe(1);
    expect(fade[5].opacity).toBeCloseTo(0.15);
    const multi = wordLadderRows(["НИ", "НЕ"]);
    expect(multi.map((r) => r.text)).toEqual(["НИ", "НЕ", "НИ", "НЕ", "НИ"]);
    const page = { paper: "cell", blocks: [{ kind: "word", words: ["НЕТ"], size: 2, rows }, { kind: "word", words: ["НИ", "НЕ"], size: 2, rows: multi }] };
    expect(pageOverflows(page, "a4")).toBe(false);
  });
});
