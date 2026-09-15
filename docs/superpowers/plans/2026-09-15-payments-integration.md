# Payments Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Mironium account buy a subscription (month/half-year/year) by card (Stripe) or by a Mir/SBP card (Lava Top), or redeem a promo code for a discount or a free grant — and gate topic downloads on having an active entitlement.

**Architecture:** Backend is the source of truth: it creates a `pending` subscription row keyed by a Mironium-generated `orderId`, calls the chosen provider's API to get a hosted checkout URL, and only flips the row to `active` when that provider's webhook confirms payment. The two providers (Stripe for card payments, Lava Top for Mir/SBP) are implemented as small, swappable modules behind the same three-function shape (`create*`, `verify*WebhookAuth/Signature`, `parse*WebhookEvent`) so a third provider (e.g. Paddle) can be added later without touching the checkout/webhook orchestration. Promo codes reuse the same `subscriptions` table: a free-grant code writes an `active` row directly (`provider='promo'`), bypassing any payment provider; a discount code only changes the amount sent to the provider and is not marked "spent" until the webhook confirms payment.

**Tech Stack:** Node.js (`node:http`, `node:sqlite`, `node:test`, `node:crypto`), no new backend framework. React 18 (`react-dom/client`), Zustand store, Vitest for frontend tests. Stripe and Lava Top are both called via raw `fetch` (matching this codebase's existing `backend/lib/mailer.mjs` pattern for Resend) — no `stripe` npm SDK is added.

**Spec:** `docs/superpowers/specs/2026-09-13-lava-top-payments-design.md`

## Global Constraints

- Money is always an integer `amount_minor` (cents) plus a `currency` code — never a float.
- Plan prices come from the spec's already-live landing page and must not drift from it: monthly €9.90 (990), half-year €49.90 (4990), annual €89.90 (8990), all `EUR`.
- A discounted/free price is always computed server-side from `promo_codes` — a client-supplied price or discount amount is never trusted.
- Webhook handlers verify the request's authenticity (Stripe signature / Lava Top shared secret) **before** parsing the body as an event.
- Every webhook event is recorded once via `UNIQUE(provider, event_type, external_id)` on `payment_events` — a handler re-processes nothing on a duplicate delivery.
- New backend files get their own tiny local `now()`/`safeJson()` helpers rather than importing them from `account-repository.mjs` — this mirrors the existing duplication convention in this codebase (see `backend/lib/db.mjs` and `backend/lib/account-repository.mjs`, which each define their own copies).
- New in-app screens live in `src/features/billing/` and use the shared `.screen-header`/`.back-btn`/`.btn-primary` classes already in `src/styles.css` — no per-screen CSS file (that convention is for `src/topics/renderers/*` families only, not `src/features/*`).
- Backend commands run from `backend/`: `node --test tests/*.test.mjs`. Frontend commands run from the repo root: `npx vitest run <path>`.

---

## Task 1: Database schema — subscriptions, payment_events, promo_codes, promo_redemptions

**Files:**
- Modify: `backend/lib/db.mjs`
- Test: `backend/tests/db.test.mjs`

**Interfaces:**
- Produces: four tables every later backend task reads/writes via raw `db.prepare(...)` calls — `subscriptions` (one row per account, enforced by `UNIQUE(account_id)`), `payment_events`, `promo_codes`, `promo_redemptions`.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/db.test.mjs` (open the file first to match its existing `test(...)`/`initDb(":memory:")` style — add this as a new `test(...)` block):

```js
test("billing tables exist with expected columns", () => {
  const db = initDb(":memory:");

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
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/`): `node --test tests/db.test.mjs`
Expected: FAIL with `no such table: subscriptions`

- [ ] **Step 3: Add the tables**

In `backend/lib/db.mjs`, inside the `db.exec(\`...\`)` template string that creates the other tables (the same block that has `CREATE TABLE IF NOT EXISTS accounts` etc.), add:

```sql
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                   TEXT PRIMARY KEY,
      account_id           TEXT NOT NULL UNIQUE REFERENCES accounts(id),
      provider             TEXT NOT NULL,          -- 'stripe' | 'lava_top' | 'promo'
      plan                 TEXT NOT NULL,          -- 'monthly' | 'half_year' | 'annual' | 'free_grant'
      status               TEXT NOT NULL,          -- 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'refunded'
      currency             TEXT NOT NULL,
      amount_minor         INTEGER NOT NULL,
      external_contract_id TEXT UNIQUE,            -- Mironium-generated orderId, the correlation key with the provider
      applied_code         TEXT,                   -- promo code used at checkout, if any — finalized as redeemed only on webhook success
      current_period_end   TEXT NOT NULL,
      cancel_at_period_end INTEGER DEFAULT 0,
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_events (
      id           TEXT PRIMARY KEY,
      account_id   TEXT REFERENCES accounts(id),
      provider     TEXT NOT NULL,
      event_type   TEXT NOT NULL,
      external_id  TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      processed_at TEXT NOT NULL,
      UNIQUE(provider, event_type, external_id)
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      code                 TEXT PRIMARY KEY,
      kind                 TEXT NOT NULL,          -- 'percent_off' | 'fixed_off' | 'free_grant'
      value                INTEGER,
      currency             TEXT,
      applies_to_plan      TEXT,
      grant_duration_days  INTEGER,
      max_redemptions      INTEGER,
      redeemed_count       INTEGER NOT NULL DEFAULT 0,
      expires_at           TEXT,
      note                 TEXT,
      created_at           TEXT NOT NULL,
      created_by           TEXT
    );

    CREATE TABLE IF NOT EXISTS promo_redemptions (
      id          TEXT PRIMARY KEY,
      code        TEXT NOT NULL REFERENCES promo_codes(code),
      account_id  TEXT NOT NULL REFERENCES accounts(id),
      redeemed_at TEXT NOT NULL,
      UNIQUE(code, account_id)
    );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/db.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/lib/db.mjs backend/tests/db.test.mjs
git commit -m "feat(billing): add subscriptions/payment_events/promo_codes/promo_redemptions tables

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `billing-repository.mjs` — subscriptions and payment events

**Files:**
- Create: `backend/lib/billing-repository.mjs`
- Test: `backend/tests/billing-repository.test.mjs`

**Interfaces:**
- Consumes: the tables from Task 1.
- Produces: `createPendingSubscription(db, accountId, { provider, plan, orderId, currency, amountMinor, periodDays, appliedCode })`, `activateSubscriptionByOrderId(db, orderId)` → returns `accountId` or `null`, `markSubscriptionRefundedByOrderId(db, orderId)`, `getSubscriptionByOrderId(db, orderId)`, `getActiveSubscriptionForAccount(db, accountId)` → `{ plan, status, currentPeriodEnd, cancelAtPeriodEnd } | null`, `recordPaymentEvent(db, { accountId, provider, eventType, externalId, payloadJson })` → `true` if newly recorded, `false` if a duplicate, `hasActiveEntitlement(db, accountId)` → boolean.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/billing-repository.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, activateAccount } from "../lib/account-repository.mjs";
import {
  createPendingSubscription,
  activateSubscriptionByOrderId,
  markSubscriptionRefundedByOrderId,
  getSubscriptionByOrderId,
  getActiveSubscriptionForAccount,
  recordPaymentEvent,
  hasActiveEntitlement,
} from "../lib/billing-repository.mjs";

function makeAccount(db) {
  const acc = createAccount(db, { email: "buyer@example.com", passwordHash: "h" });
  activateAccount(db, acc.id);
  return acc;
}

test("createPendingSubscription then activateSubscriptionByOrderId flips status to active", () => {
  const db = makeDb();
  const acc = makeAccount(db);

  createPendingSubscription(db, acc.id, {
    provider: "stripe", plan: "annual", orderId: "order-1",
    currency: "EUR", amountMinor: 8990, periodDays: 366, appliedCode: null,
  });

  assert.equal(getActiveSubscriptionForAccount(db, acc.id), null); // still pending

  const returnedAccountId = activateSubscriptionByOrderId(db, "order-1");
  assert.equal(returnedAccountId, acc.id);

  const active = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(active.plan, "annual");
  assert.equal(active.status, "active");
  assert.ok(hasActiveEntitlement(db, acc.id));
});

test("activateSubscriptionByOrderId returns null for an unknown orderId", () => {
  const db = makeDb();
  assert.equal(activateSubscriptionByOrderId(db, "nope"), null);
});

test("markSubscriptionRefundedByOrderId revokes entitlement", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPendingSubscription(db, acc.id, {
    provider: "stripe", plan: "monthly", orderId: "order-2",
    currency: "EUR", amountMinor: 990, periodDays: 31, appliedCode: null,
  });
  activateSubscriptionByOrderId(db, "order-2");
  assert.ok(hasActiveEntitlement(db, acc.id));

  markSubscriptionRefundedByOrderId(db, "order-2");
  assert.equal(hasActiveEntitlement(db, acc.id), false);
  assert.equal(getSubscriptionByOrderId(db, "order-2").status, "refunded");
});

test("recordPaymentEvent returns true once, false on a duplicate delivery", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  const args = { accountId: acc.id, provider: "stripe", eventType: "checkout.session.completed", externalId: "evt_1", payloadJson: "{}" };
  assert.equal(recordPaymentEvent(db, args), true);
  assert.equal(recordPaymentEvent(db, args), false);
});

test("hasActiveEntitlement is true for an account with the all_access feature flag, even without a subscription", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  db.prepare("UPDATE accounts SET feature_flags = ? WHERE id = ?").run(JSON.stringify(["all_access"]), acc.id);
  assert.ok(hasActiveEntitlement(db, acc.id));
});

test("hasActiveEntitlement is false for an unknown account", () => {
  const db = makeDb();
  assert.equal(hasActiveEntitlement(db, "no-such-account"), false);
});

function makeDb() { return initDb(":memory:"); }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/billing-repository.test.mjs`
Expected: FAIL — `Cannot find module '../lib/billing-repository.mjs'`

- [ ] **Step 3: Write the implementation**

Create `backend/lib/billing-repository.mjs`:

```js
import { randomUUID } from "node:crypto";

function now() { return new Date().toISOString(); }

function safeJson(value, fallback) {
  try { return JSON.parse(value ?? "null") ?? fallback; }
  catch { return fallback; }
}

export function createPendingSubscription(db, accountId, {
  provider, plan, orderId, currency, amountMinor, periodDays, appliedCode = null,
}) {
  const ts = now();
  const currentPeriodEnd = new Date(Date.now() + periodDays * 86400000).toISOString();
  db.prepare(`
    INSERT INTO subscriptions
      (id, account_id, provider, plan, status, currency, amount_minor, external_contract_id, applied_code, current_period_end, cancel_at_period_end, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      provider = excluded.provider,
      plan = excluded.plan,
      status = 'pending',
      currency = excluded.currency,
      amount_minor = excluded.amount_minor,
      external_contract_id = excluded.external_contract_id,
      applied_code = excluded.applied_code,
      current_period_end = excluded.current_period_end,
      updated_at = excluded.updated_at
  `).run(randomUUID(), accountId, provider, plan, currency, amountMinor, orderId, appliedCode, currentPeriodEnd, ts, ts);
}

export function getSubscriptionByOrderId(db, orderId) {
  return db.prepare("SELECT * FROM subscriptions WHERE external_contract_id = ?").get(orderId) ?? null;
}

export function activateSubscriptionByOrderId(db, orderId) {
  const row = getSubscriptionByOrderId(db, orderId);
  if (!row) return null;
  db.prepare("UPDATE subscriptions SET status = 'active', updated_at = ? WHERE id = ?").run(now(), row.id);
  return row.account_id;
}

export function markSubscriptionRefundedByOrderId(db, orderId) {
  const row = getSubscriptionByOrderId(db, orderId);
  if (!row) return null;
  db.prepare("UPDATE subscriptions SET status = 'refunded', updated_at = ? WHERE id = ?").run(now(), row.id);
  return row.account_id;
}

export function getActiveSubscriptionForAccount(db, accountId) {
  const row = db.prepare("SELECT * FROM subscriptions WHERE account_id = ?").get(accountId);
  if (!row || row.status !== "active") return null;
  return {
    plan: row.plan,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
  };
}

// Returns true if this is the first time this exact provider event has been
// seen (caller should act on it), false if it's a duplicate delivery.
export function recordPaymentEvent(db, { accountId, provider, eventType, externalId, payloadJson }) {
  try {
    db.prepare(`
      INSERT INTO payment_events (id, account_id, provider, event_type, external_id, payload_json, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), accountId, provider, eventType, externalId, payloadJson, now());
    return true;
  } catch (err) {
    if (/UNIQUE constraint failed/.test(err.message)) return false;
    throw err;
  }
}

export function hasActiveEntitlement(db, accountId) {
  const account = db.prepare("SELECT feature_flags FROM accounts WHERE id = ?").get(accountId);
  if (!account) return false;
  const flags = safeJson(account.feature_flags, []);
  if (flags.includes("all_access")) return true;

  const sub = db.prepare("SELECT status, current_period_end FROM subscriptions WHERE account_id = ?").get(accountId);
  return Boolean(sub && sub.status === "active" && sub.current_period_end > now());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/billing-repository.test.mjs`
Expected: PASS (all 6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/lib/billing-repository.mjs backend/tests/billing-repository.test.mjs
git commit -m "feat(billing): add subscription lifecycle + entitlement repository functions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `billing-repository.mjs` — promo codes and redemptions

**Files:**
- Modify: `backend/lib/billing-repository.mjs`
- Test: `backend/tests/billing-repository.test.mjs`

**Interfaces:**
- Consumes: `promo_codes`/`promo_redemptions` from Task 1, `createPendingSubscription`'s account-level `subscriptions` row shape from Task 2.
- Produces: `createPromoCode(db, { code, kind, value, currency, appliesToPlan, grantDurationDays, maxRedemptions, expiresAt, note, createdBy })`, `listPromoCodes(db)`, `validatePromoCode(db, rawCode, { accountId, plan })` → `{ ok: true, code, kind, value, currency, grantDurationDays } | { ok: false, reason }`, `redeemFreeGrantCode(db, rawCode, accountId)` → same shape as `validatePromoCode`, `finalizeDiscountRedemption(db, code, accountId)`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/billing-repository.test.mjs` (add these imports to the existing import block from `../lib/billing-repository.mjs`: `createPromoCode, listPromoCodes, validatePromoCode, redeemFreeGrantCode, finalizeDiscountRedemption`):

```js
test("validatePromoCode rejects an unknown code", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  const result = validatePromoCode(db, "NOPE", { accountId: acc.id, plan: "monthly" });
  assert.deepEqual(result, { ok: false, reason: "not_found" });
});

test("validatePromoCode accepts a matching percent_off code and normalizes case", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "welcome10", kind: "percent_off", value: 10, currency: null,
    appliesToPlan: null, grantDurationDays: null, maxRedemptions: null,
    expiresAt: null, note: "launch", createdBy: "dima",
  });
  const result = validatePromoCode(db, "Welcome10", { accountId: acc.id, plan: "monthly" });
  assert.equal(result.ok, true);
  assert.equal(result.code, "WELCOME10");
  assert.equal(result.kind, "percent_off");
  assert.equal(result.value, 10);
});

test("validatePromoCode rejects a code already redeemed by this account", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "ONE-USE", kind: "free_grant", value: null, currency: null,
    appliesToPlan: null, grantDurationDays: 30, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  assert.equal(redeemFreeGrantCode(db, "ONE-USE", acc.id).ok, true);
  const second = validatePromoCode(db, "ONE-USE", { accountId: acc.id, plan: "monthly" });
  assert.deepEqual(second, { ok: false, reason: "already_used" });
});

test("validatePromoCode rejects a code restricted to a different plan", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "ANNUAL-ONLY", kind: "fixed_off", value: 1000, currency: "EUR",
    appliesToPlan: "annual", grantDurationDays: null, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  const result = validatePromoCode(db, "ANNUAL-ONLY", { accountId: acc.id, plan: "monthly" });
  assert.deepEqual(result, { ok: false, reason: "wrong_plan" });
});

test("validatePromoCode rejects a code once max_redemptions is reached", () => {
  const db = makeDb();
  const acc1 = makeAccount(db);
  createPromoCode(db, {
    code: "LIMIT1", kind: "free_grant", value: null, currency: null,
    appliesToPlan: null, grantDurationDays: null, maxRedemptions: 1,
    expiresAt: null, note: null, createdBy: "dima",
  });
  assert.equal(redeemFreeGrantCode(db, "LIMIT1", acc1.id).ok, true);

  const acc2 = createAccount(db, { email: "second@example.com", passwordHash: "h" });
  activateAccount(db, acc2.id);
  const result = validatePromoCode(db, "LIMIT1", { accountId: acc2.id, plan: "monthly" });
  assert.deepEqual(result, { ok: false, reason: "exhausted" });
});

test("redeemFreeGrantCode activates entitlement immediately without a payment provider", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "FREEBIE", kind: "free_grant", value: null, currency: null,
    appliesToPlan: null, grantDurationDays: 14, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  const result = redeemFreeGrantCode(db, "FREEBIE", acc.id);
  assert.equal(result.ok, true);
  assert.ok(hasActiveEntitlement(db, acc.id));
  const sub = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(sub.plan, "free_grant");
});

test("redeemFreeGrantCode refuses a discount-kind code", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "DISCOUNTONLY", kind: "percent_off", value: 20, currency: null,
    appliesToPlan: null, grantDurationDays: null, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  const result = redeemFreeGrantCode(db, "DISCOUNTONLY", acc.id);
  assert.deepEqual(result, { ok: false, reason: "not_free_grant" });
});

test("finalizeDiscountRedemption records one redemption and bumps redeemed_count, twice is a no-op", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "TENOFF", kind: "percent_off", value: 10, currency: null,
    appliesToPlan: null, grantDurationDays: null, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  finalizeDiscountRedemption(db, "TENOFF", acc.id);
  finalizeDiscountRedemption(db, "TENOFF", acc.id);
  assert.equal(listPromoCodes(db).find((c) => c.code === "TENOFF").redeemedCount, 1);
});

test("finalizeDiscountRedemption is a no-op when code is null", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  finalizeDiscountRedemption(db, null, acc.id); // must not throw
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/billing-repository.test.mjs`
Expected: FAIL — `createPromoCode is not a function`

- [ ] **Step 3: Write the implementation**

Append to `backend/lib/billing-repository.mjs`:

```js
export function createPromoCode(db, {
  code, kind, value = null, currency = null, appliesToPlan = null,
  grantDurationDays = null, maxRedemptions = null, expiresAt = null,
  note = null, createdBy = null,
}) {
  db.prepare(`
    INSERT INTO promo_codes
      (code, kind, value, currency, applies_to_plan, grant_duration_days, max_redemptions, redeemed_count, expires_at, note, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
  `).run(code.trim().toUpperCase(), kind, value, currency, appliesToPlan, grantDurationDays, maxRedemptions, expiresAt, note, now(), createdBy);
}

export function listPromoCodes(db) {
  return db.prepare("SELECT * FROM promo_codes ORDER BY created_at DESC").all().map((row) => ({
    code: row.code,
    kind: row.kind,
    value: row.value,
    currency: row.currency,
    appliesToPlan: row.applies_to_plan,
    grantDurationDays: row.grant_duration_days,
    maxRedemptions: row.max_redemptions,
    redeemedCount: row.redeemed_count,
    expiresAt: row.expires_at,
    note: row.note,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}

export function validatePromoCode(db, rawCode, { accountId, plan }) {
  const code = String(rawCode ?? "").trim().toUpperCase();
  if (!code) return { ok: false, reason: "not_found" };

  const row = db.prepare("SELECT * FROM promo_codes WHERE code = ?").get(code);
  if (!row) return { ok: false, reason: "not_found" };
  if (row.expires_at && row.expires_at < now()) return { ok: false, reason: "expired" };
  if (row.max_redemptions != null && row.redeemed_count >= row.max_redemptions) return { ok: false, reason: "exhausted" };
  if (row.applies_to_plan && plan && row.applies_to_plan !== plan) return { ok: false, reason: "wrong_plan" };

  const already = db.prepare(
    "SELECT 1 FROM promo_redemptions WHERE code = ? AND account_id = ?"
  ).get(code, accountId);
  if (already) return { ok: false, reason: "already_used" };

  return {
    ok: true,
    code,
    kind: row.kind,
    value: row.value,
    currency: row.currency,
    grantDurationDays: row.grant_duration_days,
  };
}

function recordRedemption(db, code, accountId) {
  db.prepare(
    "INSERT INTO promo_redemptions (id, code, account_id, redeemed_at) VALUES (?, ?, ?, ?)"
  ).run(randomUUID(), code, accountId, now());
  db.prepare("UPDATE promo_codes SET redeemed_count = redeemed_count + 1 WHERE code = ?").run(code);
}

export function redeemFreeGrantCode(db, rawCode, accountId) {
  const validation = validatePromoCode(db, rawCode, { accountId, plan: null });
  if (!validation.ok) return validation;
  if (validation.kind !== "free_grant") return { ok: false, reason: "not_free_grant" };

  const ts = now();
  const currentPeriodEnd = validation.grantDurationDays
    ? new Date(Date.now() + validation.grantDurationDays * 86400000).toISOString()
    : "9999-12-31T00:00:00.000Z"; // no expiry

  db.prepare(`
    INSERT INTO subscriptions
      (id, account_id, provider, plan, status, currency, amount_minor, external_contract_id, applied_code, current_period_end, cancel_at_period_end, created_at, updated_at)
    VALUES (?, ?, 'promo', 'free_grant', 'active', 'EUR', 0, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      provider = 'promo', plan = 'free_grant', status = 'active',
      applied_code = excluded.applied_code,
      current_period_end = excluded.current_period_end,
      updated_at = excluded.updated_at
  `).run(randomUUID(), accountId, `promo:${validation.code}:${accountId}`, validation.code, currentPeriodEnd, ts, ts);

  recordRedemption(db, validation.code, accountId);
  return { ok: true };
}

export function finalizeDiscountRedemption(db, code, accountId) {
  if (!code) return;
  const already = db.prepare(
    "SELECT 1 FROM promo_redemptions WHERE code = ? AND account_id = ?"
  ).get(code, accountId);
  if (already) return;
  recordRedemption(db, code, accountId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/billing-repository.test.mjs`
Expected: PASS (all tests, 6 from Task 2 + 8 from this task)

- [ ] **Step 5: Commit**

```bash
git add backend/lib/billing-repository.mjs backend/tests/billing-repository.test.mjs
git commit -m "feat(billing): add promo code validation and redemption

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `billing-plans.mjs` — plan catalog and discount math

**Files:**
- Create: `backend/lib/billing-plans.mjs`
- Test: `backend/tests/billing-plans.test.mjs`

**Interfaces:**
- Produces: `PLAN_CATALOG` (object: `monthly | half_year | annual` → `{ label, amountMinor, currency, periodDays }`), `applyDiscount(amountMinor, { kind, value })` → integer.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/billing-plans.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAN_CATALOG, applyDiscount } from "../lib/billing-plans.mjs";

test("PLAN_CATALOG matches the live landing page prices", () => {
  assert.equal(PLAN_CATALOG.monthly.amountMinor, 990);
  assert.equal(PLAN_CATALOG.half_year.amountMinor, 4990);
  assert.equal(PLAN_CATALOG.annual.amountMinor, 8990);
  assert.equal(PLAN_CATALOG.monthly.currency, "EUR");
});

test("applyDiscount with percent_off rounds to the nearest cent", () => {
  assert.equal(applyDiscount(8990, { kind: "percent_off", value: 10 }), 8091);
});

test("applyDiscount with fixed_off subtracts a flat amount", () => {
  assert.equal(applyDiscount(8990, { kind: "fixed_off", value: 1000 }), 7990);
});

test("applyDiscount never goes below zero", () => {
  assert.equal(applyDiscount(500, { kind: "fixed_off", value: 10000 }), 0);
  assert.equal(applyDiscount(500, { kind: "percent_off", value: 100 }), 0);
});

test("applyDiscount with an unrecognized kind returns the amount unchanged", () => {
  assert.equal(applyDiscount(990, { kind: "free_grant", value: null }), 990);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/billing-plans.test.mjs`
Expected: FAIL — `Cannot find module '../lib/billing-plans.mjs'`

- [ ] **Step 3: Write the implementation**

Create `backend/lib/billing-plans.mjs`:

```js
// Prices mirror landing/index.html#pricing — keep these two in sync by hand;
// see docs/superpowers/specs/2026-09-13-lava-top-payments-design.md §1.
export const PLAN_CATALOG = {
  monthly:   { label: "Месяц",   amountMinor: 990,  currency: "EUR", periodDays: 31 },
  half_year: { label: "Полгода", amountMinor: 4990, currency: "EUR", periodDays: 183 },
  annual:    { label: "Год",     amountMinor: 8990, currency: "EUR", periodDays: 366 },
};

export function applyDiscount(amountMinor, { kind, value }) {
  if (kind === "percent_off") {
    return Math.max(0, Math.round(amountMinor * (1 - value / 100)));
  }
  if (kind === "fixed_off") {
    return Math.max(0, amountMinor - value);
  }
  return amountMinor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/billing-plans.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/lib/billing-plans.mjs backend/tests/billing-plans.test.mjs
git commit -m "feat(billing): add plan catalog and discount calculation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Billing config — env vars for both providers

**Files:**
- Modify: `backend/lib/config.mjs`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `LAVA_TOP_API_KEY`, `LAVA_TOP_WEBHOOK_SECRET` — consumed by Task 6 and Task 7.

- [ ] **Step 1: Add the config values**

In `backend/lib/config.mjs`, after the existing `// Push` section, add:

```js
// Billing — Stripe (card rail)
export const STRIPE_SECRET_KEY     = readEnv("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = readEnv("STRIPE_WEBHOOK_SECRET");

// Billing — Lava Top (Mir/SBP rail)
export const LAVA_TOP_API_KEY         = readEnv("LAVA_TOP_API_KEY");
export const LAVA_TOP_WEBHOOK_SECRET  = readEnv("LAVA_TOP_WEBHOOK_SECRET");
```

- [ ] **Step 2: Document the new vars**

Open `backend/.env.example` and add, following its existing `KEY=` style:

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
LAVA_TOP_API_KEY=
LAVA_TOP_WEBHOOK_SECRET=
```

- [ ] **Step 3: Verify the module still loads**

Run (from `backend/`): `node -e "import('./lib/config.mjs').then(m => console.log(typeof m.STRIPE_SECRET_KEY))"`
Expected: prints `string`

- [ ] **Step 4: Commit**

```bash
git add backend/lib/config.mjs backend/.env.example
git commit -m "feat(billing): add Stripe and Lava Top config vars

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Stripe provider module

**Files:**
- Create: `backend/lib/billing-providers/stripe.mjs`
- Test: `backend/tests/billing-providers.test.mjs`

**Interfaces:**
- Consumes: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_BASE_URL` from `backend/lib/config.mjs`.
- Produces: `createCheckoutSession({ orderId, planLabel, amountMinor, currency, accountEmail, accountId })` → `Promise<{ checkoutUrl, externalId }>`, `verifyStripeWebhookSignature(rawBody, signatureHeader)` → boolean, `parseStripeWebhookEvent(rawBody)` → `{ eventType, externalId, orderId, amountMinor, currency }`.

Uses Stripe's real, stable Checkout Sessions REST API (form-encoded body, bracket-notation for nested params) called via `fetch` — the same "raw fetch to a documented REST API" pattern already used for Resend in `backend/lib/mailer.mjs`. If Stripe Managed Payments (see spec §9 point 1) is confirmed available and preferred by the time this ships, only the body this function builds changes — its `{checkoutUrl, externalId}` return shape, and everything that calls it, stay the same.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/billing-providers.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

// STRIPE_WEBHOOK_SECRET must be set before importing the module, since
// config.mjs reads process.env at import time.
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.STRIPE_SECRET_KEY = "sk_test_123";

const { createCheckoutSession, verifyStripeWebhookSignature, parseStripeWebhookEvent } =
  await import("../lib/billing-providers/stripe.mjs");

function withStubbedFetch(stub, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  return fn().finally(() => { globalThis.fetch = original; });
}

test("createCheckoutSession posts to Stripe and returns the hosted URL", async () => {
  let capturedUrl, capturedInit;
  await withStubbedFetch(async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return {
      ok: true,
      json: async () => ({ id: "cs_test_abc", url: "https://checkout.stripe.com/pay/cs_test_abc" }),
    };
  }, async () => {
    const result = await createCheckoutSession({
      orderId: "order-1", planLabel: "Год", amountMinor: 8990, currency: "EUR",
      accountEmail: "buyer@example.com", accountId: "acc-1",
    });
    assert.equal(result.checkoutUrl, "https://checkout.stripe.com/pay/cs_test_abc");
    assert.equal(result.externalId, "cs_test_abc");
  });

  assert.equal(capturedUrl, "https://api.stripe.com/v1/checkout/sessions");
  assert.equal(capturedInit.headers.Authorization, "Bearer sk_test_123");
  assert.match(capturedInit.body, /client_reference_id=order-1/);
  assert.match(capturedInit.body, /metadata%5BaccountId%5D=acc-1/); // metadata[accountId]=acc-1, URL-encoded
});

test("createCheckoutSession throws with Stripe's error body on a non-ok response", async () => {
  await withStubbedFetch(async () => ({ ok: false, status: 402, text: async () => "card declined" }), async () => {
    await assert.rejects(
      () => createCheckoutSession({
        orderId: "o", planLabel: "Месяц", amountMinor: 990, currency: "EUR",
        accountEmail: "a@b.com", accountId: "acc-1",
      }),
      /Stripe API error 402: card declined/
    );
  });
});

test("verifyStripeWebhookSignature accepts a correctly-signed payload", () => {
  const rawBody = '{"id":"evt_1"}';
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${rawBody}`;
  const signature = createHmac("sha256", "whsec_test_secret").update(signedPayload).digest("hex");
  assert.ok(verifyStripeWebhookSignature(rawBody, `t=${timestamp},v1=${signature}`));
});

test("verifyStripeWebhookSignature rejects a tampered payload", () => {
  const rawBody = '{"id":"evt_1"}';
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", "whsec_test_secret").update(`${timestamp}.{"id":"evt_2"}`).digest("hex");
  assert.equal(verifyStripeWebhookSignature(rawBody, `t=${timestamp},v1=${signature}`), false);
});

test("verifyStripeWebhookSignature rejects a missing header", () => {
  assert.equal(verifyStripeWebhookSignature("{}", undefined), false);
});

test("parseStripeWebhookEvent extracts orderId and amount from a checkout.session.completed event", () => {
  const rawBody = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: {
      id: "cs_test_abc",
      client_reference_id: "order-1",
      amount_total: 8990,
      currency: "eur",
      metadata: { accountId: "acc-1", orderId: "order-1" },
    } },
  });
  const event = parseStripeWebhookEvent(rawBody);
  assert.equal(event.eventType, "checkout.session.completed");
  assert.equal(event.externalId, "evt_1");
  assert.equal(event.orderId, "order-1");
  assert.equal(event.amountMinor, 8990);
  assert.equal(event.currency, "EUR");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/billing-providers.test.mjs`
Expected: FAIL — `Cannot find module '../lib/billing-providers/stripe.mjs'`

- [ ] **Step 3: Write the implementation**

Create `backend/lib/billing-providers/stripe.mjs`:

```js
import { createHmac, timingSafeEqual } from "node:crypto";
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, APP_BASE_URL } from "../config.mjs";

// Stripe's REST API takes application/x-www-form-urlencoded, with
// bracket-notation for nested objects/arrays (e.g. metadata[accountId]=...,
// line_items[0][price_data][currency]=...).
function toFormBody(obj, prefix = "") {
  const parts = [];
  for (const [key, value] of Object.entries(obj)) {
    const paramKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === "object") parts.push(toFormBody(item, `${paramKey}[${i}]`));
        else parts.push(`${encodeURIComponent(`${paramKey}[${i}]`)}=${encodeURIComponent(item)}`);
      });
    } else if (value && typeof value === "object") {
      parts.push(toFormBody(value, paramKey));
    } else if (value !== undefined && value !== null) {
      parts.push(`${encodeURIComponent(paramKey)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.join("&");
}

export async function createCheckoutSession({ orderId, planLabel, amountMinor, currency, accountEmail, accountId }) {
  const body = toFormBody({
    mode: "payment",
    success_url: `${APP_BASE_URL}/?checkout=success&order=${orderId}`,
    cancel_url: `${APP_BASE_URL}/?checkout=cancelled&order=${orderId}`,
    customer_email: accountEmail,
    client_reference_id: orderId,
    metadata: { accountId, orderId },
    line_items: [{
      quantity: 1,
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: amountMinor,
        product_data: { name: planLabel },
      },
    }],
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Stripe API error ${res.status}: ${errText}`);
  }
  const session = await res.json();
  return { checkoutUrl: session.url, externalId: session.id };
}

export function verifyStripeWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((kv) => kv.split("=")));
  const { t: timestamp, v1: expectedSig } = parts;
  if (!timestamp || !expectedSig) return false;

  const computed = createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function parseStripeWebhookEvent(rawBody) {
  const event = JSON.parse(rawBody);
  const obj = event.data?.object ?? {};
  return {
    eventType: event.type,
    externalId: event.id,
    orderId: obj.metadata?.orderId ?? obj.client_reference_id ?? null,
    amountMinor: obj.amount_total ?? obj.amount_subtotal ?? null,
    currency: obj.currency ? obj.currency.toUpperCase() : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/billing-providers.test.mjs`
Expected: PASS (all 7 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/lib/billing-providers/stripe.mjs backend/tests/billing-providers.test.mjs
git commit -m "feat(billing): add Stripe checkout + webhook verification module

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Lava Top provider module

**Files:**
- Create: `backend/lib/billing-providers/lava-top.mjs`
- Test: `backend/tests/billing-providers.test.mjs`

**Interfaces:**
- Consumes: `LAVA_TOP_API_KEY`, `LAVA_TOP_WEBHOOK_SECRET` from `backend/lib/config.mjs`.
- Produces: `createInvoice({ orderId, amountMinor, currency, accountEmail })` → `Promise<{ checkoutUrl, externalId }>`, `verifyLavaTopWebhookAuth(headerValue)` → boolean, `parseLavaTopWebhookEvent(rawBody)` → `{ eventType, externalId, orderId, amountMinor, currency }`.

The request/response field names (`offerId`/`clientUtm`/`paymentUrl`/`contractId`) are per Lava Top's Public API reference at `https://gate.lava.top/docs` as researched during the spec's design phase — confirm them against the live docs (or a support ticket) before the first real sandbox call, per spec §9 point 1; the shape below is what their docs describe for a custom-amount invoice with a webhook-delivered result.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/billing-providers.test.mjs` (add near the top, alongside the Stripe env vars):

```js
process.env.LAVA_TOP_API_KEY = "lava_test_key";
process.env.LAVA_TOP_WEBHOOK_SECRET = "lava_test_webhook_secret";

const { createInvoice, verifyLavaTopWebhookAuth, parseLavaTopWebhookEvent } =
  await import("../lib/billing-providers/lava-top.mjs");

test("createInvoice posts to Lava Top's invoice endpoint and returns the hosted URL", async () => {
  let capturedUrl, capturedInit;
  await withStubbedFetch(async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return { ok: true, json: async () => ({ id: "contract_1", paymentUrl: "https://pay.lava.top/contract_1" }) };
  }, async () => {
    const result = await createInvoice({ orderId: "order-2", amountMinor: 8990, currency: "EUR", accountEmail: "buyer@example.com" });
    assert.equal(result.checkoutUrl, "https://pay.lava.top/contract_1");
    assert.equal(result.externalId, "contract_1");
  });

  assert.equal(capturedUrl, "https://gate.lava.top/api/v3/invoice");
  assert.equal(capturedInit.headers["X-Api-Key"], "lava_test_key");
  const sentBody = JSON.parse(capturedInit.body);
  assert.equal(sentBody.email, "buyer@example.com");
  assert.equal(sentBody.amount, 89.9); // amountMinor/100
  assert.equal(sentBody.clientUtm.orderId, "order-2");
});

test("createInvoice throws with Lava Top's error body on a non-ok response", async () => {
  await withStubbedFetch(async () => ({ ok: false, status: 400, text: async () => "bad request" }), async () => {
    await assert.rejects(
      () => createInvoice({ orderId: "o", amountMinor: 990, currency: "EUR", accountEmail: "a@b.com" }),
      /Lava Top API error 400: bad request/
    );
  });
});

test("verifyLavaTopWebhookAuth accepts the configured shared secret", () => {
  assert.ok(verifyLavaTopWebhookAuth("lava_test_webhook_secret"));
});

test("verifyLavaTopWebhookAuth rejects a wrong or missing secret", () => {
  assert.equal(verifyLavaTopWebhookAuth("wrong"), false);
  assert.equal(verifyLavaTopWebhookAuth(undefined), false);
});

test("parseLavaTopWebhookEvent extracts orderId and amount from a payment.success event", () => {
  const rawBody = JSON.stringify({
    eventType: "payment.success",
    contractId: "contract_1",
    amount: 89.9,
    currency: "EUR",
    clientUtm: { orderId: "order-2" },
  });
  const event = parseLavaTopWebhookEvent(rawBody);
  assert.equal(event.eventType, "payment.success");
  assert.equal(event.externalId, "contract_1");
  assert.equal(event.orderId, "order-2");
  assert.equal(event.amountMinor, 8990);
  assert.equal(event.currency, "EUR");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/billing-providers.test.mjs`
Expected: FAIL — `Cannot find module '../lib/billing-providers/lava-top.mjs'`

- [ ] **Step 3: Write the implementation**

Create `backend/lib/billing-providers/lava-top.mjs`:

```js
import { LAVA_TOP_API_KEY, LAVA_TOP_WEBHOOK_SECRET } from "../config.mjs";

export async function createInvoice({ orderId, amountMinor, currency, accountEmail }) {
  const res = await fetch("https://gate.lava.top/api/v3/invoice", {
    method: "POST",
    headers: {
      "X-Api-Key": LAVA_TOP_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: accountEmail,
      currency,
      amount: amountMinor / 100,
      clientUtm: { orderId },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Lava Top API error ${res.status}: ${errText}`);
  }
  const invoice = await res.json();
  return { checkoutUrl: invoice.paymentUrl, externalId: invoice.id };
}

// Lava Top authenticates its webhook deliveries with a shared secret set
// when the webhook URL is registered in their dashboard (spec §7) — sent
// back as the X-Api-Key header on each delivery.
export function verifyLavaTopWebhookAuth(headerValue) {
  return Boolean(headerValue) && headerValue === LAVA_TOP_WEBHOOK_SECRET;
}

export function parseLavaTopWebhookEvent(rawBody) {
  const event = JSON.parse(rawBody);
  return {
    eventType: event.eventType,
    externalId: event.contractId,
    orderId: event.clientUtm?.orderId ?? null,
    amountMinor: event.amount != null ? Math.round(event.amount * 100) : null,
    currency: event.currency ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/billing-providers.test.mjs`
Expected: PASS (all 12 tests — 7 from Task 6 + 5 from this task)

- [ ] **Step 5: Commit**

```bash
git add backend/lib/billing-providers/lava-top.mjs backend/tests/billing-providers.test.mjs
git commit -m "feat(billing): add Lava Top invoice + webhook auth module

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `POST /billing/checkout` endpoint

**Files:**
- Modify: `backend/server.mjs`

**Interfaces:**
- Consumes: `requireAuth`, `db` (existing); `PLAN_CATALOG`, `applyDiscount` (Task 4); `createPendingSubscription` (Task 2); `validatePromoCode` (Task 3); `createCheckoutSession` (Task 6); `createInvoice` (Task 7).
- Produces: route `POST /billing/checkout` → `{ checkoutUrl, orderId, appliedCode }`.

This task has no isolated unit test of its own — `server.mjs`'s router is exercised as a whole in Task 9's integration test, once both the checkout and webhook endpoints exist end-to-end. This step is checked manually.

- [ ] **Step 1: Add the imports**

In `backend/server.mjs`, add near the other `./lib/*` imports (after the `student-portal.mjs` import block):

```js
import {
  createPendingSubscription, getActiveSubscriptionForAccount,
  hasActiveEntitlement, validatePromoCode, redeemFreeGrantCode,
} from "./lib/billing-repository.mjs";
import { PLAN_CATALOG, applyDiscount } from "./lib/billing-plans.mjs";
import {
  createCheckoutSession as createStripeCheckoutSession,
  verifyStripeWebhookSignature, parseStripeWebhookEvent,
} from "./lib/billing-providers/stripe.mjs";
import {
  createInvoice as createLavaTopInvoice,
  verifyLavaTopWebhookAuth, parseLavaTopWebhookEvent,
} from "./lib/billing-providers/lava-top.mjs";
```

- [ ] **Step 2: Add the handler**

Add this function near the other `handle*` functions (a good spot is right before the `// ─── Student topic links...` section, since billing sits conceptually next to topics/entitlement):

```js
// ─── Billing ────────────────────────────────────────────────────────────────

const CHECKOUT_METHODS = { card: "stripe", mir_sbp: "lava_top" };

async function handleBillingCheckout(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  const { plan, method, code } = body ?? {};

  const planDef = PLAN_CATALOG[plan];
  if (!planDef) return writeJson(res, 400, { error: "Unknown plan" });
  const provider = CHECKOUT_METHODS[method];
  if (!provider) return writeJson(res, 400, { error: "Unknown payment method" });

  let amountMinor = planDef.amountMinor;
  let appliedCode = null;
  if (code) {
    const validation = validatePromoCode(db, code, { accountId: account.id, plan });
    if (validation.ok && validation.kind !== "free_grant") {
      amountMinor = applyDiscount(amountMinor, validation);
      appliedCode = validation.code;
    }
  }

  const orderId = randomUUID();
  createPendingSubscription(db, account.id, {
    provider, plan, orderId, currency: planDef.currency, amountMinor,
    periodDays: planDef.periodDays, appliedCode,
  });

  try {
    let checkoutUrl;
    if (provider === "stripe") {
      ({ checkoutUrl } = await createStripeCheckoutSession({
        orderId, planLabel: planDef.label, amountMinor, currency: planDef.currency,
        accountEmail: account.email, accountId: account.id,
      }));
    } else {
      ({ checkoutUrl } = await createLavaTopInvoice({
        orderId, amountMinor, currency: planDef.currency, accountEmail: account.email,
      }));
    }
    writeJson(res, 200, { checkoutUrl, orderId, appliedCode });
  } catch (err) {
    writeJson(res, 502, { error: "Payment provider error", detail: err.message });
  }
}
```

- [ ] **Step 3: Register the route**

In the router's `try { ... }` block, add near the `// Sync` section:

```js
    // Billing
    if (method === "POST" && p === "/billing/checkout") return await handleBillingCheckout(req, res);
```

- [ ] **Step 4: Manual smoke check**

Run the backend locally (`node --env-file=.env server.mjs` from `backend/`, with dummy `STRIPE_SECRET_KEY`/`LAVA_TOP_API_KEY` values in `.env`), register a test account via `POST /api/auth/register` + `POST /api/auth/login` to get a token, then:

```bash
curl -X POST http://localhost:3012/api/billing/checkout \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"plan":"monthly","method":"card"}'
```

Expected: a `502` with a Stripe auth error (since the dummy key is invalid) — confirms routing, auth, and the `createPendingSubscription` call all ran before the network call failed. Check `SELECT * FROM subscriptions` in the dev DB shows a `pending` row.

- [ ] **Step 5: Commit**

```bash
git add backend/server.mjs
git commit -m "feat(billing): add POST /billing/checkout endpoint

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Webhook event orchestration + endpoints

**Files:**
- Create: `backend/lib/billing-orchestrator.mjs`
- Modify: `backend/server.mjs`
- Test: `backend/tests/billing-orchestrator.test.mjs`

**Interfaces:**
- Consumes: `getSubscriptionByOrderId`, `recordPaymentEvent`, `activateSubscriptionByOrderId`, `markSubscriptionRefundedByOrderId`, `finalizeDiscountRedemption` (Task 2/3), `incrementRevision` (existing, `account-repository.mjs`).
- Produces: `processBillingEvent(db, { provider, event, rawBody })`; routes `POST /billing/webhook/stripe`, `POST /billing/webhook/lava-top`.

`processBillingEvent` deliberately lives in its own module, not in `server.mjs` — `server.mjs` unconditionally calls `createServer(router).listen(PORT)` at import time (see its bottom), so importing it from a test would start a real listening HTTP server on every test run. Keeping the orchestration logic in a plain module with no side effects avoids that entirely and keeps this task's test a fast, isolated unit test.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/billing-orchestrator.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import { createAccount, activateAccount } from "../lib/account-repository.mjs";
import {
  createPendingSubscription, hasActiveEntitlement, getActiveSubscriptionForAccount, createPromoCode,
} from "../lib/billing-repository.mjs";
import { processBillingEvent } from "../lib/billing-orchestrator.mjs";

function makeDb() { return initDb(":memory:"); }

let _accountCounter = 0;
function makeAccount(db) {
  _accountCounter += 1;
  const acc = createAccount(db, { email: `buyer${_accountCounter}@example.com`, passwordHash: "h" });
  activateAccount(db, acc.id);
  return acc;
}

test("processBillingEvent activates a pending subscription on a success event", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPendingSubscription(db, acc.id, {
    provider: "stripe", plan: "annual", orderId: "order-1",
    currency: "EUR", amountMinor: 8990, periodDays: 366,
  });

  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_1", orderId: "order-1", amountMinor: 8990, currency: "EUR" },
    rawBody: "{}",
  });

  assert.ok(hasActiveEntitlement(db, acc.id));
});

test("processBillingEvent finalizes a promo redemption alongside activation", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPromoCode(db, {
    code: "TENOFF", kind: "percent_off", value: 10, currency: null,
    appliesToPlan: null, grantDurationDays: null, maxRedemptions: null,
    expiresAt: null, note: null, createdBy: "dima",
  });
  createPendingSubscription(db, acc.id, {
    provider: "stripe", plan: "monthly", orderId: "order-2",
    currency: "EUR", amountMinor: 891, periodDays: 31, appliedCode: "TENOFF",
  });

  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_2", orderId: "order-2", amountMinor: 891, currency: "EUR" },
    rawBody: "{}",
  });

  const redeemed = db.prepare("SELECT 1 FROM promo_redemptions WHERE code = 'TENOFF' AND account_id = ?").get(acc.id);
  assert.ok(redeemed);
});

test("processBillingEvent ignores an event with no matching orderId", () => {
  const db = makeDb();
  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_3", orderId: "no-such-order", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  }); // must not throw
});

test("processBillingEvent is idempotent — replaying the same event twice activates once", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPendingSubscription(db, acc.id, {
    provider: "lava_top", plan: "monthly", orderId: "order-4",
    currency: "EUR", amountMinor: 990, periodDays: 31,
  });
  const event = { eventType: "payment.success", externalId: "contract_1", orderId: "order-4", amountMinor: 990, currency: "EUR" };
  processBillingEvent(db, { provider: "lava_top", event, rawBody: "{}" });
  processBillingEvent(db, { provider: "lava_top", event, rawBody: "{}" }); // duplicate delivery

  const sub = getActiveSubscriptionForAccount(db, acc.id);
  assert.equal(sub.status, "active"); // no error, no double-processing
});

test("processBillingEvent revokes entitlement on a refund event", () => {
  const db = makeDb();
  const acc = makeAccount(db);
  createPendingSubscription(db, acc.id, {
    provider: "stripe", plan: "monthly", orderId: "order-5",
    currency: "EUR", amountMinor: 990, periodDays: 31,
  });
  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "checkout.session.completed", externalId: "evt_5a", orderId: "order-5", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.ok(hasActiveEntitlement(db, acc.id));

  processBillingEvent(db, {
    provider: "stripe",
    event: { eventType: "charge.refunded", externalId: "evt_5b", orderId: "order-5", amountMinor: 990, currency: "EUR" },
    rawBody: "{}",
  });
  assert.equal(hasActiveEntitlement(db, acc.id), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/billing-orchestrator.test.mjs`
Expected: FAIL — `Cannot find module '../lib/billing-orchestrator.mjs'`

- [ ] **Step 3: Write the implementation**

Create `backend/lib/billing-orchestrator.mjs`:

```js
import { incrementRevision } from "./account-repository.mjs";
import {
  getSubscriptionByOrderId, recordPaymentEvent, activateSubscriptionByOrderId,
  markSubscriptionRefundedByOrderId, finalizeDiscountRedemption,
} from "./billing-repository.mjs";

const SUCCESS_EVENT_TYPES = new Set([
  "checkout.session.completed", "payment.success", "subscription.recurring.payment.success",
]);
const REFUND_EVENT_TYPES = new Set(["charge.refunded", "refund.success", "chargeback.initiated"]);

export function processBillingEvent(db, { provider, event, rawBody }) {
  if (!event.orderId) return;
  const row = getSubscriptionByOrderId(db, event.orderId);
  if (!row) return;

  const isNew = recordPaymentEvent(db, {
    accountId: row.account_id, provider, eventType: event.eventType,
    externalId: event.externalId, payloadJson: rawBody,
  });
  if (!isNew) return;

  if (SUCCESS_EVENT_TYPES.has(event.eventType)) {
    activateSubscriptionByOrderId(db, event.orderId);
    finalizeDiscountRedemption(db, row.applied_code, row.account_id);
    incrementRevision(db, row.account_id);
  } else if (REFUND_EVENT_TYPES.has(event.eventType)) {
    markSubscriptionRefundedByOrderId(db, event.orderId);
    incrementRevision(db, row.account_id);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/billing-orchestrator.test.mjs`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Wire the webhook endpoints into `server.mjs`**

Add `processBillingEvent` to the `./lib/billing-orchestrator.mjs` import in `server.mjs` (new import line), then add next to `handleBillingCheckout` (Task 8):

```js
async function handleStripeWebhook(req, res) {
  const rawBody = (await readRawBody(req)).toString("utf8");
  if (!verifyStripeWebhookSignature(rawBody, req.headers["stripe-signature"])) {
    return writeJson(res, 401, { error: "Invalid signature" });
  }
  processBillingEvent(db, { provider: "stripe", event: parseStripeWebhookEvent(rawBody), rawBody });
  writeJson(res, 200, { received: true });
}

async function handleLavaTopWebhook(req, res) {
  const rawBody = (await readRawBody(req)).toString("utf8");
  if (!verifyLavaTopWebhookAuth(req.headers["x-api-key"])) {
    return writeJson(res, 401, { error: "Invalid auth" });
  }
  processBillingEvent(db, { provider: "lava_top", event: parseLavaTopWebhookEvent(rawBody), rawBody });
  writeJson(res, 200, { received: true });
}
```

- [ ] **Step 6: Register the routes**

Next to the checkout route from Task 8:

```js
    if (method === "POST" && p === "/billing/webhook/stripe")    return await handleStripeWebhook(req, res);
    if (method === "POST" && p === "/billing/webhook/lava-top")  return await handleLavaTopWebhook(req, res);
```

- [ ] **Step 7: Manual smoke check**

With the backend running, POST a hand-built Stripe-shaped JSON body to `/api/billing/webhook/stripe` without a `stripe-signature` header — expect `401`. This confirms the auth check runs before parsing.

- [ ] **Step 8: Commit**

```bash
git add backend/lib/billing-orchestrator.mjs backend/server.mjs backend/tests/billing-orchestrator.test.mjs
git commit -m "feat(billing): add webhook event orchestration + endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Expose subscription status — `GET /billing/subscription` + bootstrap

**Files:**
- Modify: `backend/server.mjs`
- Modify: `backend/lib/snapshot-builder.mjs`

**Interfaces:**
- Consumes: `getActiveSubscriptionForAccount` (Task 2).
- Produces: route `GET /billing/subscription` → `{ plan, status, currentPeriodEnd, cancelAtPeriodEnd } | null`; `buildBootstrap(...)`'s return object gains a `subscription` key with the same shape.

- [ ] **Step 1: Add the endpoint**

In `backend/server.mjs`, add next to the other billing handlers:

```js
async function handleGetSubscription(req, res) {
  const account = requireAuth(req);
  writeJson(res, 200, getActiveSubscriptionForAccount(db, account.id));
}
```

Register: `if (method === "GET" && p === "/billing/subscription") return await handleGetSubscription(req, res);`

- [ ] **Step 2: Add it to bootstrap**

Open `backend/lib/snapshot-builder.mjs`. Import `getActiveSubscriptionForAccount` from `./billing-repository.mjs` at the top, then inside `buildBootstrap`, add a line alongside the existing `const kvStore = getAllAccountKv(db, accountId);`:

```js
  const subscription = getActiveSubscriptionForAccount(db, accountId);
```

And add `subscription,` to the returned object (next to `settings:` at the top level, not nested inside it).

- [ ] **Step 3: Manual smoke check**

With the backend running and a logged-in test account, `curl http://localhost:3012/api/billing/subscription -H "Authorization: Bearer <token>"` returns `null` for a fresh account with no subscription; after manually running the Task 9 test's `processBillingEvent` path against a real account (or inserting an `active` row by hand in the dev DB), the same call returns `{"plan":"annual","status":"active",...}`. Also `curl http://localhost:3012/api/account/bootstrap -H "Authorization: Bearer <token>"` includes a top-level `"subscription"` key.

- [ ] **Step 4: Commit**

```bash
git add backend/server.mjs backend/lib/snapshot-builder.mjs
git commit -m "feat(billing): expose subscription status via endpoint and bootstrap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Promo code redemption endpoints

**Files:**
- Modify: `backend/server.mjs`

**Interfaces:**
- Consumes: `validatePromoCode`, `redeemFreeGrantCode` (Task 3), `PLAN_CATALOG` (Task 4), `incrementRevision` (existing, `account-repository.mjs`).
- Produces: routes `POST /billing/validate-code`, `POST /billing/redeem-code`.

- [ ] **Step 1: Add the handlers**

Add `incrementRevision` to the existing `account-repository.mjs` import list at the top of `backend/server.mjs` (it's already exported there — see Task 2's context — just not yet imported into `server.mjs`).

In `backend/server.mjs`, next to the other billing handlers:

```js
async function handleValidateCode(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  if (!body?.code || !PLAN_CATALOG[body.plan]) {
    return writeJson(res, 400, { error: "code and a known plan are required" });
  }
  const result = validatePromoCode(db, body.code, { accountId: account.id, plan: body.plan });
  if (!result.ok) return writeJson(res, 200, result);

  if (result.kind === "free_grant") return writeJson(res, 200, result);

  const original = PLAN_CATALOG[body.plan].amountMinor;
  const discounted = applyDiscount(original, result);
  writeJson(res, 200, { ...result, originalAmountMinor: original, discountedAmountMinor: discounted });
}

async function handleRedeemCode(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  if (!body?.code) return writeJson(res, 400, { error: "code is required" });

  const result = redeemFreeGrantCode(db, body.code, account.id);
  if (result.ok) incrementRevision(db, account.id);
  writeJson(res, result.ok ? 200 : 400, result);
}
```

- [ ] **Step 2: Register the routes**

```js
    if (method === "POST" && p === "/billing/validate-code") return await handleValidateCode(req, res);
    if (method === "POST" && p === "/billing/redeem-code")   return await handleRedeemCode(req, res);
```

- [ ] **Step 3: Manual smoke check**

With the backend running: create a promo code by hand in the dev DB (`INSERT INTO promo_codes ...`, matching Task 3's `createPromoCode` column list), then:

```bash
curl -X POST http://localhost:3012/api/billing/validate-code \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"code":"TESTCODE","plan":"monthly"}'
```

Expected: `{"ok":true,...}` for a valid code, `{"ok":false,"reason":"not_found"}` for a bogus one.

- [ ] **Step 4: Commit**

```bash
git add backend/server.mjs
git commit -m "feat(billing): add promo code validate/redeem endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: Gate topic acquisition behind entitlement

**Files:**
- Modify: `backend/server.mjs`

**Interfaces:**
- Consumes: `hasActiveEntitlement` (Task 2).
- Produces: `handleAcquireTopic` now returns `402` for a non-free topic when the account has no entitlement.

`hasActiveEntitlement` itself is already fully covered by Task 2's unit tests, and this task only adds a two-line guard in front of an existing HTTP handler — `server.mjs` cannot be imported from a test module without starting a real listening server (see Task 9's note), so this task is verified with the manual smoke check in Step 2 rather than an automated test.

- [ ] **Step 1: Gate the handler**

In `backend/server.mjs`, find `handleAcquireTopic` (currently unconditional) and change it to:

```js
// Topics anyone can download without an active subscription — the
// marketing "free core" hook from the landing page. Empty until product
// decides which specific topics stay free; add topic ids here later.
export const FREE_TOPIC_IDS = [];

async function handleAcquireTopic(req, res) {
  const account = requireAuth(req);
  const body = await readJsonBody(req);
  if (!body?.topicId || !body?.topicVersion) {
    return writeJson(res, 400, { error: "topicId, topicVersion required" });
  }
  if (!FREE_TOPIC_IDS.includes(body.topicId) && !hasActiveEntitlement(db, account.id)) {
    return writeJson(res, 402, { error: "Subscription required" });
  }
  upsertAccountTopic(db, account.id, {
    id: randomUUID(),
    topicId: body.topicId,
    topicVersion: body.topicVersion,
    source: body.source ?? "download",
  });
  writeJson(res, 200, { ok: true });
}
```

- [ ] **Step 2: Run the full backend test suite**

Run (from `backend/`): `node --test tests/*.test.mjs`
Expected: all green — this task changes only a live HTTP handler, so the existing suite passing confirms nothing else broke.

- [ ] **Step 3: Manual smoke check**

With the backend running and a fresh account (no subscription, no `all_access` flag): `curl -X POST http://localhost:3012/api/account-topics -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"topicId":"comparison","topicVersion":"1.0.0"}'` returns `402`. Grant `all_access` via `POST /api/admin/account/flags` (existing endpoint), retry — now `200`.

- [ ] **Step 4: Commit**

```bash
git add backend/server.mjs
git commit -m "feat(billing): gate topic acquisition behind active entitlement

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Admin promo codes — endpoints + `admin.html` section

**Files:**
- Modify: `backend/server.mjs`
- Modify: `public/admin.html`

**Interfaces:**
- Consumes: `requireAdmin` (existing), `createPromoCode`, `listPromoCodes` (Task 3).
- Produces: routes `GET /admin/promo-codes`, `POST /admin/promo-codes`; a "Промокоды" section in `admin.html` using the existing `apiFetch`/`esc`/`showError` helpers.

- [ ] **Step 1: Add the backend handlers**

In `backend/server.mjs`, next to `handleAdminGrant`/`handleAdminRevoke`:

```js
async function handleAdminListPromoCodes(req, res) {
  requireAdmin(req);
  writeJson(res, 200, listPromoCodes(db));
}

async function handleAdminCreatePromoCode(req, res) {
  requireAdmin(req);
  const body = await readJsonBody(req);
  if (!body?.code || !body?.kind) return writeJson(res, 400, { error: "code and kind required" });
  createPromoCode(db, {
    code: body.code,
    kind: body.kind,
    value: body.value ?? null,
    currency: body.currency ?? null,
    appliesToPlan: body.appliesToPlan ?? null,
    grantDurationDays: body.grantDurationDays ?? null,
    maxRedemptions: body.maxRedemptions ?? null,
    expiresAt: body.expiresAt ?? null,
    note: body.note ?? null,
    createdBy: body.createdBy ?? "admin",
  });
  writeJson(res, 200, { ok: true });
}
```

Also add `createPromoCode, listPromoCodes` to the `billing-repository.mjs` import list from Task 8 (they're already exported there).

- [ ] **Step 2: Register the routes**

```js
    if (method === "GET"  && p === "/admin/promo-codes") return await handleAdminListPromoCodes(req, res);
    if (method === "POST" && p === "/admin/promo-codes") return await handleAdminCreatePromoCode(req, res);
```

- [ ] **Step 3: Add the `admin.html` section**

Open `public/admin.html`. In the `.panel-body` div (after `<div id="accounts-container">...</div>`), add:

```html
    <h2 style="margin:28px 0 12px;font-size:15px;font-weight:700">Промокоды</h2>
    <form id="promo-form" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px" onsubmit="createPromoCode(event)">
      <input id="promo-code" placeholder="КОД" required style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px;text-transform:uppercase">
      <select id="promo-kind" style="padding:7px 10px;border:1.5px solid #ddd;border-radius:8px">
        <option value="percent_off">Скидка %</option>
        <option value="fixed_off">Скидка, фикс. сумма (центы)</option>
        <option value="free_grant">Бесплатный грант</option>
      </select>
      <input id="promo-value" type="number" placeholder="Значение" style="width:110px;padding:7px 10px;border:1.5px solid #ddd;border-radius:8px">
      <input id="promo-plan" placeholder="План (пусто = любой)" style="width:160px;padding:7px 10px;border:1.5px solid #ddd;border-radius:8px">
      <input id="promo-max" type="number" placeholder="Лимит использований" style="width:150px;padding:7px 10px;border:1.5px solid #ddd;border-radius:8px">
      <input id="promo-note" placeholder="Заметка" style="flex:1;min-width:160px;padding:7px 10px;border:1.5px solid #ddd;border-radius:8px">
      <button class="btn btn--primary" type="submit">Создать</button>
    </form>
    <div id="promo-container"><div class="state-msg"><div class="spinner"></div></div></div>
```

- [ ] **Step 4: Add the script logic**

In the `<script>` block, next to `startAutoRefresh`/other init calls, add:

```js
async function loadPromoCodes() {
  const res = await apiFetch('/api/admin/promo-codes');
  if (!res.ok) return showError('Не удалось загрузить промокоды');
  const codes = await res.json();
  document.getElementById('promo-container').innerHTML = codes.length
    ? `<div class="user-list">${codes.map(renderPromoCode).join('')}</div>`
    : '<div class="state-msg">Промокодов пока нет</div>';
}

function renderPromoCode(c) {
  const valueLabel = c.kind === 'percent_off' ? `${c.value}%`
    : c.kind === 'fixed_off' ? `${(c.value / 100).toFixed(2)} ${c.currency ?? ''}`
    : 'бесплатно';
  const usage = c.maxRedemptions != null ? `${c.redeemedCount} / ${c.maxRedemptions}` : `${c.redeemedCount} / ∞`;
  return `<div class="user-card"><div class="user-card__head">
    <strong>${esc(c.code)}</strong> — ${esc(valueLabel)}
    ${c.appliesToPlan ? `· план: ${esc(c.appliesToPlan)}` : ''}
    · использован: ${usage}
    ${c.note ? `· ${esc(c.note)}` : ''}
  </div></div>`;
}

async function createPromoCode(evt) {
  evt.preventDefault();
  const body = {
    code: document.getElementById('promo-code').value,
    kind: document.getElementById('promo-kind').value,
    value: document.getElementById('promo-value').value ? Number(document.getElementById('promo-value').value) : null,
    appliesToPlan: document.getElementById('promo-plan').value || null,
    maxRedemptions: document.getElementById('promo-max').value ? Number(document.getElementById('promo-max').value) : null,
    note: document.getElementById('promo-note').value || null,
  };
  const res = await apiFetch('/api/admin/promo-codes', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) return showError('Не удалось создать промокод');
  document.getElementById('promo-form').reset();
  loadPromoCodes();
}
```

Call `loadPromoCodes();` alongside wherever `loadData()`/the initial accounts load already runs after successful admin login.

- [ ] **Step 5: Manual smoke check**

Open `public/admin.html` locally (or after deploy), log in with the admin token, create a promo code through the new form, confirm it appears in the list below. `curl -X POST .../api/admin/promo-codes -H "Authorization: Bearer $MIROCARD_ADMIN_TOKEN"` with a JSON body also works directly.

- [ ] **Step 6: Commit**

```bash
git add backend/server.mjs public/admin.html
git commit -m "feat(billing): add admin promo code creation UI + endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Frontend store + bootstrap wiring, `?plan=` deep link

**Files:**
- Modify: `src/core/store.js`
- Modify: `src/core/bootstrap.js`
- Modify: `src/App.jsx`
- Test: `src/core/bootstrap.test.js`

**Interfaces:**
- Produces: store fields `pendingCheckoutPlan`/`setPendingCheckoutPlan`, `subscription`/`setSubscription`; `applyBootstrapToStore` merges `subscription` following the `"field" in raw` convention (see `feedback_apply_bootstrap_store.md`); App boot captures `?plan=` into `pendingCheckoutPlan` and redirects to the `subscription` screen once landed on `home`.

- [ ] **Step 1: Write the failing test**

Open `src/core/bootstrap.test.js`, find an existing test that checks a field is only overwritten when present in the raw payload (the `ownedTopics`/`topicRecords` pattern), and add a sibling test following its exact style:

```js
test("applyBootstrapToStore only overwrites subscription when present in the payload", () => {
  useAppStore.setState({ subscription: { plan: "annual", status: "active" } });
  applyBootstrapToStore({ token: "t", account: { id: "a" } }); // no "subscription" key at all
  assert.deepEqual(useAppStore.getState().subscription, { plan: "annual", status: "active" });

  applyBootstrapToStore({ token: "t", account: { id: "a" }, subscription: null });
  assert.equal(useAppStore.getState().subscription, null);
});
```

(Match this file's actual import style and test runner — open it first and mirror whatever `test`/`assert` imports and `useAppStore.setState` reset pattern it already uses between tests.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/bootstrap.test.js`
Expected: FAIL — `subscription` stays `undefined`/doesn't round-trip because the field doesn't exist yet.

- [ ] **Step 3: Add the store fields**

In `src/core/store.js`, add near the other read-once-then-cleared fields (next to `sessionPortionsOverride`):

```js
  // Plan chosen on the marketing landing page before the user was logged
  // in — read once by the Subscription screen after the normal boot/login
  // flow lands on "home", then cleared. See App.jsx's ?plan= handling.
  pendingCheckoutPlan: null,
  setPendingCheckoutPlan: (pendingCheckoutPlan) => set({ pendingCheckoutPlan }),

  subscription: null,
  setSubscription: (subscription) => set({ subscription }),
```

- [ ] **Step 4: Wire it into bootstrap**

In `src/core/bootstrap.js`:
- `normalizeBootstrap`'s returned object gains: `subscription: raw.subscription ?? null,`
- `applyBootstrapToStore`'s `useAppStore.setState((state) => ({ ... }))` object gains, next to the `ownedTopics: "ownedTopics" in raw ? ... : state.ownedTopics,` line:

```js
    subscription: "subscription" in raw ? bootstrap.subscription : state.subscription,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/core/bootstrap.test.js`
Expected: PASS

- [ ] **Step 6: Capture `?plan=` at boot**

In `src/App.jsx`, in the `useEffect` that already handles `/verify-email?token=` (around line 168), add — right after that `urlParams` is read, before the early-return `if` for verify-email:

```js
    const planParam = urlParams.get("plan");
    if (planParam && ["monthly", "half_year", "annual"].includes(planParam)) {
      useAppStore.setState({ pendingCheckoutPlan: planParam });
      window.history.replaceState({}, "", "/");
    }
```

Then, in the same component, add a small effect that redirects once boot has landed on `home` with a pending plan still set — this covers both "already logged in" (redirected right after boot) and "just logged in/registered" (redirected right after whichever screen sets `screen: "home"`), without touching every login call site:

```js
  useEffect(() => {
    if (screen === "home" && pendingCheckoutPlan) {
      setScreen("subscription");
    }
  }, [screen, pendingCheckoutPlan, setScreen]);
```

Add `pendingCheckoutPlan` and `setPendingCheckoutPlan` to the destructured `useAppStore()` values at the top of the `App` component, alongside the existing ones (`screen`, `setScreen`, etc.).

- [ ] **Step 7: Manual smoke check**

`npm run dev`, open `http://localhost:5174/?plan=annual` while logged out — confirm the query string is stripped from the URL bar immediately, log in with a test account, and confirm the app lands on the (not-yet-built) `subscription` screen key instead of `home` once Task 16 registers it — until then, confirm via `useAppStore.getState().pendingCheckoutPlan === "annual"` in the devtools console that the value survived login.

- [ ] **Step 8: Commit**

```bash
git add src/core/store.js src/core/bootstrap.js src/core/bootstrap.test.js src/App.jsx
git commit -m "feat(billing): capture ?plan= deep link and add subscription store state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 15: `SubscriptionScreen` — plan/method/promo selection

**Files:**
- Create: `src/features/billing/SubscriptionScreen.jsx`
- Modify: `src/styles.css`
- Test: `src/features/billing/SubscriptionScreen.test.jsx`

**Interfaces:**
- Consumes: `api.post` (`src/core/api.js`), `useAppStore` (`pendingCheckoutPlan`, `setScreen`), `Button` (`src/shared/components/Button`), `BackArrowIcon` (`src/shared/components/ArrowIcons`).
- Produces: default export `SubscriptionScreen`; on successful `POST /billing/checkout`, sets `useAppStore`'s `checkoutUrl`/`checkoutOrderId` (new fields, added in this task) and navigates to `"checkout_redirect"` (Task 16).

- [ ] **Step 1: Write the failing test**

Create `src/features/billing/SubscriptionScreen.test.jsx`, mirroring `HomeMenuSheet.smoke.test.jsx`'s mount style exactly (`react-dom/client` + `act`, no testing-library):

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import SubscriptionScreen from "./SubscriptionScreen.jsx";

describe("SubscriptionScreen", () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    useAppStore.setState({ pendingCheckoutPlan: "annual", setScreen: vi.fn() });
  });

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    vi.restoreAllMocks();
  });

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<SubscriptionScreen />); });
  }

  it("pre-selects the plan from pendingCheckoutPlan", () => {
    mount();
    const selected = container.querySelector(".plan--selected .plan__name");
    expect(selected.textContent).toBe("Год");
  });

  it("switching plan updates the CTA total", () => {
    mount();
    const monthlyRadio = container.querySelectorAll(".plan")[0];
    act(() => { monthlyRadio.click(); });
    const cta = container.querySelector(".subscription-cta");
    expect(cta.textContent).toContain("9,90");
  });

  it("applying a valid percent-off code updates the displayed price", async () => {
    vi.spyOn(apiModule.api, "post").mockImplementation(async (path) => {
      if (path === "/billing/validate-code") {
        return { ok: true, code: "TENOFF", kind: "percent_off", value: 10, originalAmountMinor: 8990, discountedAmountMinor: 8091 };
      }
      throw new Error(`unexpected path ${path}`);
    });
    mount();
    act(() => { container.querySelector(".promo-toggle").click(); });
    const input = container.querySelector(".promo-input");
    act(() => { input.value = "tenoff"; input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => { container.querySelector(".promo-apply").click(); await Promise.resolve(); });
    const cta = container.querySelector(".subscription-cta");
    expect(cta.textContent).toContain("80,91");
  });

  it("submitting calls checkout with the selected plan and method", async () => {
    const postSpy = vi.spyOn(apiModule.api, "post").mockResolvedValue({ checkoutUrl: "https://pay.example/x", orderId: "o1" });
    mount();
    await act(async () => { container.querySelector(".subscription-cta").click(); await Promise.resolve(); });
    expect(postSpy).toHaveBeenCalledWith("/billing/checkout", { plan: "annual", method: "card", code: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/billing/SubscriptionScreen.test.jsx`
Expected: FAIL — `Cannot find module './SubscriptionScreen.jsx'`

- [ ] **Step 3: Add the checkout-flow store fields**

In `src/core/store.js`, next to `pendingCheckoutPlan`:

```js
  checkoutUrl: null,
  checkoutOrderId: null,
  setCheckout: (checkoutUrl, checkoutOrderId) => set({ checkoutUrl, checkoutOrderId }),
```

- [ ] **Step 4: Write the implementation**

Create `src/features/billing/SubscriptionScreen.jsx`:

```jsx
import { useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import Button from "@/shared/components/Button";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

const PLANS = [
  { id: "monthly", name: "Месяц", hint: "Без долгих обязательств", priceLabel: "€ 9,90" },
  { id: "half_year", name: "Полгода", hint: "€ 8,32 в месяц · выгода 16%", priceLabel: "€ 49,90" },
  { id: "annual", name: "Год", hint: "€ 7,49 в месяц · максимальная выгода", priceLabel: "€ 89,90" },
];

function formatMinor(amountMinor) {
  return (amountMinor / 100).toFixed(2).replace(".", ",");
}

export default function SubscriptionScreen() {
  const pendingCheckoutPlan = useAppStore((s) => s.pendingCheckoutPlan);
  const setScreen = useAppStore((s) => s.setScreen);
  const setCheckout = useAppStore((s) => s.setCheckout);

  const [planId, setPlanId] = useState(pendingCheckoutPlan ?? "annual");
  const [method, setMethod] = useState("card");
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoResult, setPromoResult] = useState(null); // { ok, kind, discountedAmountMinor, ... }
  const [promoError, setPromoError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const plan = PLANS.find((p) => p.id === planId);
  const discounted = promoResult?.ok && promoResult.kind !== "free_grant" ? promoResult.discountedAmountMinor : null;

  async function applyPromo() {
    setPromoError(null);
    const result = await api.post("/billing/validate-code", { code: promoInput, plan: planId });
    if (!result.ok) {
      setPromoResult(null);
      setPromoError(result.reason);
      return;
    }
    setPromoResult(result);
    if (result.kind === "free_grant") {
      const redeem = await api.post("/billing/redeem-code", { code: result.code });
      if (redeem.ok) setScreen("checkout_return");
    }
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const code = promoResult?.ok && promoResult.kind !== "free_grant" ? promoResult.code : null;
      const result = await api.post("/billing/checkout", { plan: planId, method, code });
      setCheckout(result.checkoutUrl, result.orderId);
      setScreen("checkout_redirect");
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen subscription-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => setScreen("home")}><BackArrowIcon /></button>
        <h1 className="screen-title">Подписка</h1>
      </div>

      <div className="subscription-body">
        <div className="subscription-lead">
          <p className="subscription-lead__eyebrow">Оформление</p>
          <h2 className="subscription-lead__title">Все занятия — в одной подписке</h2>
        </div>

        <div className="plan-list">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`plan${p.id === planId ? " plan--selected" : ""}`}
              onClick={() => { setPlanId(p.id); setPromoResult(null); }}
            >
              <span className="plan__radio" />
              <span className="plan__info">
                <span className="plan__name">{p.name}</span>
                <span className="plan__hint">{p.hint}</span>
              </span>
              <span className="plan__price">{p.priceLabel}</span>
            </button>
          ))}
        </div>

        <p className="section-label">Способ оплаты</p>
        <div className="pay-methods">
          <button type="button" className={`pay-chip${method === "card" ? " pay-chip--selected" : ""}`} onClick={() => setMethod("card")}>Картой</button>
          <button type="button" className={`pay-chip${method === "mir_sbp" ? " pay-chip--selected" : ""}`} onClick={() => setMethod("mir_sbp")}>МИР / СБП</button>
        </div>

        {!promoOpen && (
          <button type="button" className="promo-toggle" onClick={() => setPromoOpen(true)}>У меня есть промокод</button>
        )}
        {promoOpen && (
          <div className="promo-row">
            <input className="promo-input" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="ПРОМОКОД" />
            <button type="button" className="promo-apply" onClick={applyPromo}>Применить</button>
            {promoError && <span className="promo-error">Код не подходит</span>}
          </div>
        )}

        {submitError && <p className="subscription-error">{submitError}</p>}
      </div>

      <div className="subscription-footer">
        <button type="button" className="btn btn-primary subscription-cta" disabled={submitting} onClick={submit}>
          Оформить — {discounted != null ? `€ ${formatMinor(discounted)}` : plan.priceLabel}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add styles**

In `src/styles.css`, add near the other `src/features/*`-family screen styles (search for `.screen-header` to find that neighborhood):

```css
.subscription-body { flex: 1; overflow-y: auto; padding: 6px 16px 0; }
.subscription-lead { margin: 6px 0 18px; }
.subscription-lead__eyebrow { font-size: 12px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; color: #4a9b8f; }
.subscription-lead__title { margin-top: 6px; font-size: 22px; font-weight: 900; letter-spacing: -.01em; }

.plan-list { display: flex; flex-direction: column; gap: 10px; }
.plan { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-radius: 16px; background: #fff; border: 1.5px solid #e4dccf; text-align: left; font-family: inherit; cursor: pointer; }
.plan--selected { border-color: #4a9b8f; background: #eef7f4; }
.plan__radio { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #c8d4d2; flex-shrink: 0; }
.plan--selected .plan__radio { border-color: #4a9b8f; background: #4a9b8f; }
.plan__info { flex: 1; display: flex; flex-direction: column; }
.plan__name { font-size: 15px; font-weight: 800; }
.plan__hint { margin-top: 2px; font-size: 12.5px; font-weight: 600; color: #6b7b78; }
.plan__price { font-size: 16px; font-weight: 900; white-space: nowrap; }

.section-label { margin: 22px 0 10px; font-size: 13px; font-weight: 900; color: #526562; }
.pay-methods { display: flex; gap: 10px; }
.pay-chip { flex: 1; padding: 12px 8px; border-radius: 14px; background: #fff; border: 1.5px solid #e4dccf; font-size: 12.5px; font-weight: 800; color: #526562; cursor: pointer; }
.pay-chip--selected { border-color: #4a9b8f; background: #eef7f4; color: #1c3634; }

.promo-toggle { margin-top: 18px; background: none; border: none; font: 700 13px "Nunito", sans-serif; color: #2f5b57; text-decoration: underline; cursor: pointer; padding: 0; }
.promo-row { display: flex; gap: 8px; margin-top: 14px; align-items: center; flex-wrap: wrap; }
.promo-input { flex: 1; min-width: 140px; height: 44px; padding: 0 14px; border: 1.5px solid #e4dccf; border-radius: 12px; font: 600 14px "Nunito", sans-serif; text-transform: uppercase; }
.promo-apply { height: 44px; padding: 0 16px; border: none; border-radius: 12px; background: #4a9b8f; color: #fff; font-weight: 800; cursor: pointer; }
.promo-error { font-size: 12.5px; color: #e05252; font-weight: 700; }
.subscription-error { margin-top: 12px; font-size: 13px; color: #e05252; font-weight: 700; }

.subscription-footer { flex-shrink: 0; padding: 14px 16px calc(16px + var(--app-safe-bottom, 0px)); }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/features/billing/SubscriptionScreen.test.jsx`
Expected: PASS (all 4 tests)

- [ ] **Step 7: Commit**

```bash
git add src/features/billing/SubscriptionScreen.jsx src/features/billing/SubscriptionScreen.test.jsx src/styles.css src/core/store.js
git commit -m "feat(billing): add SubscriptionScreen with plan/method/promo selection

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 16: `CheckoutRedirectScreen` + `CheckoutReturnScreen`, App wiring

**Files:**
- Create: `src/features/billing/CheckoutRedirectScreen.jsx`
- Create: `src/features/billing/CheckoutReturnScreen.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Test: `src/features/billing/CheckoutReturnScreen.test.jsx`

**Interfaces:**
- Consumes: `checkoutUrl`/`checkoutOrderId` (Task 15), `api.get` (`/billing/subscription`).
- Produces: default exports `CheckoutRedirectScreen`, `CheckoutReturnScreen`; `App.jsx`'s `SCREENS` registry gains `subscription`, `checkout_redirect`, `checkout_return` keys.

- [ ] **Step 1: Write the failing test**

Create `src/features/billing/CheckoutReturnScreen.test.jsx`:

```jsx
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { useAppStore } from "@/core/store";
import * as apiModule from "@/core/api";
import CheckoutReturnScreen from "./CheckoutReturnScreen.jsx";

describe("CheckoutReturnScreen", () => {
  let container = null, root = null;

  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mount() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<CheckoutReturnScreen />); });
  }

  it("shows the processing state while polling finds no active subscription yet", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue(null);
    mount();
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector(".checkout-return__title").textContent).toBe("Обрабатываем оплату…");
  });

  it("shows success once polling finds an active subscription", async () => {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ plan: "annual", status: "active", currentPeriodEnd: "2027-09-15T00:00:00.000Z" });
    mount();
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector(".checkout-return__title").textContent).toBe("Подписка активна!");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/billing/CheckoutReturnScreen.test.jsx`
Expected: FAIL — `Cannot find module './CheckoutReturnScreen.jsx'`

- [ ] **Step 3: Write `CheckoutRedirectScreen`**

Create `src/features/billing/CheckoutRedirectScreen.jsx`:

```jsx
import { useEffect } from "react";
import { useAppStore } from "@/core/store";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

export default function CheckoutRedirectScreen() {
  const checkoutUrl = useAppStore((s) => s.checkoutUrl);
  const setScreen = useAppStore((s) => s.setScreen);

  useEffect(() => {
    if (!checkoutUrl) return;
    const timer = setTimeout(() => {
      window.open(checkoutUrl, "_blank", "noopener,noreferrer");
      setScreen("checkout_return");
    }, 600); // brief pause so the "Открываем..." message is actually readable
    return () => clearTimeout(timer);
  }, [checkoutUrl, setScreen]);

  return (
    <div className="screen checkout-transition-screen">
      <div className="screen-header">
        <button className="back-btn back-btn--disabled" disabled><BackArrowIcon /></button>
      </div>
      <div className="checkout-transition__center">
        <div className="checkout-spinner" />
        <div>
          <div className="checkout-transition__title">Открываем страницу оплаты…</div>
          <div className="checkout-transition__sub">Сейчас откроется защищённая<br />страница платёжного провайдера.</div>
        </div>
        <div className="checkout-lock-note">Данные карты нам не передаются</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `CheckoutReturnScreen`**

Create `src/features/billing/CheckoutReturnScreen.jsx`:

```jsx
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { BackArrowIcon } from "@/shared/components/ArrowIcons";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 20000;

export default function CheckoutReturnScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const [subscription, setSubscription] = useState(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const result = await api.get("/billing/subscription");
      if (cancelled) return;
      if (result?.status === "active") {
        setSubscription(result);
        return;
      }
      if (Date.now() - startedAt.current < POLL_TIMEOUT_MS) {
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
    poll();
    return () => { cancelled = true; };
  }, []);

  const processing = !subscription;

  return (
    <div className="screen checkout-transition-screen">
      <div className="screen-header">
        <button className="back-btn back-btn--disabled" disabled><BackArrowIcon /></button>
      </div>
      <div className="checkout-transition__center">
        {processing ? (
          <>
            <div className="checkout-spinner" />
            <div>
              <div className="checkout-return__title">Обрабатываем оплату…</div>
              <div className="checkout-transition__sub">Обычно это занимает несколько<br />секунд. Не закрывайте приложение.</div>
            </div>
          </>
        ) : (
          <>
            <div className="checkout-return__check">✓</div>
            <div>
              <div className="checkout-return__title">Подписка активна!</div>
              <div className="checkout-transition__sub">{planLabel(subscription.plan)} · действует до {formatDate(subscription.currentPeriodEnd)}</div>
            </div>
          </>
        )}
      </div>
      {!processing && (
        <div className="subscription-footer">
          <button type="button" className="btn btn-primary" onClick={() => setScreen("home")}>Начать заниматься</button>
        </div>
      )}
    </div>
  );
}

function planLabel(plan) {
  return { monthly: "Месяц", half_year: "Полгода", annual: "Год", free_grant: "Бесплатный доступ" }[plan] ?? plan;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" });
}
```

- [ ] **Step 5: Add styles**

In `src/styles.css`, next to the subscription styles from Task 15:

```css
.checkout-transition__center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 0 40px; text-align: center; }
.checkout-spinner { width: 56px; height: 56px; border-radius: 50%; border: 5px solid #dde6e3; border-top-color: #4a9b8f; animation: checkout-spin .9s linear infinite; }
@keyframes checkout-spin { to { transform: rotate(360deg); } }
.checkout-transition__title, .checkout-return__title { font-size: 17px; font-weight: 900; }
.checkout-transition__sub { margin-top: 8px; font-size: 13.5px; font-weight: 600; color: #6b7b78; line-height: 1.5; }
.checkout-lock-note { margin-top: 6px; font-size: 12px; font-weight: 700; color: #8a938f; }
.checkout-return__check { width: 76px; height: 76px; border-radius: 50%; background: #4a9b8f; color: #fff; font-size: 32px; font-weight: 900; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 24px rgba(42,107,96,.32); }
.back-btn--disabled { opacity: .45; pointer-events: none; }
```

- [ ] **Step 6: Register the screens in `App.jsx`**

In `src/App.jsx`, add the imports near the other `src/features/*` imports:

```js
import SubscriptionScreen from "@/features/billing/SubscriptionScreen";
import CheckoutRedirectScreen from "@/features/billing/CheckoutRedirectScreen";
import CheckoutReturnScreen from "@/features/billing/CheckoutReturnScreen";
```

And add to the `SCREENS` object:

```js
  subscription: SubscriptionScreen,
  checkout_redirect: CheckoutRedirectScreen,
  checkout_return: CheckoutReturnScreen,
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/features/billing/CheckoutReturnScreen.test.jsx`
Expected: PASS (both tests)

- [ ] **Step 8: Manual smoke check**

`npm run dev`, log in, navigate the store manually via devtools (`useAppStore.getState().setScreen("subscription")`), click through Оформить (it will fail against real Stripe/Lava Top without real keys — that's expected locally) to confirm the screen transitions render correctly and match the earlier approved mockup.

- [ ] **Step 9: Commit**

```bash
git add src/features/billing/CheckoutRedirectScreen.jsx src/features/billing/CheckoutReturnScreen.jsx src/features/billing/CheckoutReturnScreen.test.jsx src/App.jsx src/styles.css
git commit -m "feat(billing): add checkout redirect + return screens

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 17: Landing page — CTA links, payment methods row, legal footer links

**Files:**
- Modify: `landing/index.html`
- Modify: `landing/proposal-v3.css`

**Interfaces:**
- Produces: the 3 pricing-card CTAs link to `https://app.mironium.com/?plan=<id>`; a new `.payment-methods` row under the pricing grid; two new footer links (pointing at placeholder pages created in this task — their real legal copy is out of scope per the spec's §1 "Не входит").

This task has no automated test — it's static marketing HTML. Verified visually per Step 4.

- [ ] **Step 1: Update the CTA hrefs**

In `landing/index.html`, in the `#pricing` section, change the three `<a class="button pricing-card__button" href="https://app.mironium.com">` links to:

```html
<a class="button pricing-card__button" href="https://app.mironium.com/?plan=monthly">Начать на месяц</a>
```
```html
<a class="button pricing-card__button" href="https://app.mironium.com/?plan=half_year">Выбрать полгода</a>
```
```html
<a class="button pricing-card__button" href="https://app.mironium.com/?plan=annual">Выбрать год</a>
```

- [ ] **Step 2: Add the payment-methods row**

In `landing/index.html`, between the closing `</div>` of `.pricing__grid` and the opening `<div class="wrap pricing__footer">`, add:

```html
  <div class="wrap payment-methods">
    <span class="payment-methods__label">Принимаем к оплате</span>
    <span class="pm-chip">
      <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M2 9.5h20" stroke="currentColor" stroke-width="1.6"/><path d="M5 14.5h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      Visa
    </span>
    <span class="pm-chip">
      <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M2 9.5h20" stroke="currentColor" stroke-width="1.6"/><path d="M5 14.5h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      Mastercard
    </span>
    <span class="pm-chip">
      <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M2 9.5h20" stroke="currentColor" stroke-width="1.6"/><path d="M5 14.5h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      МИР
    </span>
    <span class="pm-chip">
      <svg viewBox="0 0 24 24" fill="none"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
      СБП
    </span>
  </div>
```

(This exact markup was already validated as a mockup — see the "Mironium Payment Section" artifact from the design phase.)

- [ ] **Step 3: Add the styles and footer links**

In `landing/proposal-v3.css`, add next to the existing `.pricing__footer` rule (around line 359):

```css
.payment-methods{margin-top:30px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:14px 12px}
.payment-methods__label{font:700 13px var(--font-display);color:var(--copy)}
.pm-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:100px;border:1.5px solid var(--line);background:#fffaf2;font:700 13px var(--font-display);color:var(--ink)}
.pm-chip svg{width:18px;height:18px;color:var(--deep)}
```

In `landing/index.html`'s `<footer>`, inside `.site-footer__links`, add two new links after `Бесплатные материалы`:

```html
      <a href="/terms.html">Условия использования</a>
      <a href="/refund-policy.html">Политика возврата</a>
```

Create two placeholder pages, `landing/terms.html` and `landing/refund-policy.html`, each a minimal page in the same visual shell (copy `landing/index.html`'s `<head>` font links + a `<link rel="stylesheet" href="proposal-v3.css">`, drop everything else, and put a single `<main class="wrap" style="padding:80px 0">` with an `<h1>` and one paragraph marking it explicitly as a draft, e.g. "Черновик — заменить на согласованный юридический текст перед приёмом реальных платежей." per spec §1's "Не входит" — this is a real, honest placeholder page, not a placeholder *step in this plan*: the page itself says out loud that it isn't final legal text yet.

- [ ] **Step 4: Visual check**

Run the landing site locally (`node landing/server.mjs` per its own README/script, or open `landing/index.html` directly in a browser), scroll to `#pricing`, confirm: the payment-methods row renders below the three cards matching the approved mockup, the footer shows the two new links, and clicking a plan CTA in the browser's address bar preview shows the correct `?plan=` query string.

- [ ] **Step 5: Commit**

```bash
git add landing/index.html landing/proposal-v3.css landing/terms.html landing/refund-policy.html
git commit -m "feat(billing): wire landing CTAs to ?plan=, add payment methods row and legal footer links

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Post-plan (not part of this plan, tracked in the spec §9)

- Get real `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`LAVA_TOP_API_KEY`/`LAVA_TOP_WEBHOOK_SECRET` from each provider's dashboard once accounts are opened under the Slovenian s.p., and set them as Railway env vars — never commit them.
- Confirm Lava Top's exact invoice/webhook field names against their live docs (Task 7's caveat).
- Real legal text for `landing/terms.html` / `landing/refund-policy.html`.
- Decide `FREE_TOPIC_IDS` (Task 12) once product picks the "always free" topics.
