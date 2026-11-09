import { describe, expect, it } from "vitest";
import { previewTopicDestination, recentTopicContext } from "./topicUiPreviewModel";

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
});
