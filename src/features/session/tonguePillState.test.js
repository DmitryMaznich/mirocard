import { describe, it, expect } from "vitest";
import { getTonguePillState } from "./tonguePillState";

describe("getTonguePillState", () => {
  it("returns open when the drawer is open, regardless of answer status", () => {
    expect(getTonguePillState({ isDrawerOpen: true, answerStatus: "answer_correct", hasUndonePlanItems: true }))
      .toEqual({ mode: "open", pulse: false });
  });

  it("returns correct when closed and status is answer_correct", () => {
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "answer_correct", hasUndonePlanItems: false }))
      .toEqual({ mode: "correct", pulse: false });
  });

  it("returns incorrect when closed and status is answer_incorrect", () => {
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "answer_incorrect", hasUndonePlanItems: false }))
      .toEqual({ mode: "incorrect", pulse: false });
  });

  it("returns idle with no pulse for task_active status and no undone items", () => {
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "task_active", hasUndonePlanItems: false }))
      .toEqual({ mode: "idle", pulse: false });
  });

  it("returns idle with pulse when there are undone plan items", () => {
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "task_active", hasUndonePlanItems: true }))
      .toEqual({ mode: "idle", pulse: true });
  });

  it("never pulses while showing a correct/incorrect emoji, even with undone items", () => {
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "answer_correct", hasUndonePlanItems: true }))
      .toEqual({ mode: "correct", pulse: false });
    expect(getTonguePillState({ isDrawerOpen: false, answerStatus: "answer_incorrect", hasUndonePlanItems: true }))
      .toEqual({ mode: "incorrect", pulse: false });
  });
});
