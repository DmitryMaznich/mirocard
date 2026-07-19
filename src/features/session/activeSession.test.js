import { describe, expect, it } from "vitest";
import {
  createActiveSessionSnapshot,
  normalizeActiveSessionSnapshot,
  restoreActiveSessionState,
  canResumeActiveSession,
  sessionSettingsChanged,
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

describe("sessionSettingsChanged", () => {
  // Mid-session, opening Настройки and hitting «Начать занятие» must only skip the
  // resume-snapshot (and regenerate tasks) when the parent actually changed something —
  // otherwise navigating to Настройки and back with no edits would lose progress.
  const baseline = {
    params: { operation: "add", carryMode: "none", digits: 2 },
    videoRewardEnabled: true,
    answersPerStar: 1,
    strictStars: false,
  };

  it("is false when nothing changed", () => {
    const current = { ...baseline, params: { ...baseline.params } };
    expect(sessionSettingsChanged(current, baseline)).toBe(false);
  });

  it("is true when a mode param changed", () => {
    const current = { ...baseline, params: { ...baseline.params, digits: 3 } };
    expect(sessionSettingsChanged(current, baseline)).toBe(true);
  });

  it("is true when a mode param was added or removed", () => {
    const current = { ...baseline, params: { operation: "add", carryMode: "none" } };
    expect(sessionSettingsChanged(current, baseline)).toBe(true);
  });

  it("is true when strictStars changed", () => {
    const current = { ...baseline, strictStars: true };
    expect(sessionSettingsChanged(current, baseline)).toBe(true);
  });

  it("is true when answersPerStar changed", () => {
    const current = { ...baseline, answersPerStar: 2 };
    expect(sessionSettingsChanged(current, baseline)).toBe(true);
  });

  it("is true when videoRewardEnabled changed", () => {
    const current = { ...baseline, videoRewardEnabled: false };
    expect(sessionSettingsChanged(current, baseline)).toBe(true);
  });

  it("is true when either side is missing", () => {
    expect(sessionSettingsChanged(null, baseline)).toBe(true);
    expect(sessionSettingsChanged(baseline, null)).toBe(true);
  });
});
