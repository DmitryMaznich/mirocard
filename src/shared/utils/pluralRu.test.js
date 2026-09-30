import { describe, expect, it } from "vitest";
import { pluralRu } from "./format";

describe("pluralRu", () => {
  it.each([[1, "карточка"], [2, "карточки"], [4, "карточки"], [5, "карточек"], [11, "карточек"], [12, "карточек"], [21, "карточка"], [22, "карточки"], [0, "карточек"]])(
    "%i → %s", (n, word) => expect(pluralRu(n, "карточка", "карточки", "карточек")).toBe(word),
  );
});
