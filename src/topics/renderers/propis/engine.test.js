import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine.js";

const LETTER_CARD = { id: "а", type: "letter", label: "а", strokes: [{ d: "M 0 0 C 1 1 2 2 3 3" }] };
const CONNECTOR_CARD = { id: "conn_4_2", type: "connector", fromLine: 4, toLine: 2, strokes: [{ d: "M 0 0 C 1 1 2 2 3 3" }] };
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
  it("splits cards into letters and connectors by type, same as write_words", () => {
    const tasks = generateTasks({ type: "write_text" }, [LETTER_CARD, CONNECTOR_CARD, CARD_NO_STROKES]);
    expect(tasks).toEqual([{ type: "write_text", letters: [LETTER_CARD], connectors: [CONNECTOR_CARD] }]);
  });
});

describe("generateTasks — unknown mode", () => {
  it("returns an empty array", () => {
    expect(generateTasks({ type: "nope" }, [LETTER_CARD])).toEqual([]);
  });
});
