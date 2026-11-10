import { describe, expect, it } from "vitest";
import { continueContext, continueDestination, lastActivityParts, previewTopicDestination, readContinueChoice, recentTopicContext, saveContinueChoice } from "./topicUiPreviewModel";

describe("preview topic routes and recent activity", () => {
  it("preserves renderer-specific entry points", () => {
    const topic = (renderer, modes = [{ id: "one" }]) => ({ meta: { renderer }, modes });
    expect(previewTopicDestination(topic("reading"))).toBe("texts");
    expect(previewTopicDestination(topic("chat_practice", []))).toBe("chat_params");
    for (const renderer of ["comparison", "propis2", "print_letters", "games", "my_people", "chat_practice"]) {
      expect(previewTopicDestination(topic(renderer))).toBe("modes");
    }
  });
  it("uses actual activity for the selected student, including an unfinished lesson", () => {
    const sessions = [
      { studentId: "a", topicId: "math", modeId: "first", completedAt: "2026-11-01T10:00:00Z" },
      { studentId: "b", topicId: "reading", completedAt: "2026-11-09T10:00:00Z" },
      { studentId: "a", topicId: "broken", completedAt: "bad date" },
    ];
    expect(recentTopicContext(sessions, "a", null).topicId).toBe("math");
    const snapshot = { context: { studentId: "a", topicId: "letters", modeId: "draw" }, updatedAt: "2026-11-08T10:00:00Z" };
    expect(recentTopicContext(sessions, "a", snapshot).modeId).toBe("draw");
    expect(recentTopicContext(sessions, null, snapshot)).toBeNull();
    expect(recentTopicContext([], "b", snapshot)).toBeNull();
    expect(sessions[0].topicId).toBe("math"); // No in-place sorting/mutation.
  });
  it("continues the latest visible topic with its still-pickable mode", () => {
    const records = [
      { meta: { id: "math", renderer: "comparison" }, modes: [{ id: "first" }, { id: "second" }] },
      { meta: { id: "secret", renderer: "comparison", hidden: true }, modes: [{ id: "first" }] },
    ];
    expect(continueContext({ topicId: "math", modeId: "second", time: 1 }, records).mode.id).toBe("second");
    expect(continueContext({ topicId: "math", modeId: "retired", time: 1 }, records).mode).toBeNull();
    expect(continueContext({ topicId: "secret", modeId: "first", time: 1 }, records)).toBeNull();
    expect(continueContext({ topicId: "gone", time: 1 }, records)).toBeNull();
  });
  it("puts the exercise picked with «Сменить» into the card until a newer lesson", () => {
    const records = [{ meta: { id: "math", renderer: "comparison" }, modes: [{ id: "first" }, { id: "second" }] }];
    const recent = { topicId: "math", modeId: "first", time: 100 };
    expect(continueContext(recent, records, { topicId: "math", modeId: "second", at: 200 }).mode.id).toBe("second");
    expect(continueContext(recent, records, { topicId: "math", modeId: "second", at: 50 }).mode.id).toBe("first");
    expect(continueContext(recent, records, { topicId: "other", modeId: "second", at: 200 }).mode.id).toBe("first");
    saveContinueChoice("s1", { topicId: "math", modeId: "second" }, 300);
    expect(readContinueChoice("s1")).toEqual({ topicId: "math", modeId: "second", textId: null, at: 300 });
    expect(readContinueChoice("s2")).toBeNull();
  });
  it("starts through the same routes as the legacy Home button", () => {
    const mode = { id: "m" };
    expect(continueDestination({ meta: { id: "x", renderer: "comparison" }, modes: [mode] }, mode, null)).toBe("params");
    expect(continueDestination({ meta: { id: "x", renderer: "comparison" }, modes: [mode] }, null, null)).toBe("modes");
    expect(continueDestination({ meta: { id: "games", renderer: "games" }, modes: [mode] }, mode, null)).toBe("modes");
    expect(continueDestination({ meta: { id: "r", renderer: "reading" }, modes: [mode] }, mode, null)).toBe("texts");
    expect(continueDestination({ meta: { id: "r", renderer: "reading" }, modes: [mode] }, mode, "t1")).toBe("params");
  });
  it("shows time only for today", () => {
    const now = new Date(2026, 10, 9, 21, 0);
    expect(lastActivityParts(new Date(2026, 10, 9, 10, 15), now).kind).toBe("today");
    expect(lastActivityParts(new Date(2026, 10, 8, 23, 59), now).kind).toBe("yesterday");
    expect(lastActivityParts(new Date(2026, 10, 5), now)).toMatchObject({ kind: "date", withYear: false });
    expect(lastActivityParts(new Date(2025, 10, 5), now).withYear).toBe(true);
    expect(lastActivityParts(NaN, now)).toBeNull();
  });
});
