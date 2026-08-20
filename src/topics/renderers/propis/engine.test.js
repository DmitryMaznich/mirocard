import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine.js";

const LETTER_CARD = { id: "а", type: "letter", label: "а", strokes: [{ d: "M 0 0 C 1 1 2 2 3 3" }] };
const CONNECTOR_CARD = { id: "conn_4_2", type: "connector", fromLine: 4, toLine: 2, strokes: [{ d: "M 0 0 C 1 1 2 2 3 3" }] };
const PUNCTUATION_CARD = { id: ".", type: "punctuation", label: ".", strokes: [{ d: "M 0 0 C 1 1 2 2 3 3" }] };
const CARD_NO_STROKES = { id: "я", type: "letter", label: "я", strokes: [] };

describe("generateTasks — practice/show (existing behavior)", () => {
  it("practice mode returns only letter-type cards with strokes as items", () => {
    const tasks = generateTasks({ type: "practice" }, [LETTER_CARD, CONNECTOR_CARD, CARD_NO_STROKES]);
    expect(tasks).toEqual([{ type: "practice", items: [LETTER_CARD] }]);
  });

  it("show mode returns only letter-type cards with strokes as items", () => {
    const tasks = generateTasks({ type: "show" }, [LETTER_CARD, CONNECTOR_CARD]);
    expect(tasks).toEqual([{ type: "show", items: [LETTER_CARD] }]);
  });
});

describe("generateTasks — write_words", () => {
  it("splits cards into letters and connectors by type", () => {
    const tasks = generateTasks({ type: "write_words" }, [LETTER_CARD, CONNECTOR_CARD, CARD_NO_STROKES]);
    expect(tasks).toEqual([{ type: "write_words", letters: [LETTER_CARD], connectors: [CONNECTOR_CARD] }]);
  });

  it("returns empty arrays when there are no cards of either type", () => {
    const tasks = generateTasks({ type: "write_words" }, []);
    expect(tasks).toEqual([{ type: "write_words", letters: [], connectors: [] }]);
  });
});

describe("generateTasks — write_text", () => {
  it("splits cards into letters and connectors by type, same as write_words, with an empty initialText when no sessionParams are passed at all", () => {
    const tasks = generateTasks({ type: "write_text" }, [LETTER_CARD, CONNECTOR_CARD, CARD_NO_STROKES]);
    expect(tasks).toEqual([{ type: "write_text", letters: [LETTER_CARD], connectors: [CONNECTOR_CARD], punctuation: [], initialText: "" }]);
  });

  it("defaults initialText to empty when sessionParams is passed but has no customText", () => {
    const tasks = generateTasks({ type: "write_text" }, [LETTER_CARD], 1, {});
    expect(tasks[0].initialText).toBe("");
  });

  it("uses sessionParams.customText as initialText when present", () => {
    const tasks = generateTasks({ type: "write_text" }, [LETTER_CARD], 1, { customText: "мама мыла раму" });
    expect(tasks[0].initialText).toBe("мама мыла раму");
  });

  // Punctuation is captured ink but explicitly NOT a letter (2026-08-20 user correction: "их
  // не нужно соединять") — it must land in its own `punctuation` array, never in `letters`,
  // so it can never be swept into buildWordTrajectory's letter-chaining machinery.
  it("puts punctuation-type cards into their own array, separate from letters", () => {
    const tasks = generateTasks({ type: "write_text" }, [LETTER_CARD, PUNCTUATION_CARD, CONNECTOR_CARD]);
    expect(tasks[0].letters).toEqual([LETTER_CARD]);
    expect(tasks[0].punctuation).toEqual([PUNCTUATION_CARD]);
  });
});

describe("generateTasks — read_text", () => {
  it("splits cards into letters/connectors/punctuation and passes through sessionParams.texts", () => {
    const tasks = generateTasks({ type: "read_text" }, [LETTER_CARD, PUNCTUATION_CARD, CONNECTOR_CARD], 1, { texts: ["t01"] });
    expect(tasks).toEqual([{
      type: "read_text",
      letters: [LETTER_CARD],
      connectors: [CONNECTOR_CARD],
      punctuation: [PUNCTUATION_CARD],
      texts: ["t01"],
    }]);
  });

  it("defaults texts to an empty array when sessionParams has none", () => {
    const tasks = generateTasks({ type: "read_text" }, [LETTER_CARD]);
    expect(tasks[0].texts).toEqual([]);
  });
});

describe("generateTasks — unknown mode", () => {
  it("returns an empty array", () => {
    expect(generateTasks({ type: "nope" }, [LETTER_CARD])).toEqual([]);
  });
});
