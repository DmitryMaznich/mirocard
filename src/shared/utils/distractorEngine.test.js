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

describe("selectDistractorConceptIds — semantic.group1/2/3 (emotions_v2-style cards)", () => {
  // shame and sadness match on all three axes (negative/low/facial) - the
  // audit's own example of a pair that plain valence tags treat as no more
  // confusable than shame-vs-anger, even though shame-vs-sadness is the
  // pair a child actually mixes up. anger matches shame on valence only
  // (group1); joy matches on none of the three axes.
  const CARDS = [
    { id: "shame_1",   conceptId: "shame",   primary: true, label: "стыд",    tags: ["emotions", "negative"], semantic: { group1: "negative", group2: "low",  group3: "facial" } },
    { id: "sadness_1", conceptId: "sadness", primary: true, label: "грусть",  tags: ["emotions", "negative"], semantic: { group1: "negative", group2: "low",  group3: "facial" } },
    { id: "anger_1",   conceptId: "anger",   primary: true, label: "злость",  tags: ["emotions", "negative"], semantic: { group1: "negative", group2: "high", group3: "postural" } },
    { id: "joy_1",     conceptId: "joy",     primary: true, label: "радость", tags: ["emotions", "positive"], semantic: { group1: "positive", group2: "high", group3: "postural" } },
  ];
  const concepts = deriveConcepts(CARDS);

  it("hard difficulty picks the 3-axis match (sadness) over the 1-axis match (anger)", () => {
    const result = selectDistractorConceptIds("shame", concepts, 1, "hard");
    expect(result[0]).toBe("sadness");
  });

  it("medium difficulty picks the 1-axis match (anger), not the 3-axis or 0-axis one", () => {
    const result = selectDistractorConceptIds("shame", concepts, 1, "medium");
    expect(result[0]).toBe("anger");
  });

  it("easy difficulty picks the 0-axis match (joy)", () => {
    const result = selectDistractorConceptIds("shame", concepts, 1, "easy");
    expect(result[0]).toBe("joy");
  });

  it("falls back to tag counting when semantic is missing on either card (other topics are unaffected)", () => {
    const mixed = deriveConcepts([
      { id: "a_1", conceptId: "a", primary: true, label: "a", tags: ["x", "y"], semantic: { group1: "negative", group2: "low", group3: "facial" } },
      { id: "b_1", conceptId: "b", primary: true, label: "b", tags: ["x", "y"] }, // no semantic
      { id: "c_1", conceptId: "c", primary: true, label: "c", tags: ["x"] },
    ]);
    // b shares 2 tags with a (would be "hard" by tag count); a has semantic
    // but b doesn't, so the pair must fall back to tags, not silently score 0.
    const result = selectDistractorConceptIds("a", mixed, 1, "hard");
    expect(result[0]).toBe("b");
  });
});

describe("selectDistractorConceptIds — semantic object without group1/2/3 (people_names-style cards)", () => {
  // people_names cards set `semantic: { age, category }` — a real semantic
  // object, but not the group1/2/3 axes semanticMatchCount uses. Before the
  // fix, every pair was scored as having zero shared semantic axes, silently
  // bypassing the informative tags below.
  const CARDS = [
    { id: "boy_1",  conceptId: "boy",  primary: true, label: "мальчик", tags: ["children", "people", "primary"], semantic: { age: "child", category: "boy" } },
    { id: "girl_1", conceptId: "girl", primary: true, label: "девочка", tags: ["children", "people", "primary"], semantic: { age: "child", category: "girl" } },
    { id: "man_1",  conceptId: "man",  primary: true, label: "мужчина", tags: ["people"], semantic: { age: "adult", category: "man" } },
  ];
  const concepts = deriveConcepts(CARDS);

  it("falls back to tag counting instead of scoring every pair as equally close", () => {
    // Boy shares all three tags with girl, but only one with man. Before the
    // fallback fix, both had zero semantic matches and were shuffled together.
    for (let i = 0; i < 20; i++) {
      expect(selectDistractorConceptIds("boy", concepts, 1, "hard")[0]).toBe("girl");
    }
  });
});
