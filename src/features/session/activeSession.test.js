import { describe, expect, it } from "vitest";
import {
  createActiveSessionSnapshot,
  normalizeActiveSessionSnapshot,
  restoreActiveSessionState,
} from "./activeSession";

describe("activeSession helpers", () => {
  it("normalizes a valid snapshot", () => {
    const snapshot = normalizeActiveSessionSnapshot({
      context: { studentId: "s1", topicId: "t1", modeId: "m1" },
      sessionState: { status: "task_active", topicVersion: "1.0.0" },
    });

    expect(snapshot).toEqual({
      schemaVersion: 1,
      updatedAt: null,
      context: { studentId: "s1", topicId: "t1", textId: null, modeId: "m1" },
      sessionState: { status: "task_active", topicVersion: "1.0.0" },
    });
  });

  it("rejects completed sessions", () => {
    const snapshot = normalizeActiveSessionSnapshot({
      context: { studentId: "s1", topicId: "t1", modeId: "m1" },
      sessionState: { status: "completed", topicVersion: "1.0.0" },
    });

    expect(snapshot).toBeNull();
  });

  it("restores only when context and topic version still match", () => {
    const savedState = { status: "task_active", topicVersion: "1.0.0", taskIndex: 2 };
    const snapshot = createActiveSessionSnapshot(
      { studentId: "s1", topicId: "t1", textId: null, modeId: "m1" },
      savedState,
    );

    expect(restoreActiveSessionState(snapshot, {
      studentId: "s1",
      topicId: "t1",
      textId: null,
      modeId: "m1",
      topicVersion: "1.0.0",
    })).toEqual(savedState);

    expect(restoreActiveSessionState(snapshot, {
      studentId: "s1",
      topicId: "t1",
      textId: null,
      modeId: "m1",
      topicVersion: "2.0.0",
    })).toBeNull();
  });
});
