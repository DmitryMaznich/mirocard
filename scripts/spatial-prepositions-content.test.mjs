import { describe, expect, it } from "vitest";
import { ALL_CARDS } from "./spatial-prepositions-content.mjs";

describe("spatial-prepositions language", () => {
  it("uses accusative case for the object in «Покажи» prompts", () => {
    const promptsBySubject = Object.groupBy(ALL_CARDS, ({ subject }) => subject);

    expect(promptsBySubject.Машинка.every(({ recognizePrompt }) => recognizePrompt.startsWith("Покажи машинку "))).toBe(true);
    expect(promptsBySubject.Мишка.every(({ recognizePrompt }) => recognizePrompt.startsWith("Покажи мишку "))).toBe(true);
    expect(promptsBySubject.Мяч.every(({ recognizePrompt }) => recognizePrompt.startsWith("Покажи мяч "))).toBe(true);
    expect(promptsBySubject.Кубик.every(({ recognizePrompt }) => recognizePrompt.startsWith("Покажи кубик "))).toBe(true);
  });
});
