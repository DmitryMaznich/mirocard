import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCachedPhotos } from "@/core/bootstrap";

function fakeCache(urls) {
  const entries = new Map(urls.map((url) => [url, { url }]));
  return {
    entries,
    keys: async () => [...entries.values()],
    delete: async (request) => entries.delete(request.url),
  };
}

describe("clearCachedPhotos", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("drops cached account photos but keeps the app shell cache", async () => {
    const cache = fakeCache([
      "https://app.mironium.com/api/photos/aaaa",
      "https://app.mironium.com/index.html",
      "https://app.mironium.com/vendor/heic-to.js",
    ]);
    vi.stubGlobal("caches", { keys: async () => ["mirocard2-v23"], open: async () => cache });

    await clearCachedPhotos();

    expect([...cache.entries.keys()]).toEqual([
      "https://app.mironium.com/index.html",
      "https://app.mironium.com/vendor/heic-to.js",
    ]);
  });

  it("never throws when Cache Storage is unavailable", async () => {
    vi.stubGlobal("caches", { keys: () => Promise.reject(new Error("SecurityError")) });
    await expect(clearCachedPhotos()).resolves.toBeUndefined();
  });
});
