import { describe, expect, it, beforeEach } from "vitest";
import {
  normalizeRewardVideoIds,
  pickRewardVideoId,
  pickStoredRewardVideoId,
} from "./rewardVideoPicker";

const A = "aaaaaaaaaaa";
const B = "bbbbbbbbbbb";
const C = "ccccccccccc";
const D = "ddddddddddd";

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
      expect(pickRewardVideoId([A, B, C], A, [A], () => 0)).not.toBe(A);
    }
  });

  it("can repeat when there is only one video", () => {
    expect(pickRewardVideoId([A], A, [], () => 0)).toBe(A);
  });

  it("only offers not-yet-shown videos while any remain", () => {
    // C is the only one not in shownIds — must be picked regardless of
    // what `random` returns, since it's the only choice.
    expect(pickRewardVideoId([A, B, C], B, [A, B], () => 0)).toBe(C);
    expect(pickRewardVideoId([A, B, C], B, [A, B], () => 0.99)).toBe(C);
  });

  it("restarts the cycle once every video has been shown, skipping only the immediate previous", () => {
    for (let i = 0; i < 20; i += 1) {
      const picked = pickRewardVideoId([A, B, C], A, [A, B, C]);
      expect(picked).not.toBe(A);
      expect([B, C]).toContain(picked);
    }
  });
});

describe("pickStoredRewardVideoId (cycle, via localStorage)", () => {
  const scope = "test-scope";

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows every video exactly once before any repeats", () => {
    const videos = [A, B, C, D].map((id) => `https://youtu.be/${id}`);
    const seenInCycle = new Set();
    for (let i = 0; i < 4; i += 1) {
      const picked = pickStoredRewardVideoId(videos, scope);
      expect(seenInCycle.has(picked)).toBe(false); // no repeat within the first full pass
      seenInCycle.add(picked);
    }
    expect(seenInCycle).toEqual(new Set([A, B, C, D]));
  });

  it("starts a fresh cycle after the pool is exhausted, without repeating the last-shown video", () => {
    const videos = [A, B, C].map((id) => `https://youtu.be/${id}`);
    let last = null;
    for (let i = 0; i < 3; i += 1) last = pickStoredRewardVideoId(videos, scope);
    // Cycle just completed; the very next pick starts a new cycle but must
    // not immediately repeat the video that just played. (Later picks
    // within that new cycle are free to include it again — only the
    // back-to-back repeat is disallowed.)
    expect(pickStoredRewardVideoId(videos, scope)).not.toBe(last);
  });

  it("drops a removed video from the shown set instead of getting stuck", () => {
    const threeVideos = [A, B, C].map((id) => `https://youtu.be/${id}`);
    for (let i = 0; i < 3; i += 1) pickStoredRewardVideoId(threeVideos, scope); // exhaust A, B, C

    // D is added, C is removed — D should come up as "unseen" right away
    // rather than waiting for a full extra cycle of the old list.
    const editedVideos = [A, B, D].map((id) => `https://youtu.be/${id}`);
    const picks = new Set();
    for (let i = 0; i < 3; i += 1) picks.add(pickStoredRewardVideoId(editedVideos, scope));
    expect(picks.has(D)).toBe(true);
  });
});
