import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { api, setApiToken } from "@/core/api";
import { getDb, kv } from "@/core/db";
import { restoreHistoricalSessions } from "./restoreHistoricalSessions";

const legacy = id => ({ id, studentId: "kid", topicId: "topic", topicVersion: "1", modeId: "find_n", startedAt: "2026-10-01T10:00:00Z", completedAt: "2026-10-01T10:01:00Z", correctCount: 1, incorrectCount: 0, paramsSnapshot: { optionCount: 2 }, cardEvents: [{ conceptId: "cat", attemptCount: 1, taps: [{ isCorrect: true, optionId: "raw-option" }] }] });
beforeEach(async () => {
  setApiToken("owner-token");
  const db = await getDb();
  await kv.set(db, "account", { id: "owner" });
  await kv.set(db, "accountId", "owner");
  await kv.set(db, "sessions", [legacy("old")]);
});
afterEach(() => { vi.restoreAllMocks(); setApiToken(null); });

it("uploads compact evidence without raw taps and leaves the original history intact", async () => {
  const post = vi.spyOn(api, "post").mockResolvedValue({ restored: 1 });
  await restoreHistoricalSessions("owner", "owner-token");
  expect(post).toHaveBeenCalledTimes(1);
  const [path, body] = post.mock.calls[0];
  expect(path).toBe("/statistics/restore");
  expect(body.sessions[0].statistics).toMatchObject({ firstTotal: 1, firstCorrect: 1, conditions: { params: { optionCount: 2 } } });
  expect(body.sessions[0].cardEvents).toBeUndefined();
  expect(JSON.stringify(body)).not.toContain("raw-option");
  expect((await kv.get(await getDb(), "sessions"))[0].cardEvents).toHaveLength(1);
});

it("does not upload another account's device history or an expired account context", async () => {
  const post = vi.spyOn(api, "post").mockResolvedValue({ restored: 1 });
  await restoreHistoricalSessions("other", "owner-token");
  await restoreHistoricalSessions("owner", "different-token");
  expect(post).not.toHaveBeenCalled();
});

it("keeps failed uploads available for retry", async () => {
  const post = vi.spyOn(api, "post").mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ restored: 1 });
  await expect(restoreHistoricalSessions("owner", "owner-token")).rejects.toThrow("offline");
  await restoreHistoricalSessions("owner", "owner-token");
  expect(post).toHaveBeenCalledTimes(2);
  expect(await kv.get(await getDb(), "sessions")).toHaveLength(1);
});

it("batches old history and stops before sending another batch after an account switch", async () => {
  await kv.set(await getDb(), "sessions", Array.from({ length: 101 }, (_, index) => legacy(String(index))));
  const post = vi.spyOn(api, "post").mockImplementation(async () => { setApiToken("new-account-token"); return { restored: 100 }; });
  await restoreHistoricalSessions("owner", "owner-token");
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0][1].sessions).toHaveLength(100);
});
