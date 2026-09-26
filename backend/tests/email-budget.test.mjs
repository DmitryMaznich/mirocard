import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createEmailBudget } from "../lib/email-budget.mjs";

function setup(opts = {}) {
  const db = initDb(":memory:");
  let t = Date.parse("2026-09-26T10:00:00Z");
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const budget = createEmailBudget(db, { dailyCap: 5, signupCap: 3, now: clock.now, ...opts });
  return { db, budget, clock };
}

test("signup closes at signupCap, sending continues until dailyCap", () => {
  const { budget } = setup();
  for (let i = 0; i < 3; i++) { assert.equal(budget.canStartSignup(), true); budget.record("verification"); }
  assert.equal(budget.canStartSignup(), false);
  assert.equal(budget.canSend(), true);
  budget.record("password_reset"); budget.record("verification");
  assert.equal(budget.used(), 5);
  assert.equal(budget.canSend(), false);
});

test("window is a rolling 24 hours", () => {
  const { budget, clock } = setup();
  for (let i = 0; i < 5; i++) budget.record("verification");
  assert.equal(budget.canSend(), false);
  clock.advance(23 * 3600e3);
  assert.equal(budget.canSend(), false);
  clock.advance(3600e3 + 1);
  assert.equal(budget.used(), 0);
  assert.equal(budget.canSend(), true);
});

test("rows older than 7 days are pruned on record", () => {
  const { db, budget, clock } = setup();
  budget.record("verification");
  clock.advance(8 * 86400e3);
  budget.record("verification");
  assert.equal(db.prepare("SELECT COUNT(*) c FROM email_send_log").get().c, 1);
});
