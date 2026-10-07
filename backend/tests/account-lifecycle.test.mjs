import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import {
  createAccount,
  activateAccount,
  storeAuthToken,
  findAccountByToken,
  upsertStudent,
  appendSession,
  extractAndStorePhoto,
} from "../lib/account-repository.mjs";
import {
  prepareDeletion,
  confirmDeletion,
  deletionSummary,
  blockAccount,
  restoreAccount,
  sweepScheduledDeletions,
} from "../lib/account-lifecycle.mjs";
import {
  createOrder,
  grantTrialSubscription,
  recordPaymentEvent,
  findEntitlementsNeedingReminders,
} from "../lib/billing-repository.mjs";
const now = Date.parse("2026-10-07T12:00:00Z");
const failure = (status) => (err) => err.status === status;
function fixture() {
  const db = initDb(":memory:");
  const a = createAccount(db, {
    email: "owner@example.test",
    passwordHash: "hash",
    firstName: "Owner",
  });
  activateAccount(db, a.id);
  const b = createAccount(db, {
    email: "other@example.test",
    passwordHash: "other",
  });
  activateAccount(db, b.id);
  storeAuthToken(db, {
    tokenHash: "session1",
    accountId: a.id,
    expiresAt: "2099-01-01T00:00:00Z",
  });
  grantTrialSubscription(db, a.id);
  return { db, a, b };
}
function body(db, a, mode = "immediate", time = now) {
  const preview = prepareDeletion(db, a.id, mode, time);
  return {
    mode,
    confirmationToken: preview.confirmationToken,
    confirmEmail: a.email,
    confirmWord: "УДАЛИТЬ",
    reason: "Тестовый аккаунт",
    acknowledgeData: true,
    acknowledgeRetention: true,
  };
}
test("block preserves pending/active status, revokes all credentials and restoration cannot reuse old sessions", () => {
  const { db, a } = fixture();
  blockAccount(db, a.id, "Временная блокировка", now);
  assert.equal(findAccountByToken(db, "session1"), null);
  assert.equal(
    db
      .prepare("SELECT COUNT(*) AS n FROM auth_tokens WHERE account_id = ?")
      .get(a.id).n,
    0,
  );
  assert.equal(findEntitlementsNeedingReminders(db).length, 0);
  restoreAccount(db, a.id, "unblock", "Причина устранена", now + 1000);
  assert.equal(
    db.prepare("SELECT status FROM accounts WHERE id = ?").get(a.id).status,
    "active",
  );
  assert.equal(findAccountByToken(db, "session1"), null);
  const pending = createAccount(db, {
    email: "pending@example.test",
    passwordHash: "hash",
  });
  blockAccount(db, pending.id, "Проверка", now);
  restoreAccount(db, pending.id, "unblock", "Проверено", now);
  assert.equal(
    db.prepare("SELECT status FROM accounts WHERE id = ?").get(pending.id)
      .status,
    "pending",
  );
});
test("deletion requires all confirmations, valid expiry, target identity, unchanged preview and single-use token", () => {
  const { db, a, b } = fixture();
  const input = body(db, a);
  for (const change of [
    { reason: "" },
    { confirmEmail: b.email },
    { confirmWord: "DELETE" },
    { acknowledgeRetention: false },
    { acknowledgeData: false },
    { mode: "scheduled" },
    { confirmationToken: "wrong" },
  ])
    assert.throws(
      () => confirmDeletion(db, a.id, { ...input, ...change }, { now }),
      (err) => [400, 409].includes(err.status),
    );
  assert.throws(
    () =>
      confirmDeletion(db, b.id, { ...input, confirmEmail: b.email }, { now }),
    failure(409),
  );
  assert.throws(
    () => confirmDeletion(db, a.id, input, { now: now + 5 * 60000 }),
    failure(409),
  );
  db.prepare(
    "UPDATE accounts SET display_name = 'New name', updated_at = '2099-01-01' WHERE id = ?",
  ).run(a.id);
  assert.throws(() => confirmDeletion(db, a.id, input, { now }), failure(409));
  const fresh = body(db, a);
  confirmDeletion(db, a.id, fresh, { now });
  assert.throws(() => confirmDeletion(db, a.id, fresh, { now }), failure(409));
});
test("purge removes owned data and private photos, keeps shared photos and anonymized financial links, frees original email", () => {
  const { db, a, b } = fixture();
  const photo = extractAndStorePhoto(db, "data:image/png;base64,cHJpdmF0ZQ==");
  const shared = extractAndStorePhoto(db, "data:image/png;base64,c2hhcmVk");
  upsertStudent(db, a.id, {
    id: "student-a",
    name: "Child",
    photo,
    closeAdults: [{ photo: shared }],
  });
  upsertStudent(db, b.id, {
    id: "student-b",
    name: "Other child",
    photo: shared,
  });
  appendSession(db, a.id, {
    id: "session-a",
    studentId: "student-a",
    topicId: "test",
    topicVersion: "1",
    mode: "quiz",
    startedAt: "2026-10-01",
    completedAt: "2026-10-01",
  });
  db.prepare(
    "INSERT INTO concept_progress VALUES ('student-a', 'test', 'concept', 2, NULL, 'now')",
  ).run();
  db.prepare(
    "INSERT INTO analysis_cache VALUES (1, 'student-a', 'test', 'v1', 0, '{\"private\":true}')",
  ).run();
  db.prepare("INSERT INTO account_kv VALUES (?, ?, ?, ?)").run(
    a.id,
    "content",
    JSON.stringify({ photo }),
    0,
  );
  db.prepare(
    "INSERT INTO account_identities VALUES ('google', 'subject-a', ?, ?, 'now')",
  ).run(a.id, a.email);
  db.prepare(
    "INSERT INTO one_time_codes VALUES ('code-a', 'google_login', ?, 9999999999999, NULL)",
  ).run(JSON.stringify({ accountId: a.id }));
  createOrder(db, a.id, {
    provider: "stripe",
    plan: "monthly",
    orderId: "ext-order",
    currency: "EUR",
    amountMinor: 990,
  });
  recordPaymentEvent(db, {
    accountId: a.id,
    provider: "stripe",
    eventType: "test",
    externalId: "event",
    payloadJson: JSON.stringify({ email: a.email }),
  });
  const result = confirmDeletion(db, a.id, body(db, a), { now });
  assert.equal(result.status, "purged");
  assert.equal(result.deleted.photosDeleted, 1);
  for (const table of [
    "students",
    "sessions",
    "account_kv",
    "account_identities",
    "auth_tokens",
  ])
    assert.equal(
      db
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE account_id = ?`)
        .get(a.id).n,
      0,
    );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM concept_progress").get().n,
    0,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM analysis_cache").get().n,
    0,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM one_time_codes").get().n,
    0,
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM photos").get().n, 1);
  assert.ok(db.prepare("SELECT * FROM students WHERE id = ?").get("student-b"));
  assert.ok(db.prepare("SELECT * FROM orders WHERE account_id = ?").get(a.id));
  assert.equal(
    db.prepare("SELECT payload_json FROM payment_events").get().payload_json,
    "{}",
  );
  assert.equal(
    db.prepare("SELECT password_hash FROM accounts WHERE id = ?").get(a.id)
      .password_hash,
    "",
  );
  assert.ok(
    createAccount(db, { email: a.email, passwordHash: "new" }).id !== a.id,
  );
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  recordPaymentEvent(db, {
    accountId: a.id,
    provider: "stripe",
    eventType: "late",
    externalId: "late",
    payloadJson: JSON.stringify({ email: a.email }),
  });
  assert.equal(
    db
      .prepare(
        "SELECT payload_json FROM payment_events WHERE event_type = 'late'",
      )
      .get().payload_json,
    "{}",
  );
});
test("scheduled deletion is cancellable only before deadline, preserves prior blocking and survives restart", () => {
  const { db, a, b } = fixture();
  blockAccount(db, a.id, "Проверка", now);
  confirmDeletion(db, a.id, body(db, a, "scheduled"), { now });
  restoreAccount(db, a.id, "cancel-deletion", "Отмена по просьбе", now + 1000);
  assert.equal(
    db.prepare("SELECT status FROM accounts WHERE id = ?").get(a.id).status,
    "blocked",
  );
  restoreAccount(db, a.id, "unblock", "Проверено", now + 2000);
  confirmDeletion(db, a.id, body(db, a, "scheduled"), { now });
  assert.deepEqual(
    sweepScheduledDeletions(db, { now: now + 7 * 86400000 - 1 }),
    { deleted: 0, failed: 0 },
  );
  assert.throws(
    () =>
      restoreAccount(
        db,
        a.id,
        "cancel-deletion",
        "Слишком поздно",
        now + 7 * 86400000,
      ),
    failure(409),
  );
  assert.deepEqual(sweepScheduledDeletions(db, { now: now + 7 * 86400000 }), {
    deleted: 1,
    failed: 0,
  });
  assert.equal(
    db.prepare("SELECT status FROM accounts WHERE id = ?").get(a.id).status,
    "purged",
  );
  assert.equal(
    db.prepare("SELECT status FROM accounts WHERE id = ?").get(b.id).status,
    "active",
  );
});
test("purge is transactional: failed credential cleanup or database error cannot leave half-removed data", () => {
  const { db, a } = fixture();
  const input = body(db, a);
  assert.throws(() =>
    confirmDeletion(db, a.id, input, {
      now,
      beforePurge: () => {
        throw new Error("Filesystem unavailable");
      },
    }),
  );
  assert.equal(
    db.prepare("SELECT status FROM accounts WHERE id = ?").get(a.id).status,
    "active",
  );
  assert.ok(findAccountByToken(db, "session1"));
  db.exec(
    "CREATE TRIGGER prevent_purge BEFORE UPDATE OF status ON accounts WHEN NEW.status = 'purged' BEGIN SELECT RAISE(ABORT, 'failure'); END;",
  );
  assert.throws(() => confirmDeletion(db, a.id, input, { now }));
  assert.ok(findAccountByToken(db, "session1"));
  db.exec("DROP TRIGGER prevent_purge");
  assert.equal(confirmDeletion(db, a.id, input, { now }).status, "purged");
  assert.throws(() => deletionSummary(db, a.id), failure(409));
});

test("late payment and refund preserve financial history without restoring a purged profile", async () => {
  const { processBillingEvent } =
    await import("../lib/billing-orchestrator.mjs");
  const { db, a } = fixture();
  createOrder(db, a.id, {
    provider: "stripe",
    plan: "monthly",
    orderId: "late-order",
    currency: "EUR",
    amountMinor: 990,
  });
  confirmDeletion(db, a.id, body(db, a), { now });
  const result = processBillingEvent(db, {
    provider: "stripe",
    event: {
      eventType: "checkout.session.completed",
      externalId: "late-event",
      orderId: "late-order",
      amountMinor: 990,
      currency: "EUR",
    },
    rawBody: JSON.stringify({ email: a.email }),
  });
  assert.equal(result.reason, "account_purged");
  assert.equal(
    db
      .prepare("SELECT status FROM orders WHERE external_contract_id = ?")
      .get("late-order").status,
    "completed",
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM entitlements WHERE account_id = ? AND status = 'active'",
      )
      .get(a.id).n,
    0,
  );
  processBillingEvent(db, {
    provider: "stripe",
    event: {
      eventType: "charge.refunded",
      externalId: "late-refund",
      orderId: "late-order",
    },
    rawBody: JSON.stringify({ email: a.email }),
  });
  assert.equal(
    db
      .prepare("SELECT status FROM orders WHERE external_contract_id = ?")
      .get("late-order").status,
    "refunded",
  );
  assert.equal(
    db
      .prepare("SELECT COUNT(*) AS n FROM sync_revision WHERE account_id = ?")
      .get(a.id).n,
    0,
  );
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM payment_events WHERE payload_json != '{}'",
      )
      .get().n,
    0,
  );
});
test("scheduled deletion remains durable when the database is closed and reopened", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const file = join(
    mkdtempSync(join(tmpdir(), "mirocard-deletion-durable-")),
    "test.db",
  );
  let db = initDb(file);
  const a = createAccount(db, {
    email: "durable@example.test",
    passwordHash: "hash",
  });
  confirmDeletion(db, a.id, body(db, a, "scheduled"), { now });
  db.close();
  db = initDb(file);
  assert.deepEqual(sweepScheduledDeletions(db, { now: now + 7 * 86400000 }), {
    deleted: 1,
    failed: 0,
  });
  assert.equal(
    db.prepare("SELECT status FROM accounts WHERE id = ?").get(a.id).status,
    "purged",
  );
  db.close();
});
