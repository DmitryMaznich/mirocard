import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal IndexedDB stand-in: a keyed store behind the transaction/cursor
// calls syncApi makes.
const rows = new Map();
function request(result) {
  const req = {};
  queueMicrotask(() => { req.result = result; req.onsuccess?.({ target: req }); });
  return req;
}
const fakeDb = {
  transaction: () => ({
    objectStore: () => ({
      openCursor() {
        const keys = [...rows.keys()];
        const req = {};
        let i = 0;
        const step = () => queueMicrotask(() => {
          const key = keys[i++];
          const cursor = key === undefined ? null : {
            primaryKey: key,
            value: rows.get(key),
            continue: step,
            delete: () => rows.delete(key),
          };
          req.onsuccess?.({ target: { result: cursor } });
        });
        step();
        return req;
      },
      delete: (key) => { rows.delete(key); return request(undefined); },
      add: (value) => { rows.set(rows.size + 1, value); return request(undefined); },
    }),
  }),
};

const post = vi.fn();
vi.mock("@/core/db", () => ({ getDb: () => Promise.resolve(fakeDb) }));
vi.mock("@/core/api", () => ({ api: { post: (...args) => post(...args) } }));

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
import { flushQueue, isPermanentSyncRejection } from "./syncApi";

function queue(...types) {
  rows.clear();
  types.forEach((type, index) => rows.set(index + 1, { type, data: { id: type } }));
}

describe("flushQueue", () => {
  beforeEach(() => {
    post.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("drops an op the server permanently rejected and keeps sending the rest", async () => {
    queue("bad.op", "session.append");
    post.mockImplementation((_, body) => (body.operations[0].type === "bad.op"
      ? Promise.reject(new ApiError("Bad request", 400))
      : Promise.resolve({ accepted: true })));

    await flushQueue();

    expect(post).toHaveBeenCalledTimes(2);
    expect([...rows.values()]).toEqual([]);
  });

  it.each([
    ["an expired session", new ApiError("Invalid or expired token", 401)],
    ["a server error", new ApiError("Internal server error", 500)],
    ["a network failure or timeout", new TypeError("Failed to fetch")],
  ])("keeps the queue intact and in order on %s", async (_, error) => {
    queue("student.my_people.upsert", "session.append");
    post.mockRejectedValue(error);

    await flushQueue();

    expect(post).toHaveBeenCalledTimes(1);
    expect([...rows.values()].map((row) => row.type)).toEqual(["student.my_people.upsert", "session.append"]);
  });
});

describe("isPermanentSyncRejection", () => {
  it("treats only non-retryable 4xx as permanent", () => {
    expect(isPermanentSyncRejection({ status: 400 })).toBe(true);
    expect(isPermanentSyncRejection({ status: 413 })).toBe(true);
    for (const status of [401, 403, 408, 429, 500, 502]) expect(isPermanentSyncRejection({ status })).toBe(false);
    expect(isPermanentSyncRejection(new Error("abort"))).toBe(false);
  });
});
