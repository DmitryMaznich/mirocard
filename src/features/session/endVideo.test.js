import { describe, it, expect } from "vitest";
import { endVideoAvailable } from "./endVideo";
import { sessionEndsOnItsOwn } from "@/shared/utils/topicUtils";

const student = { id: "s", rewardVideos: [{ id: "v" }] };
const done = { paramsSnapshot: { videoAtEnd: true }, completionReason: "series_completed", reward: { videoEnabled: true } };

describe("«Видео в конце занятия»", () => {
  it("offers the video for a session gone through to the end", () => {
    expect(endVideoAvailable(done, student)).toBe(true);
  });
  it("not when stopped early, switched off, rewards off, or the student has no videos", () => {
    expect(endVideoAvailable({ ...done, completionReason: "manual" }, student)).toBe(false);
    expect(endVideoAvailable({ ...done, paramsSnapshot: {} }, student)).toBe(false);
    expect(endVideoAvailable({ ...done, reward: { videoEnabled: false } }, student)).toBe(false);
    expect(endVideoAvailable(done, { id: "s", rewardVideos: [] })).toBe(false);
  });
  it("is offered only for modes that end on their own", () => {
    expect(sessionEndsOnItsOwn({ evaluation: "instant" }, "x")).toBe(false);
    expect(sessionEndsOnItsOwn({ evaluation: "instant", finite: true }, "x")).toBe(true);
    expect(sessionEndsOnItsOwn({ evaluation: "instant" }, "flashcards")).toBe(true);
    expect(sessionEndsOnItsOwn({ evaluation: "adult" }, "x")).toBe(true);
    expect(sessionEndsOnItsOwn({ evaluation: "adult", loop: true }, "x")).toBe(false);
  });
});
