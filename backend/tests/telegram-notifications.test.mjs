import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { initDb } from "../lib/db.mjs";
import { createAccount } from "../lib/account-repository.mjs";
import { archiveAccount, eraseAccount, restoreAccount } from "../lib/account-lifecycle.mjs";
import { createTelegramDispatcher, formatAccountNotification } from "../lib/telegram-notifications.mjs";

const makeAccount = (db, method = "email") => createAccount(db, {
  email: "anna@example.test", passwordHash: "secret-hash", firstName: "Анна",
  role: "specialist", referralSource: "instagram", notificationMethod: method,
});
const rows = (db) => db.prepare("SELECT * FROM telegram_notifications ORDER BY rowid").all();
const silent = { warn() {} };

test("registration enqueues only new accounts, with the correct method and no credentials", () => {
  for (const method of ["email", "google"]) {
    const db = initDb(":memory:");
    const a = makeAccount(db, method);
    assert.equal(rows(db).length, 1);
    assert.match(formatAccountNotification(rows(db)[0]), method === "google" ? /Google, аккаунт активен/ : /ожидает подтверждения/);
    assert.throws(() => makeAccount(db, method));
    assert.equal(rows(db).length, 1);
    assert.equal(db.prepare("SELECT count(*) n FROM accounts").get().n, 1);
    assert.equal(rows(db)[0].account_id, a.id);
    assert.doesNotMatch(rows(db)[0].payload, /secret-hash/);
    db.close();
  }
});

test("failed enqueue rolls back account creation and archive", () => {
  const db = initDb(":memory:");
  const a = makeAccount(db);
  db.exec(`CREATE TRIGGER fail_notification BEFORE INSERT ON telegram_notifications BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
  assert.throws(() => archiveAccount(db, a.id));
  assert.equal(db.prepare("SELECT status FROM accounts WHERE id=?").get(a.id).status, "pending");
  assert.throws(() => createAccount(db, { email: "other@example.test", passwordHash: "hash", notificationMethod: "email" }));
  assert.equal(db.prepare("SELECT count(*) n FROM accounts").get().n, 1);
  db.close();
});

test("self/admin archives are distinct, idempotent, and re-archive after restoration is a new event", () => {
  const db = initDb(":memory:");
  const a = makeAccount(db);
  archiveAccount(db, a.id, "self");
  archiveAccount(db, a.id, "self");
  assert.equal(rows(db).length, 2);
  assert.match(formatAccountNotification(rows(db)[1]), /Кто удалил: пользователь/);
  restoreAccount(db, a.id, "restore", "test restore");
  archiveAccount(db, a.id);
  assert.equal(rows(db).length, 3);
  assert.match(formatAccountNotification(rows(db)[2]), /Кто удалил: администратор/);
  eraseAccount(db, a.id);
  assert.equal(rows(db).length, 1);
  assert.equal(rows(db)[0].type, "erased");
  assert.equal(rows(db)[0].payload, "{}");
  assert.doesNotMatch(formatAccountNotification(rows(db)[0]), /Анна|anna@/);
  db.close();
});

test("queue survives restart, retries network failures and clears successful messages", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "telegram-queue-"));
  let db;
  try {
    const file = path.join(dir, "test.db");
    db = initDb(file);
    makeAccount(db);
    db.close();
    db = initDb(file);
    let time = Date.now() + 1000;
    let calls = 0;
    const dispatch = createTelegramDispatcher(db, { token: "test-token", chatId: "123", now: () => time, logger: silent,
      fetchImpl: async (_url, opts) => {
        calls++;
        assert.equal(JSON.parse(opts.body).chat_id, "123");
        if (calls === 1) throw new Error("network failure");
        return { ok: true, json: async () => ({ ok: true }) };
      },
    });
    await dispatch();
    assert.equal(rows(db)[0].attempts, 1);
    await dispatch();
    assert.equal(calls, 1);
    time += 5001;
    await dispatch();
    assert.equal(calls, 2);
    assert.equal(rows(db).length, 0);
  } finally {
    db?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Telegram retry_after is respected and concurrent ticks do not duplicate delivery", async () => {
  const db = initDb(":memory:");
  makeAccount(db);
  const time = Date.now() + 1000;
  let release;
  let calls = 0;
  const dispatch = createTelegramDispatcher(db, { token: "token", chatId: "123", now: () => time, logger: silent,
    fetchImpl: async () => {
      calls++;
      await new Promise((r) => { release = r; });
      return { ok: false, status: 429, json: async () => ({ ok: false, parameters: { retry_after: 120 } }) };
    },
  });
  const pending = dispatch();
  await dispatch();
  assert.equal(calls, 1);
  release();
  await pending;
  assert.equal(rows(db)[0].next_attempt_at, time + 120_000);
  db.close();
});
