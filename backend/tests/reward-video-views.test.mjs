import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, upsertStudent } from "../lib/account-repository.mjs";
import { processSync } from "../lib/sync-processor.mjs";
import { buildBootstrap } from "../lib/snapshot-builder.mjs";

test("video counts survive retries, stale operations, profile/link edits and merge devices", () => {
  const db = initDb(":memory:");
  try {
    const account = createAccount(db, { email: "views@example.com", passwordHash: "hash", displayName: "Views" });
    const other = createAccount(db, { email: "other-views@example.com", passwordHash: "hash", displayName: "Other" });
    upsertStudent(db, account.id, { id: "s1", name: "Ученик" });
    const record = (accountId, views) => processSync(db, accountId, [{ type: "student.video_view.record", data: { studentId: "s1", views } }]);
    record(account.id, { aaaaaaaaaaa: { deviceA: 2 } });
    record(account.id, { aaaaaaaaaaa: { deviceA: 2 } });
    record(account.id, { aaaaaaaaaaa: { deviceA: 1, deviceB: 3 } });
    record(other.id, { aaaaaaaaaaa: { deviceA: 100 } });
    processSync(db, account.id, [
      { type: "student.upsert", data: { id: "s1", name: "Новое имя" } },
      { type: "student.videos.upsert", data: { studentId: "s1", rewardVideos: ["https://youtu.be/aaaaaaaaaaa"], updatedAt: "2026-10-01" } },
    ]);
    assert.deepEqual(buildBootstrap(db, account.id).students[0].rewardVideoViews, { aaaaaaaaaaa: { deviceA: 2, deviceB: 3 } });
  } finally { db.close(); }
});
