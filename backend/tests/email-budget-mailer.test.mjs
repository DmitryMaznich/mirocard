// mailer ↔ email budget: only successful sends consume the budget, and an
// exhausted budget refuses without calling Resend at all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

let calls = 0;
let status = 200;
const fakeResend = createServer((req, res) => {
  calls++;
  req.resume();
  req.on("end", () => { res.writeHead(status, { "Content-Type": "application/json" }); res.end("{}"); });
});
await new Promise((r) => fakeResend.listen(0, "127.0.0.1", r));
test.after(() => fakeResend.close());

process.env.RESEND_API_KEY = "test-resend-key";
process.env.RESEND_API_URL = `http://127.0.0.1:${fakeResend.address().port}/emails`;

const { initDb } = await import("../lib/db.mjs");
const { createEmailBudget } = await import("../lib/email-budget.mjs");
const mailer = await import("../lib/mailer.mjs");

test("mailer records only successful sends and refuses when exhausted", async () => {
  const budget = createEmailBudget(initDb(":memory:"), { dailyCap: 2, signupCap: 1 });
  mailer.setEmailBudget(budget);

  status = 500;
  await assert.rejects(mailer.sendEmailVerificationEmail("a@example.test", "t"));
  assert.equal(budget.used(), 0, "failed send does not consume budget");

  status = 200;
  await mailer.sendEmailVerificationEmail("a@example.test", "t");
  await mailer.sendPasswordResetEmail("a@example.test", "t");
  assert.equal(budget.used(), 2);
  await assert.rejects(mailer.sendPasswordResetEmail("a@example.test", "t"), (e) => e.code === "email_budget_exhausted");
  assert.equal(calls, 3, "exhausted budget does not call Resend");
});
