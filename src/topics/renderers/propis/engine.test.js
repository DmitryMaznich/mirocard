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

describe("generateTasks — read_lines", () => {
  it("trims/drops blank lines, defaults useElements to false and elements to [] when cards is a plain array", () => {
    const tasks = generateTasks({ type: "read_lines" }, [LETTER_CARD, CONNECTOR_CARD], 1, { lines: [" мама ", "", "  ", "папа"] });
    expect(tasks).toEqual([{
      type: "print_page",
      letters: [LETTER_CARD],
      connectors: [CONNECTOR_CARD],
      punctuation: [],
      lines: ["мама", "папа"],
      useElements: false,
      elements: [],
      wideRows: false,
      wideGlyphs: [],
    }]);
  });

  // "Элементы букв" (2026-09-17): elements come from the full topicRecord's own `.elements`
  // bank (bundled into the deck by build-propis-deck.mjs), same as words/texts for "Диктант" —
  // absent (-> []) for a plain-array `cards`, since no other propis mode ever had this bank.
  it("passes through sessionParams.useElements and the topicRecord's elements bank", () => {
    const ELEMENT = { id: "05_kryuchok_vlevo", labelRu: "Крючок влево", strokes: [] };
    const topicRecord = { cards: [LETTER_CARD], elements: [ELEMENT] };
    const tasks = generateTasks({ type: "read_lines" }, topicRecord, 1, {
      lines: ["05_kryuchok_vlevo"],
      useElements: true,
    });
    expect(tasks[0].useElements).toBe(true);
    expect(tasks[0].elements).toEqual([ELEMENT]);
    expect(tasks[0].lines).toEqual(["05_kryuchok_vlevo"]);
  });
});

describe("generateTasks — unknown mode", () => {
  it("returns an empty array", () => {
    expect(generateTasks({ type: "nope" }, [LETTER_CARD])).toEqual([]);
  });
});

describe("generateTasks — letter-recognition modes (merged from «Письменные буквы»)", () => {
  it("letters_recognize maps direction onto the matching task type", () => {
    const toWritten = generateTasks({ type: "letters_recognize" }, [], 500, {});
    expect(toWritten.length).toBeGreaterThan(0);
    expect(new Set(toWritten.map((t) => t.type))).toEqual(new Set(["match_print_to_written"]));

    const toPrint = generateTasks({ type: "letters_recognize" }, [], 500, { direction: "written_to_print" });
    expect(new Set(toPrint.map((t) => t.type))).toEqual(new Set(["match_written_to_print"]));

    const mix = generateTasks({ type: "letters_recognize" }, [], 500, { direction: "mix" });
    expect(new Set(mix.map((t) => t.type))).toEqual(new Set(["match_print_to_written", "match_written_to_print"]));
    expect(mix).toHaveLength(toWritten.length + toPrint.length);
  });

  it("letters_case switches between sorting and case pairs", () => {
    const sort = generateTasks({ type: "letters_case" }, [], 500, {});
    expect(sort.every((t) => t.type === "sort_case")).toBe(true);
    // 30 letters with both cases + ъ, ы, ь lowercase only
    expect(sort).toHaveLength(30 * 2 + 3);

    const pair = generateTasks({ type: "letters_case" }, [], 500, { variant: "pair", second_step: true });
    expect(pair.every((t) => t.type === "match_pair" && t.secondStep)).toBe(true);
    expect(pair).toHaveLength(30);
  });

  it("letters_alphabet returns the single alphabet screen", () => {
    const tasks = generateTasks({ type: "letters_alphabet" }, [], 500, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("alphabet_pairs");
    expect(tasks[0].pairs).toHaveLength(30);
  });
});
