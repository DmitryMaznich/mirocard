import { test } from "node:test";
import assert from "node:assert/strict";

const { initDb, grantAllAccessToExistingAccounts } = await import("../lib/db.mjs");
const { createAccount, activateAccount } = await import("../lib/account-repository.mjs");
const { hasActiveEntitlement, getActiveSubscriptionForAccount, grantTrialSubscription, findEntitlementsNeedingReminders } =
  await import("../lib/billing-repository.mjs");

function makeAccount(db, email, createdAt) {
  const acc = createAccount(db, { email, passwordHash: "h" });
  activateAccount(db, acc.id);
  db.prepare("UPDATE accounts SET created_at = ? WHERE id = ?").run(createdAt, acc.id);
  return acc;
}
const flags = (db, id) => JSON.parse(db.prepare("SELECT feature_flags FROM accounts WHERE id = ?").get(id).feature_flags);

test("accounts created before the cutoff get all_access; later ones don't; existing flags are kept", () => {
  const db = initDb(":memory:");
  const old = makeAccount(db, "old@x.test", "2026-05-01T10:00:00.000Z");
  const withFlag = makeAccount(db, "flag@x.test", "2026-05-01T10:00:00.000Z");
  db.prepare("UPDATE accounts SET feature_flags = ? WHERE id = ?").run(JSON.stringify(["beta"]), withFlag.id);
  const fresh = makeAccount(db, "new@x.test", "2026-10-01T10:00:00.000Z");

  assert.equal(grantAllAccessToExistingAccounts(db, { cutoff: "2026-09-23T22:00:00.000Z" }), 2);
  assert.deepEqual(flags(db, old.id), ["all_access"]);
  assert.deepEqual(flags(db, withFlag.id), ["beta", "all_access"]);
  assert.deepEqual(flags(db, fresh.id), []);
  assert.equal(hasActiveEntitlement(db, old.id), true);
  assert.equal(getActiveSubscriptionForAccount(db, old.id).plan, "all_access");
  assert.equal(hasActiveEntitlement(db, fresh.id), false);

  assert.equal(grantAllAccessToExistingAccounts(db, { cutoff: "2026-09-23T22:00:00.000Z" }), 0, "second run is a no-op");
});

test("an all_access account with a leftover expiring trial gets no expiry reminders", () => {
  const db = initDb(":memory:");
  const acc = makeAccount(db, "trial-old@x.test", "2026-05-01T10:00:00.000Z");
  grantTrialSubscription(db, acc.id, { trialDays: 2 });
  assert.equal(findEntitlementsNeedingReminders(db).length, 1, "sanity: due before the grant");
  grantAllAccessToExistingAccounts(db, { cutoff: "2026-09-23T22:00:00.000Z" });
  assert.deepEqual(findEntitlementsNeedingReminders(db), []);
});
