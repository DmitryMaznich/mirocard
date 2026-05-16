import { describe, expect, it } from "vitest";
import { normalizeRewardVideoIds, pickRewardVideoId } from "./rewardVideoPicker";

const A = "aaaaaaaaaaa";
const B = "bbbbbbbbbbb";
const C = "ccccccccccc";

describe("normalizeRewardVideoIds", () => {
  it("extracts and deduplicates YouTube IDs", () => {
    expect(normalizeRewardVideoIds([
      `https://youtu.be/${A}`,
      `https://www.youtube.com/watch?v=${B}`,
      { url: `https://www.youtube.com/embed/${A}` },
      "not a video",
    ])).toEqual([A, B]);
  });
});

describe("pickRewardVideoId", () => {
  it("does not pick the previous video when alternatives exist", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(pickRewardVideoId([A, B, C], A, () => 0)).not.toBe(A);
    }
  });

  it("can repeat when there is only one video", () => {
    expect(pickRewardVideoId([A], A, () => 0)).toBe(A);
  });
});
