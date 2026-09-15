import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";

test("initDb creates all required tables", () => {
  const db = initDb(":memory:");

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => r.name);

  const required = [
    "accounts",
    "account_settings",
    "account_topics",
    "auth_tokens",
    "concept_progress",
    "password_reset_tokens",
    "push_subscriptions",
    "sessions",
    "student_topic_links",
    "students",
    "sync_revision",
  ];

  for (const t of required) {
    assert.ok(tables.includes(t), `Missing table: ${t}`);
  }
});

test("initDb enables WAL mode", () => {
  const db = initDb(":memory:");
  const row = db.prepare("PRAGMA journal_mode").get();
  assert.ok(["wal", "memory"].includes(row.journal_mode));
});

test("email_verification_tokens table exists", () => {
  const db = initDb(":memory:");
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='email_verification_tokens'"
  ).all();
  assert.equal(tables.length, 1);
});

test("accounts has new columns", () => {
  const db = initDb(":memory:");
  const cols = db.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
  assert.ok(cols.includes("first_name"));
  assert.ok(cols.includes("last_name"));
  assert.ok(cols.includes("role"));
  assert.ok(cols.includes("referral_source"));
  assert.ok(cols.includes("consent_personal_data_at"));
});

test("billing tables exist with expected columns", () => {
  const db = initDb(":memory:");
  db.prepare(`
    INSERT INTO accounts (id, email, password_hash, created_at, updated_at)
    VALUES ('acc1', 'billing-schema-test@example.com', 'h', '2026-09-15T00:00:00.000Z', '2026-09-15T00:00:00.000Z')
  `).run();

  db.prepare(`
    INSERT INTO subscriptions
      (id, account_id, provider, plan, status, currency, amount_minor, external_contract_id, applied_code, current_period_end, cancel_at_period_end, created_at, updated_at)
    VALUES ('sub1', 'acc1', 'stripe', 'annual', 'pending', 'EUR', 8990, 'order-1', NULL, '2027-09-15T00:00:00.000Z', 0, '2026-09-15T00:00:00.000Z', '2026-09-15T00:00:00.000Z')
  `).run();
  assert.equal(
    db.prepare("SELECT account_id FROM subscriptions WHERE id = 'sub1'").get().account_id,
    "acc1"
  );

  assert.throws(() => {
    db.prepare(`
      INSERT INTO subscriptions
        (id, account_id, provider, plan, status, currency, amount_minor, external_contract_id, current_period_end, cancel_at_period_end, created_at, updated_at)
      VALUES ('sub2', 'acc1', 'stripe', 'monthly', 'pending', 'EUR', 990, 'order-2', '2026-10-15T00:00:00.000Z', 0, '2026-09-15T00:00:00.000Z', '2026-09-15T00:00:00.000Z')
    `).run();
  }, /UNIQUE constraint failed/); // one subscription row per account_id

  db.prepare(`
    INSERT INTO payment_events (id, account_id, provider, event_type, external_id, payload_json, processed_at)
    VALUES ('ev1', 'acc1', 'stripe', 'checkout.session.completed', 'evt_123', '{}', '2026-09-15T00:00:00.000Z')
  `).run();
  assert.throws(() => {
    db.prepare(`
      INSERT INTO payment_events (id, account_id, provider, event_type, external_id, payload_json, processed_at)
      VALUES ('ev2', 'acc1', 'stripe', 'checkout.session.completed', 'evt_123', '{}', '2026-09-15T00:00:00.000Z')
    `).run();
  }, /UNIQUE constraint failed/); // (provider, event_type, external_id) must be unique

  db.prepare(`
    INSERT INTO promo_codes (code, kind, value, currency, applies_to_plan, grant_duration_days, max_redemptions, redeemed_count, expires_at, note, created_at, created_by)
    VALUES ('WELCOME10', 'percent_off', 10, NULL, NULL, NULL, 100, 0, NULL, 'launch promo', '2026-09-15T00:00:00.000Z', 'dima')
  `).run();
  db.prepare(`
    INSERT INTO promo_redemptions (id, code, account_id, redeemed_at)
    VALUES ('r1', 'WELCOME10', 'acc1', '2026-09-15T00:00:00.000Z')
  `).run();
  assert.throws(() => {
    db.prepare(`
      INSERT INTO promo_redemptions (id, code, account_id, redeemed_at)
      VALUES ('r2', 'WELCOME10', 'acc1', '2026-09-15T00:00:00.000Z')
    `).run();
  }, /UNIQUE constraint failed/); // one redemption per (code, account_id)
});
