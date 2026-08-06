import { describe, it, expect } from "vitest";
import { deriveConcepts, getConceptCards, getPrimaryCard } from "./topicUtils";

const CARDS = [
  { id: "tshirt_1", conceptId: "tshirt", primary: true,  label: "футболка", image: "media/tshirt_1.webp", tags: ["top", "casual"] },
  { id: "tshirt_2", conceptId: "tshirt", primary: false, image: "media/tshirt_2.webp" },
  { id: "jacket_1", conceptId: "jacket", primary: true,  label: "куртка",   image: "media/jacket_1.webp", tags: ["top", "warm"] },
  { id: "skirt_1",  conceptId: "skirt",  primary: true,  label: "юбка",     image: "media/skirt_1.webp",  tags: ["bottom"] },
];

describe("deriveConcepts", () => {
  it("returns one concept per unique conceptId", () => {
    const concepts = deriveConcepts(CARDS);
    expect(concepts).toHaveLength(3);
    expect(concepts.map((c) => c.conceptId)).toEqual(["tshirt", "jacket", "skirt"]);
  });

  it("groups all cards under their concept", () => {
    const concepts = deriveConcepts(CARDS);
    const tshirt = concepts.find((c) => c.conceptId === "tshirt");
    expect(tshirt.cards).toHaveLength(2);
  });

  it("sets primary to the card with primary: true", () => {
    const concepts = deriveConcepts(CARDS);
    const tshirt = concepts.find((c) => c.conceptId === "tshirt");
    expect(tshirt.primary.id).toBe("tshirt_1");
  });

  it("preserves card order (concept order = first card position)", () => {
    const reversed = [...CARDS].reverse();
    const concepts = deriveConcepts(reversed);
    expect(concepts[0].conceptId).toBe("skirt");
  });
});

describe("getConceptCards", () => {
  const wordAgreementRecord = {
    meta: { renderer: "word_agreement" },
    cards: [
      { id: "case_1", skill: "case_agreement" },
      { id: "case_2", skill: "case_agreement" },
      { id: "numeral_1", skill: "numeral_agreement" },
    ],
  };

  it("filters word_agreement cards down to the current mode's skill", () => {
    const cards = getConceptCards(wordAgreementRecord, { type: "numeral_agreement" });
    expect(cards.map((c) => c.id)).toEqual(["numeral_1"]);
  });

  it("returns all cards for other renderers unchanged", () => {
    const record = { meta: { renderer: "flashcards" }, cards: CARDS };
    expect(getConceptCards(record, { type: "anything" })).toBe(CARDS);
  });

  it("returns all cards when mode is missing (e.g. still loading)", () => {
    expect(getConceptCards(wordAgreementRecord, undefined)).toBe(wordAgreementRecord.cards);
  });

  const symmetryDrawRecord = {
    meta: { renderer: "flashcards", customModesOnly: true },
    cards: [
      { id: "m1", conceptId: "m1", taskKind: "mirror" },
      { id: "r1", conceptId: "r1", taskKind: "repeat" },
      { id: "d1", conceptId: "d1", taskKind: "dictation" },
    ],
  };

  it("scopes mirror_draw to taskKind:mirror cards only", () => {
    const cards = getConceptCards(symmetryDrawRecord, { type: "mirror_draw" });
    expect(cards.map((c) => c.id)).toEqual(["m1"]);
  });

  it("scopes repeat_draw to taskKind:repeat cards only", () => {
    const cards = getConceptCards(symmetryDrawRecord, { type: "repeat_draw" });
    expect(cards.map((c) => c.id)).toEqual(["r1"]);
  });

  it("scopes graphic_dictation to taskKind:dictation cards only", () => {
    const cards = getConceptCards(symmetryDrawRecord, { type: "graphic_dictation" });
    expect(cards.map((c) => c.id)).toEqual(["d1"]);
  });
});

describe("getPrimaryCard", () => {
  it("returns the primary card for a conceptId", () => {
    const primary = getPrimaryCard(CARDS, "tshirt");
    expect(primary.id).toBe("tshirt_1");
  });

  it("returns null for unknown conceptId", () => {
    expect(getPrimaryCard(CARDS, "hat")).toBeNull();
  });
});
