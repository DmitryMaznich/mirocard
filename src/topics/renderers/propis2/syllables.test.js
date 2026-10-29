import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { syllabify, wordSyllables, syllableDictationKey } from "./syllables.js";

describe("propis2 dictation: syllables", () => {
  it("splits by the school rule", () => {
    const cases = { молоко: "мо-ло-ко", кошка: "ко-шка", лампа: "лам-па", коньки: "конь-ки", майка: "май-ка", молния: "мол-ни-я", ванна: "ван-на", семья: "се-мья", кот: "кот", ёж: "ёж", Маша: "ма-ша", яблоко: "я-бло-ко" };
    for (const [w, want] of Object.entries(cases)) expect(syllabify(w).join("-")).toBe(want);
  });

  it("a word's own `syl` wins; every deck word gets syllables that spell it", () => {
    const topic = JSON.parse(readFileSync("tools/propis2/topic.json", "utf-8"));
    expect(wordSyllables(topic.words.find((w) => w.word === "футболка"))).toEqual(["фут", "бол", "ка"]);
    for (const w of topic.words) expect(wordSyllables(w).join("")).toBe(w.word.toLowerCase());
  });

  it("keys are lowercase", () => expect(syllableDictationKey("Ма")).toBe("syl_ма"));
});
