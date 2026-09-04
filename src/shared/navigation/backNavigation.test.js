import { describe, expect, it } from "vitest";
import { getBackTarget, SESSION_EXIT_TARGET } from "./backNavigation";

function state(overrides) {
  return {
    screen: "home",
    activeTopicId: null,
    topicRecords: [],
    ...overrides,
  };
}

describe("getBackTarget", () => {
  it("returns stable parent screens for regular app screens", () => {
    expect(getBackTarget(state({ screen: "students" }))).toBe("home");
    expect(getBackTarget(state({ screen: "student_edit" }))).toBe("students");
    expect(getBackTarget(state({ screen: "concepts" }))).toBe("params");
    expect(getBackTarget(state({ screen: "all_texts" }))).toBe("texts");
    expect(getBackTarget(state({ screen: "account" }))).toBe("home");
  });

  it("returns texts before reading modes", () => {
    expect(getBackTarget(state({
      screen: "modes",
      activeTopicId: "reading",
      topicRecords: [{ meta: { id: "reading", renderer: "reading" } }],
    }))).toBe("texts");
  });

  it("returns home before non-reading modes", () => {
    expect(getBackTarget(state({
      screen: "modes",
      activeTopicId: "cards",
      topicRecords: [{ meta: { id: "cards", renderer: "flashcards" } }],
    }))).toBe("home");
  });

  it("marks sessions as a confirm-before-exit case", () => {
    expect(getBackTarget(state({ screen: "session" }))).toBe(SESSION_EXIT_TARGET);
  });

  it("does not navigate from root or boot screens", () => {
    expect(getBackTarget(state({ screen: "home" }))).toBeNull();
    expect(getBackTarget(state({ screen: "login" }))).toBeNull();
    expect(getBackTarget(state({ screen: "boot" }))).toBeNull();
  });
});
