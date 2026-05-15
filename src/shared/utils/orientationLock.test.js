import { describe, expect, it } from "vitest";
import { getActiveOrientationLock, normalizeOrientationLock } from "./orientationLock";

const TOPICS = [
  {
    meta: { id: "topic-portrait", orientationLock: "portrait" },
    modes: [
      { id: "free", orientation: "any" },
      { id: "landscape", ui: { orientationLock: "landscape-primary" } },
    ],
  },
  {
    meta: { id: "topic-free" },
    modes: [{ id: "portrait-mode", lockOrientation: true }],
  },
];

describe("orientation lock helpers", () => {
  it("normalizes supported lock values", () => {
    expect(normalizeOrientationLock(true)).toBe("portrait");
    expect(normalizeOrientationLock("portrait-primary")).toBe("portrait-primary");
    expect(normalizeOrientationLock("landscape")).toBe("landscape");
    expect(normalizeOrientationLock("any")).toBeNull();
    expect(normalizeOrientationLock(false)).toBeNull();
    expect(normalizeOrientationLock("diagonal")).toBeNull();
  });

  it("does not lock outside topic and session flow screens", () => {
    expect(getActiveOrientationLock({
      screen: "home",
      topicRecords: TOPICS,
      activeTopicId: "topic-portrait",
      activeModeId: "landscape",
    })).toBeNull();
  });

  it("uses mode-level lock before topic-level lock", () => {
    expect(getActiveOrientationLock({
      screen: "session",
      topicRecords: TOPICS,
      activeTopicId: "topic-portrait",
      activeModeId: "landscape",
    })).toBe("landscape-primary");
  });

  it("falls back to topic-level lock when mode is free", () => {
    expect(getActiveOrientationLock({
      screen: "session",
      topicRecords: TOPICS,
      activeTopicId: "topic-portrait",
      activeModeId: "free",
    })).toBe("portrait");
  });

  it("supports boolean mode lock metadata", () => {
    expect(getActiveOrientationLock({
      screen: "params",
      topicRecords: TOPICS,
      activeTopicId: "topic-free",
      activeModeId: "portrait-mode",
    })).toBe("portrait");
  });
});
