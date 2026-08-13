import { describe, it, expect } from "vitest";
import {
  deriveConcepts, getConceptCards, getPrimaryCard,
  isConceptSelectionScopedByMode, readModeSelectedConceptIds, writeModeSelectedConceptIds,
} from "./topicUtils";

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
      { id: "c1", conceptId: "c1", taskKind: "coordinate" },
      { id: "n1", conceptId: "n1", taskKind: "navigator" },
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

  it("scopes coordinate_dictation to taskKind:coordinate cards only", () => {
    const cards = getConceptCards(symmetryDrawRecord, { type: "coordinate_dictation" });
    expect(cards.map((c) => c.id)).toEqual(["c1"]);
  });

  it("scopes navigator to its direction-drill metadata card", () => {
    const cards = getConceptCards(symmetryDrawRecord, { type: "navigator" });
    expect(cards.map((c) => c.id)).toEqual(["n1"]);
  });
});

describe("mode-scoped concept selection", () => {
  const symmetryDrawRecord = {
    meta: { renderer: "flashcards", customModesOnly: true },
    cards: [
      { id: "m1", conceptId: "m1", taskKind: "mirror" },
      { id: "m2", conceptId: "m2", taskKind: "mirror" },
      { id: "d1", conceptId: "d1", taskKind: "dictation" },
      { id: "d2", conceptId: "d2", taskKind: "dictation" },
    ],
  };
  const mirrorMode = { id: "symmetry_draw", type: "mirror_draw" };
  const dictationMode = { id: "graphic_dictation", type: "graphic_dictation" };
  const genericRecord = { meta: { renderer: "flashcards" }, cards: CARDS };
  const genericMode = { id: "only_mode", type: "anything" };

  it("isConceptSelectionScopedByMode is true when the mode only sees part of the topic", () => {
    expect(isConceptSelectionScopedByMode(symmetryDrawRecord, mirrorMode)).toBe(true);
  });

  it("isConceptSelectionScopedByMode is false for topics with one shared card pool", () => {
    expect(isConceptSelectionScopedByMode(genericRecord, genericMode)).toBe(false);
  });

  it("readModeSelectedConceptIds returns raw ids unchanged for a non-scoped topic", () => {
    expect(readModeSelectedConceptIds(genericRecord, genericMode, ["tshirt"])).toEqual(["tshirt"]);
  });

  it("writeModeSelectedConceptIds passes ids through unchanged for a non-scoped topic", () => {
    expect(writeModeSelectedConceptIds(genericRecord, genericMode, ["tshirt"], ["jacket"])).toEqual(["jacket"]);
  });

  it("writing a mode's selection does not clobber another mode's previously saved selection", () => {
    // Dictation mode saves first.
    const afterDictation = writeModeSelectedConceptIds(symmetryDrawRecord, dictationMode, null, ["d1"]);
    expect(afterDictation).toEqual(["graphic_dictation::d1"]);

    // Mirror mode then saves its own selection on top of the stored array.
    const afterMirror = writeModeSelectedConceptIds(symmetryDrawRecord, mirrorMode, afterDictation, ["m1", "m2"]);
    expect(afterMirror).toEqual(expect.arrayContaining(["graphic_dictation::d1", "symmetry_draw::m1", "symmetry_draw::m2"]));
    expect(afterMirror).toHaveLength(3);

    // Reading each mode back out of the combined array only returns its own ids.
    expect(readModeSelectedConceptIds(symmetryDrawRecord, dictationMode, afterMirror)).toEqual(["d1"]);
    expect(readModeSelectedConceptIds(symmetryDrawRecord, mirrorMode, afterMirror)).toEqual(["m1", "m2"]);
  });

  it("readModeSelectedConceptIds returns null when nothing has been saved for this mode yet", () => {
    const afterDictation = writeModeSelectedConceptIds(symmetryDrawRecord, dictationMode, null, ["d1"]);
    expect(readModeSelectedConceptIds(symmetryDrawRecord, mirrorMode, afterDictation)).toBeNull();
  });

  it("readModeSelectedConceptIds returns null for an empty/missing raw selection", () => {
    expect(readModeSelectedConceptIds(symmetryDrawRecord, mirrorMode, null)).toBeNull();
    expect(readModeSelectedConceptIds(symmetryDrawRecord, mirrorMode, [])).toBeNull();
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
