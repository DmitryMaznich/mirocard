import { describe, it, expect } from "vitest";
import { selectDistractorConceptIds } from "./distractorEngine";
import { deriveConcepts } from "./topicUtils";

const CARDS = [
  { id: "tshirt_1", conceptId: "tshirt", primary: true, label: "футболка", tags: ["top", "casual"] },
  { id: "jacket_1", conceptId: "jacket", primary: true, label: "куртка",   tags: ["top", "warm"]   },
  { id: "skirt_1",  conceptId: "skirt",  primary: true, label: "юбка",     tags: ["bottom"]        },
  { id: "hat_1",    conceptId: "hat",    primary: true, label: "шляпа",    tags: ["accessory"]     },
  { id: "scarf_1",  conceptId: "scarf",  primary: true, label: "шарф",     tags: ["accessory", "warm"] },
];

describe("selectDistractorConceptIds", () => {
  const concepts = deriveConcepts(CARDS);

  it("returns the requested count of distractors", () => {
    const result = selectDistractorConceptIds("tshirt", concepts, 3);
    expect(result).toHaveLength(3);
  });

  it("never includes the target concept", () => {
    const result = selectDistractorConceptIds("tshirt", concepts, 3);
    expect(result).not.toContain("tshirt");
  });

  it("returns unique concept ids", () => {
    const result = selectDistractorConceptIds("tshirt", concepts, 3);
    expect(new Set(result).size).toBe(3);
  });

  it("works when pool is smaller than requested count (no infinite loop)", () => {
    const tiny = deriveConcepts(CARDS.slice(0, 2));
    const result = selectDistractorConceptIds("tshirt", tiny, 5);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it("medium difficulty prefers concepts sharing 1 tag", () => {
    const result = selectDistractorConceptIds("tshirt", concepts, 1, "medium");
    expect(result[0]).toBe("jacket");
  });

  it("easy difficulty prefers concepts with NO shared tags", () => {
    const result = selectDistractorConceptIds("tshirt", concepts, 1, "easy");
    expect(["skirt", "hat", "scarf"]).toContain(result[0]);
  });
});
