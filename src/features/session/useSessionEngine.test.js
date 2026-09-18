import { describe, expect, it } from "vitest";
import { cardsForRenderer, resolveModeSelection } from "./useSessionEngine";
import { generateTasks } from "@/topics/renderers/spatial_prepositions/engine";
import { withFigureFilter } from "@/shared/utils/topicUtils";

const cards = [
  { id: "in-1", conceptId: "spatial_in", relation: "in", image: "in-1", contrastImage: "on-1" },
  { id: "on-1", conceptId: "spatial_on", relation: "on", image: "on-1", contrastImage: "in-1" },
  { id: "under-1", conceptId: "spatial_under", relation: "under", image: "under-1", contrastImage: "on-1" },
];

const mode = {
  type: "spatial_recognize",
  params: { relations: { type: "enum_multi" } },
};

describe("cardsForRenderer", () => {
  it("ignores a legacy generic concept selection for spatial prepositions", () => {
    const topicRecord = { meta: { renderer: "spatial_prepositions" }, cards };
    const { cards: suppliedCards } = cardsForRenderer(topicRecord, mode, ["spatial_in"]);
    const tasks = generateTasks(mode, suppliedCards, 500, { relations: ["spatial_under"] });

    expect(suppliedCards).toHaveLength(3);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].card.relation).toBe("under");
  });
});

describe("resolveModeSelection", () => {
  it("keeps every manually selected symmetry figure even when cards are not primary", () => {
    const mode = { id: "symmetry_draw", type: "mirror_draw" };
    const topicRecord = {
      meta: { id: "symmetry_draw", renderer: "flashcards" },
      cards: ["yachta", "butterfly", "crown", "heart", "boat"].map((id, index) => ({
        id,
        conceptId: id,
        primary: index < 3,
        taskKind: "mirror",
      })),
    };
    const params = withFigureFilter({}, mode, {
      type: "manual",
      cardIds: ["yachta", "butterfly", "crown", "heart", "boat"],
    });

    const result = resolveModeSelection(topicRecord, mode, {
      params,
      selectedConceptIds: ["symmetry_draw:all::yachta"],
    }, false, null);

    expect(result.selectedConceptIds).toEqual(["yachta", "butterfly", "crown", "heart", "boat"]);
  });
});
