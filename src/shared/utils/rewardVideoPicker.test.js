import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  normalizeRewardVideoIds,
  pickRewardVideoId,
  pickStoredRewardVideoId,
  resetRewardVideoMemory,
  preloadRewardVideoRotation,
  setRewardVideoAccountStore,
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

const account = new Map();
setRewardVideoAccountStore({
  read: async (key) => account.get(key) ?? null,
  write: async (key, value) => { account.set(key, structuredClone(value)); },
});

describe("pickStoredRewardVideoId (cycle, via localStorage)", () => {
  const scope = "test-scope";

  beforeEach(() => {
    window.localStorage.clear();
    resetRewardVideoMemory();
    account.clear();
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

  it("keeps rotating when localStorage is full (writes throw, reads return stale state)", () => {
    const videos = [A, B, C, D].map((id) => `https://youtu.be/${id}`);
    pickStoredRewardVideoId(videos, scope);
    pickStoredRewardVideoId(videos, scope); // stale state: 2 of 4 shown
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    try {
      let previous = null;
      const cycle = new Set();
      for (let i = 0; i < 40; i += 1) {
        const id = pickStoredRewardVideoId(videos, scope);
        expect(id).not.toBe(previous);
        previous = id;
        cycle.add(id);
      }
      expect(cycle.size).toBe(4);
    } finally {
      setItem.mockRestore();
    }
  });

  it("after a restart, continues the cycle from the account even if localStorage lost every write", async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `v${String(i).padStart(10, "0")}`);
    const videos = ids.map((id) => `https://youtu.be/${id}`);
    const firstCycle = new Set();
    for (let i = 0; i < 25; i += 1) firstCycle.add(pickStoredRewardVideoId(videos, scope));
    const frozen = window.localStorage.getItem(`mirocard:rewardVideoRotation:${scope}`);

    // From now on writes are silently dropped: every restart reads `frozen` again.
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    try {
      const seen = [];
      for (let restart = 0; restart < 12; restart += 1) {
        resetRewardVideoMemory();
        expect(window.localStorage.getItem(`mirocard:rewardVideoRotation:${scope}`)).toBe(frozen);
        await preloadRewardVideoRotation(scope);
        seen.push(pickStoredRewardVideoId(videos, scope));
      }
      // The 5 clips the first cycle still owed come first, then a new cycle
      // of the whole list — never the same clip twice in a row, never stuck.
      const owed = seen.slice(0, 5);
      expect(new Set(owed).size).toBe(5);
      expect(owed.some((id) => firstCycle.has(id))).toBe(false);
      expect(new Set(seen.slice(5)).size).toBe(7);
      seen.forEach((id, i) => { if (i) expect(id).not.toBe(seen[i - 1]); });
    } finally {
      setItem.mockRestore();
    }
  });
});
