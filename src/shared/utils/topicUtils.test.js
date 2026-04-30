import { describe, it, expect } from "vitest";
import { deriveConcepts, getPrimaryCard } from "./topicUtils";

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

describe("getPrimaryCard", () => {
  it("returns the primary card for a conceptId", () => {
    const primary = getPrimaryCard(CARDS, "tshirt");
    expect(primary.id).toBe("tshirt_1");
  });

  it("returns null for unknown conceptId", () => {
    expect(getPrimaryCard(CARDS, "hat")).toBeNull();
  });
});
