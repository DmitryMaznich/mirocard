import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createOneTimeCode, consumeOneTimeCode } from "../lib/one-time-codes.mjs";

const T = 1_800_000_000_000;

test("a code expires after its ttl", () => {
  const db = initDb(":memory:");
  const code = createOneTimeCode(db, { kind: "google_login", payload: { a: 1 }, ttlMs: 1000, now: T });
  assert.equal(consumeOneTimeCode(db, code, "google_login", T + 1001), null);
});

test("a code of another kind is refused and stays usable for its own kind", () => {
  const db = initDb(":memory:");
  const code = createOneTimeCode(db, { kind: "google_signup", payload: { a: 1 }, now: T });
  assert.equal(consumeOneTimeCode(db, code, "google_signup_confirm", T), null);
  assert.deepEqual(consumeOneTimeCode(db, code, "google_signup", T), { kind: "google_signup", payload: { a: 1 } });
});

test("only a hash of the code is stored", () => {
  const db = initDb(":memory:");
  const code = createOneTimeCode(db, { kind: "google_login", payload: {}, now: T });
  const rows = db.prepare("SELECT code_hash FROM one_time_codes").all();
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].code_hash, code);
});
