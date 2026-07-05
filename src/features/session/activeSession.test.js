import { describe, expect, it } from "vitest";
import {
  createActiveSessionSnapshot,
  normalizeActiveSessionSnapshot,
  restoreActiveSessionState,
  canResumeActiveSession,
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

describe("canResumeActiveSession", () => {
  const topicRecords = [
    { meta: { id: "reading_topic" }, texts: [{ id: "recipe_a" }, { id: "recipe_b" }] },
    { meta: { id: "flashcards_topic" } },
  ];

  it("is false when there is no session state at all", () => {
    expect(canResumeActiveSession(null, topicRecords)).toBe(false);
    expect(canResumeActiveSession({ context: { topicId: "reading_topic" } }, topicRecords)).toBe(false);
  });

  it("is true when the topic and text both still exist", () => {
    const snapshot = createActiveSessionSnapshot(
      { studentId: "s1", topicId: "reading_topic", textId: "recipe_a", modeId: "follow_instruction" },
      { status: "task_active", topicVersion: "1.0.0" },
    );
    expect(canResumeActiveSession(snapshot, topicRecords)).toBe(true);
  });

  it("is true for a non-reading topic with no textId to check", () => {
    const snapshot = createActiveSessionSnapshot(
      { studentId: "s1", topicId: "flashcards_topic", modeId: "flashcards" },
      { status: "task_active", topicVersion: "1.0.0" },
    );
    expect(canResumeActiveSession(snapshot, topicRecords)).toBe(true);
  });

  it("is false when the topic no longer exists in topicRecords", () => {
    const snapshot = createActiveSessionSnapshot(
      { studentId: "s1", topicId: "deleted_topic", textId: "recipe_a", modeId: "follow_instruction" },
      { status: "task_active", topicVersion: "1.0.0" },
    );
    expect(canResumeActiveSession(snapshot, topicRecords)).toBe(false);
  });

  it("is false when the topic exists but the text no longer does (the bug's actual symptom)", () => {
    const snapshot = createActiveSessionSnapshot(
      { studentId: "s1", topicId: "reading_topic", textId: "recipe_deleted", modeId: "follow_instruction" },
      { status: "task_active", topicVersion: "1.0.0" },
    );
    expect(canResumeActiveSession(snapshot, topicRecords)).toBe(false);
  });
});
