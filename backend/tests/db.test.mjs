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

test("sessions stores analytics timing and a params snapshot", () => {
  const db = initDb(":memory:");
  const cols = db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
  assert.ok(cols.includes("active_duration_ms"));
  assert.ok(cols.includes("elapsed_duration_ms"));
  assert.ok(cols.includes("params_snapshot_json"));
  assert.ok(cols.includes("entry_point"));
});
